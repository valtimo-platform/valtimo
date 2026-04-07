/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.document.opensearch.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.domain.search.AdvancedSearchRequest
import com.ritense.document.domain.search.AssigneeFilter
import com.ritense.document.domain.search.DatabaseSearchType
import com.ritense.document.domain.search.SearchOperator
import com.ritense.document.domain.search.SearchRequestMapper
import com.ritense.document.domain.search.SearchRequestValidator
import com.ritense.document.domain.search.SearchWithConfigRequest
import com.ritense.document.event.DocumentsListed
import com.ritense.document.opensearch.authorization.OpenSearchPermissionConditionTranslator
import com.ritense.document.opensearch.authorization.OpenSearchPermissionConditionTranslator.Companion.andAll
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.service.DocumentSearchService
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.document.service.SearchFieldService
import com.ritense.document.service.impl.SearchRequest
import com.ritense.outbox.OutboxService
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.utils.RequestHelper
import com.ritense.valtimo.contract.utils.SecurityUtils
import org.apache.commons.lang3.NotImplementedException
import org.opensearch.client.opensearch._types.FieldValue
import org.opensearch.client.opensearch._types.query_dsl.Query
import org.opensearch.client.json.JsonData
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.query.NativeQuery
import java.util.regex.Pattern

class JsonSchemaDocumentOpenSearchService(
    private val elasticsearchOperations: ElasticsearchOperations,
    private val translator: OpenSearchPermissionConditionTranslator,
    private val authorizationService: AuthorizationService,
    private val jpaRepository: JsonSchemaDocumentRepository,
    private val userManagementService: UserManagementService,
    private val searchFieldService: SearchFieldService,
    private val outboxService: OutboxService,
    private val objectMapper: ObjectMapper,
) : DocumentSearchService {

    override fun search(
        searchRequest: SearchRequest,
        blueprintType: BlueprintType,
        pageable: Pageable
    ): Page<JsonSchemaDocument> {
        val parts = mutableListOf<Query>()

        parts.add(buildAuthQuery(JsonSchemaDocumentActionProvider.VIEW_LIST))
        parts.add(termQuery(BLUEPRINT_TYPE_FIELD, blueprintType.name))

        if (!searchRequest.documentDefinitionName.isNullOrEmpty()) {
            parts.add(termQuery(DEFINITION_NAME_FIELD, searchRequest.documentDefinitionName))
        }
        if (!searchRequest.createdBy.isNullOrEmpty()) {
            parts.add(termQuery("createdBy", searchRequest.createdBy))
        }
        if (searchRequest.sequence != null) {
            parts.add(Query.of { q -> q.term { t -> t.field("sequence").value(FieldValue.of(searchRequest.sequence)) } })
        }
        if (!searchRequest.globalSearchFilter.isNullOrEmpty()) {
            throw NotImplementedException("globalSearchFilter is not supported in the simple search — use the advanced search overload")
        }
        searchRequest.otherFilters?.forEach { sc ->
            parts.add(termQuery("content.${sc.path}", sc.value))
        }

        return executeSearch(andAll(parts), pageable)
    }

    override fun search(
        documentDefinitionName: String,
        blueprintType: BlueprintType,
        searchWithConfigRequest: SearchWithConfigRequest,
        pageable: Pageable
    ): Page<JsonSchemaDocument> {
        val zoneOffset = RequestHelper.getZoneOffset()
        val searchFieldMap = searchFieldService.getSearchFields(documentDefinitionName)
            .associateBy { it.key }

        val otherFilters = searchWithConfigRequest.otherFilters
            .map { filter -> SearchRequestMapper.toOtherFilter(filter, searchFieldMap[filter.key], zoneOffset) }

        val advancedSearchRequest = SearchRequestMapper.toAdvancedSearchRequest(searchWithConfigRequest, otherFilters)

        return search(
            documentDefinitionName,
            blueprintType,
            advancedSearchRequest,
            pageable,
            JsonSchemaDocumentActionProvider.VIEW_LIST
        )
    }

    override fun search(
        documentDefinitionName: String,
        blueprintType: BlueprintType,
        advancedSearchRequest: AdvancedSearchRequest,
        pageable: Pageable
    ): Page<JsonSchemaDocument> {
        return search(
            documentDefinitionName,
            blueprintType,
            advancedSearchRequest,
            pageable,
            JsonSchemaDocumentActionProvider.VIEW_LIST
        )
    }

    override fun searchForExport(
        documentDefinitionName: String,
        blueprintType: BlueprintType,
        searchWithConfigRequest: SearchWithConfigRequest,
        pageable: Pageable
    ): Page<JsonSchemaDocument> {
        val zoneOffset = RequestHelper.getZoneOffset()
        val searchFieldMap = searchFieldService.getSearchFields(documentDefinitionName)
            .associateBy { it.key }

        val otherFilters = searchWithConfigRequest.otherFilters
            .map { filter -> SearchRequestMapper.toOtherFilter(filter, searchFieldMap[filter.key], zoneOffset) }

        val advancedSearchRequest = SearchRequestMapper.toAdvancedSearchRequest(searchWithConfigRequest, otherFilters)

        return search(
            documentDefinitionName,
            blueprintType,
            advancedSearchRequest,
            pageable,
            JsonSchemaDocumentActionProvider.EXPORT
        )
    }

    override fun count(
        documentDefinitionName: String,
        blueprintType: BlueprintType,
        advancedSearchRequest: AdvancedSearchRequest
    ): Long {
        SearchRequestValidator.validate(advancedSearchRequest)
        val combinedQuery = buildCombinedQuery(
            documentDefinitionName,
            blueprintType,
            advancedSearchRequest,
            JsonSchemaDocumentActionProvider.VIEW_LIST
        )
        val countQuery = NativeQuery.builder().withQuery(combinedQuery).build()
        return elasticsearchOperations.count(countQuery, JsonSchemaDocumentOsDocument::class.java)
    }

    private fun search(
        documentDefinitionName: String,
        blueprintType: BlueprintType,
        advancedSearchRequest: AdvancedSearchRequest,
        pageable: Pageable,
        action: Action<JsonSchemaDocument>
    ): Page<JsonSchemaDocument> {
        SearchRequestValidator.validate(advancedSearchRequest)
        val combinedQuery = buildCombinedQuery(documentDefinitionName, blueprintType, advancedSearchRequest, action)
        return executeSearch(combinedQuery, pageable)
    }

    private fun buildCombinedQuery(
        documentDefinitionName: String?,
        blueprintType: BlueprintType,
        searchRequest: AdvancedSearchRequest,
        action: Action<JsonSchemaDocument>
    ): Query {
        val parts = mutableListOf<Query>()

        parts.add(buildAuthQuery(action))
        parts.add(termQuery(BLUEPRINT_TYPE_FIELD, blueprintType.name))

        if (!documentDefinitionName.isNullOrEmpty()) {
            parts.add(termQuery(DEFINITION_NAME_FIELD, documentDefinitionName))
        }

        if (searchRequest.assigneeFilter != null && searchRequest.assigneeFilter != AssigneeFilter.ALL) {
            parts.add(buildAssigneeFilterQuery(searchRequest.assigneeFilter))
        }

        if (!searchRequest.statusFilter.isNullOrEmpty()) {
            parts.add(buildStatusFilterQuery(searchRequest.statusFilter))
        }

        if (!searchRequest.caseTagsFilter.isNullOrEmpty()) {
            val tagValues = searchRequest.caseTagsFilter.map { FieldValue.of(it) }
            parts.add(Query.of { q -> q.terms { t -> t.field("caseTags.key").terms { tv -> tv.value(tagValues) } } })
        }

        if (!searchRequest.otherFilters.isNullOrEmpty()) {
            parts.add(buildOtherFiltersQuery(searchRequest.otherFilters, searchRequest.searchOperator))
        }

        val globalFilter = searchRequest.globalSearchFilter?.takeIf { it.isNotEmpty() }
        if (globalFilter != null) {
            // Use wildcard on contentText.keyword for partial-match behaviour equivalent to MongoDB text index
            parts.add(Query.of { q ->
                q.wildcard { w -> w.field("contentText.keyword").value("*${globalFilter.trim()}*").caseInsensitive(true) }
            })
        }

        return andAll(parts)
    }

    private fun buildAuthQuery(action: Action<JsonSchemaDocument>): Query {
        val userRoles = SecurityUtils.getCurrentUserRoles().toSet()
        val permissions = authorizationService.getPermissions(JsonSchemaDocument::class.java, action)
            .filter { it.role.key in userRoles }
        return translator.toQuery(permissions, action)
    }

    private fun buildAssigneeFilterQuery(filter: AssigneeFilter): Query {
        val userId = userManagementService.currentUser.username
        return when (filter) {
            AssigneeFilter.MINE -> termQuery("assigneeId", userId)
            AssigneeFilter.OPEN -> Query.of { q ->
                q.bool { b -> b.mustNot(Query.of { q2 -> q2.exists { e -> e.field("assigneeId") } }) }
            }
            else -> Query.of { q -> q.matchAll { m -> m } }
        }
    }

    private fun buildStatusFilterQuery(statusKeys: Set<String?>): Query {
        val conditions = statusKeys.map { key ->
            if (key.isNullOrEmpty()) {
                Query.of { q -> q.bool { b -> b.mustNot(Query.of { q2 -> q2.exists { e -> e.field("internalStatus") } }) } }
            } else {
                termQuery("internalStatus", key)
            }
        }
        return if (conditions.size == 1) conditions.first()
        else Query.of { q -> q.bool { b -> b.should(conditions).minimumShouldMatch("1") } }
    }

    private fun buildOtherFiltersQuery(
        filters: List<AdvancedSearchRequest.OtherFilter>,
        operator: SearchOperator?
    ): Query {
        val filterQueries = filters.map { buildSingleFilterQuery(it) }
        return if (operator == SearchOperator.OR) {
            Query.of { q -> q.bool { b -> b.should(filterQueries).minimumShouldMatch("1") } }
        } else {
            andAll(filterQueries)
        }
    }

    private fun buildSingleFilterQuery(filter: AdvancedSearchRequest.OtherFilter): Query {
        val isDocField = filter.path.startsWith(DOC_PREFIX)
        val baseField = when {
            isDocField -> "content.${filter.path.removePrefix(DOC_PREFIX)}"
            filter.path.startsWith(CASE_PREFIX) -> filter.path.removePrefix(CASE_PREFIX)
            else -> throw IllegalArgumentException("Search path doesn't start with known prefix: '${filter.path}'")
        }
        // For doc: fields, string equality/like/in queries should target the .keyword sub-field
        // (OpenSearch auto-maps string content fields as text with .keyword sub-field)
        val keywordField = if (isDocField) "$baseField.keyword" else baseField

        return when (filter.searchType) {
            DatabaseSearchType.EQUAL -> {
                val values = filter.getValues<Any>()
                when {
                    values.isEmpty() -> Query.of { q -> q.matchAll { m -> m } }
                    values.size == 1 -> applyEqualQuery(keywordField, baseField, values[0])
                    else -> Query.of { q ->
                        q.bool { b ->
                            b.should(values.map { applyEqualQuery(keywordField, baseField, it) }).minimumShouldMatch("1")
                        }
                    }
                }
            }
            DatabaseSearchType.LIKE -> {
                val values = filter.getValues<Any>()
                when {
                    values.isEmpty() -> Query.of { q -> q.matchAll { m -> m } }
                    values.size == 1 -> applyLikeQuery(keywordField, values[0])
                    else -> Query.of { q ->
                        q.bool { b ->
                            b.should(values.map { applyLikeQuery(keywordField, it) }).minimumShouldMatch("1")
                        }
                    }
                }
            }
            DatabaseSearchType.IN -> {
                val fieldValues = filter.getValues<Any>().map { OpenSearchPermissionConditionTranslator.toFieldValue(it) }
                Query.of { q -> q.terms { t -> t.field(keywordField).terms { tv -> tv.value(fieldValues) } } }
            }
            DatabaseSearchType.GREATER_THAN_OR_EQUAL_TO ->
                Query.of { q -> q.range { r -> r.untyped { u -> u.field(baseField).gte(JsonData.of(filter.rangeFromValue()!!)) } } }
            DatabaseSearchType.LESS_THAN_OR_EQUAL_TO ->
                Query.of { q -> q.range { r -> r.untyped { u -> u.field(baseField).lte(JsonData.of(filter.rangeToValue()!!)) } } }
            DatabaseSearchType.BETWEEN ->
                Query.of { q ->
                    q.range { r ->
                        r.untyped { u ->
                            u.field(baseField)
                                .gte(JsonData.of(filter.rangeFromValue()!!))
                                .lte(JsonData.of(filter.rangeToValue()!!))
                        }
                    }
                }
            else -> throw NotImplementedException("Search type '${filter.searchType}' is not supported in the OpenSearch search service")
        }
    }

    private fun applyEqualQuery(keywordField: String, baseField: String, value: Any?): Query {
        return if (value is String) {
            // Case-insensitive exact match using TermQuery with caseInsensitive flag
            Query.of { q ->
                q.term { t -> t.field(keywordField).value(FieldValue.of(value.trim())).caseInsensitive(true) }
            }
        } else {
            Query.of { q -> q.term { t -> t.field(baseField).value(OpenSearchPermissionConditionTranslator.toFieldValue(value)) } }
        }
    }

    private fun applyLikeQuery(keywordField: String, value: Any?): Query {
        if (value !is String) {
            throw IllegalArgumentException("LIKE search requires String values, got: ${value?.javaClass?.simpleName}")
        }
        return Query.of { q ->
            q.wildcard { w -> w.field(keywordField).value("*${value.trim()}*").caseInsensitive(true) }
        }
    }

    private fun executeSearch(combinedQuery: Query, pageable: Pageable): Page<JsonSchemaDocument> {
        val translatedSort = translateSort(pageable.sort)
        val effectivePageable = if (pageable.isPaged) {
            PageRequest.of(pageable.pageNumber, pageable.pageSize, translatedSort)
        } else {
            Pageable.unpaged(translatedSort)
        }

        val countQuery = NativeQuery.builder().withQuery(combinedQuery).build()
        val dataQuery = NativeQuery.builder().withQuery(combinedQuery).withPageable(effectivePageable).build()

        val total = elasticsearchOperations.count(countQuery, JsonSchemaDocumentOsDocument::class.java)
        val hits = elasticsearchOperations.search(dataQuery, JsonSchemaDocumentOsDocument::class.java)
        val ids = hits.searchHits.map { it.id }

        val docIds = ids.map { JsonSchemaDocumentId.existingId(it) }
        val entities = runWithoutAuthorization { jpaRepository.findAllById(docIds) }
        val entityMap = entities.associateBy { it.id().toString() }
        val orderedEntities = ids.mapNotNull { entityMap[it] }

        outboxService.send { DocumentsListed(objectMapper.valueToTree<ArrayNode>(orderedEntities)) }

        return PageImpl(orderedEntities, pageable, total)
    }

    private fun translateSort(sort: Sort): Sort {
        if (sort.isUnsorted) return sort
        val orders = sort.map { order ->
            val osField = when {
                order.property.startsWith(DOC_PREFIX) -> "content.${order.property.removePrefix(DOC_PREFIX)}"
                order.property.startsWith(CASE_PREFIX) -> order.property.removePrefix(CASE_PREFIX)
                else -> order.property
            }
            if (order.isAscending) Sort.Order.asc(osField) else Sort.Order.desc(osField)
        }.toList()
        return Sort.by(orders)
    }

    private fun termQuery(field: String, value: String): Query =
        Query.of { q -> q.term { t -> t.field(field).value(FieldValue.of(value)) } }

    companion object {
        private const val DOC_PREFIX = "doc:"
        private const val CASE_PREFIX = "case:"
        private const val DEFINITION_NAME_FIELD = "definitionId.name"
        private const val BLUEPRINT_TYPE_FIELD = "definitionId.blueprintId.blueprintType"

        /**
         * Calls [AdvancedSearchRequest.OtherFilter.getRangeFrom] via reflection to bypass the
         * Kotlin type-bounds check.
         */
        private fun AdvancedSearchRequest.OtherFilter.rangeFromValue(): Any? =
            AdvancedSearchRequest.OtherFilter::class.java.getMethod("getRangeFrom").invoke(this)

        private fun AdvancedSearchRequest.OtherFilter.rangeToValue(): Any? =
            AdvancedSearchRequest.OtherFilter::class.java.getMethod("getRangeTo").invoke(this)
    }
}
