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

package com.ritense.document.mongodb.service

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
import com.ritense.document.mongodb.authorization.MongoPermissionConditionTranslator
import com.ritense.document.mongodb.domain.JsonSchemaDocumentDocument
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
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.TextCriteria
import java.util.regex.Pattern

class JsonSchemaDocumentMongoSearchService(
    private val mongoTemplate: MongoTemplate,
    private val translator: MongoPermissionConditionTranslator,
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
        val parts = mutableListOf<Criteria>()

        parts.add(buildAuthCriteria(JsonSchemaDocumentActionProvider.VIEW_LIST))
        parts.add(Criteria.where(BLUEPRINT_TYPE_FIELD).`is`(blueprintType.name))

        if (!searchRequest.documentDefinitionName.isNullOrEmpty()) {
            parts.add(Criteria.where(DEFINITION_NAME_FIELD).`is`(searchRequest.documentDefinitionName))
        }
        if (!searchRequest.createdBy.isNullOrEmpty()) {
            parts.add(Criteria.where("createdBy").`is`(searchRequest.createdBy))
        }
        if (searchRequest.sequence != null) {
            parts.add(Criteria.where("sequence").`is`(searchRequest.sequence))
        }
        if (!searchRequest.globalSearchFilter.isNullOrEmpty()) {
            throw NotImplementedException("globalSearchFilter is not supported in the MongoDB search service")
        }
        searchRequest.otherFilters?.forEach { sc ->
            parts.add(Criteria.where("content.${sc.path}").`is`(sc.value))
        }

        return executeSearch(Criteria().andOperator(*parts.toTypedArray()), null, pageable)
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
        val (criteria, textCriteria) = buildCombinedCriteria(
            documentDefinitionName,
            blueprintType,
            advancedSearchRequest,
            JsonSchemaDocumentActionProvider.VIEW_LIST
        )
        val query = Query(criteria)
        textCriteria?.let { query.addCriteria(it) }
        return mongoTemplate.count(query, JsonSchemaDocumentDocument::class.java)
    }

    private fun search(
        documentDefinitionName: String,
        blueprintType: BlueprintType,
        advancedSearchRequest: AdvancedSearchRequest,
        pageable: Pageable,
        action: Action<JsonSchemaDocument>
    ): Page<JsonSchemaDocument> {
        SearchRequestValidator.validate(advancedSearchRequest)
        val (criteria, textCriteria) = buildCombinedCriteria(documentDefinitionName, blueprintType, advancedSearchRequest, action)
        return executeSearch(criteria, textCriteria, pageable)
    }

    private fun buildCombinedCriteria(
        documentDefinitionName: String?,
        blueprintType: BlueprintType,
        searchRequest: AdvancedSearchRequest,
        action: Action<JsonSchemaDocument>
    ): Pair<Criteria, TextCriteria?> {
        val parts = mutableListOf<Criteria>()

        parts.add(buildAuthCriteria(action))
        parts.add(Criteria.where(BLUEPRINT_TYPE_FIELD).`is`(blueprintType.name))

        if (!documentDefinitionName.isNullOrEmpty()) {
            parts.add(Criteria.where(DEFINITION_NAME_FIELD).`is`(documentDefinitionName))
        }

        if (searchRequest.assigneeFilter != null && searchRequest.assigneeFilter != AssigneeFilter.ALL) {
            parts.add(buildAssigneeFilterCriteria(searchRequest.assigneeFilter))
        }

        if (!searchRequest.statusFilter.isNullOrEmpty()) {
            parts.add(buildStatusFilterCriteria(searchRequest.statusFilter))
        }

        if (!searchRequest.caseTagsFilter.isNullOrEmpty()) {
            parts.add(Criteria.where("caseTags.key").`in`(searchRequest.caseTagsFilter))
        }

        if (!searchRequest.otherFilters.isNullOrEmpty()) {
            parts.add(buildOtherFiltersCriteria(searchRequest.otherFilters, searchRequest.searchOperator))
        }

        val textCriteria = searchRequest.globalSearchFilter
            ?.takeIf { it.isNotEmpty() }
            ?.let { TextCriteria.forDefaultLanguage().matching(it.trim()) }

        return Criteria().andOperator(*parts.toTypedArray()) to textCriteria
    }

    private fun buildAuthCriteria(action: Action<JsonSchemaDocument>): Criteria {
        val userRoles = SecurityUtils.getCurrentUserRoles().toSet()
        val permissions = authorizationService.getPermissions(JsonSchemaDocument::class.java, action)
            .filter { it.role.key in userRoles }
        return translator.toCriteria(permissions, action)
    }

    private fun buildAssigneeFilterCriteria(filter: AssigneeFilter): Criteria {
        val userId = userManagementService.currentUser.username
        return when (filter) {
            AssigneeFilter.MINE -> Criteria.where("assigneeId").`is`(userId)
            AssigneeFilter.OPEN -> Criteria.where("assigneeId").isNull()
            else -> Criteria()
        }
    }

    private fun buildStatusFilterCriteria(statusKeys: Set<String?>): Criteria {
        val conditions = statusKeys.map { key ->
            if (key.isNullOrEmpty()) Criteria.where("internalStatus").isNull()
            else Criteria.where("internalStatus").`is`(key)
        }
        return if (conditions.size == 1) conditions.first()
        else Criteria().orOperator(*conditions.toTypedArray())
    }

    private fun buildOtherFiltersCriteria(
        filters: List<AdvancedSearchRequest.OtherFilter>,
        operator: SearchOperator?
    ): Criteria {
        val filterCriteria = filters.map { buildSingleFilterCriteria(it) }
        return if (operator == SearchOperator.OR) {
            Criteria().orOperator(*filterCriteria.toTypedArray())
        } else {
            Criteria().andOperator(*filterCriteria.toTypedArray())
        }
    }

    private fun buildSingleFilterCriteria(filter: AdvancedSearchRequest.OtherFilter): Criteria {
        val mongoField = when {
            filter.path.startsWith(DOC_PREFIX) -> "content.${filter.path.removePrefix(DOC_PREFIX)}"
            filter.path.startsWith(CASE_PREFIX) -> filter.path.removePrefix(CASE_PREFIX)
            else -> throw IllegalArgumentException("Search path doesn't start with known prefix: '${filter.path}'")
        }

        return when (filter.searchType) {
            DatabaseSearchType.EQUAL -> {
                val values = filter.getValues<Any>()
                when {
                    values.isEmpty() -> Criteria()
                    values.size == 1 -> applyEqualCriteria(Criteria.where(mongoField), values[0])
                    else -> Criteria().orOperator(*values.map { applyEqualCriteria(Criteria.where(mongoField), it) }.toTypedArray())
                }
            }
            DatabaseSearchType.LIKE -> {
                val values = filter.getValues<Any>()
                when {
                    values.isEmpty() -> Criteria()
                    values.size == 1 -> applyLikeCriteria(Criteria.where(mongoField), values[0])
                    else -> Criteria().orOperator(*values.map { applyLikeCriteria(Criteria.where(mongoField), it) }.toTypedArray())
                }
            }
            DatabaseSearchType.IN -> Criteria.where(mongoField).`in`(filter.getValues<Any>())
            DatabaseSearchType.GREATER_THAN_OR_EQUAL_TO -> Criteria.where(mongoField).gte(filter.rangeFromValue()!!)
            DatabaseSearchType.LESS_THAN_OR_EQUAL_TO -> Criteria.where(mongoField).lte(filter.rangeToValue()!!)
            DatabaseSearchType.BETWEEN -> Criteria.where(mongoField).gte(filter.rangeFromValue()!!).lte(filter.rangeToValue()!!)
            else -> throw NotImplementedException("Search type '${filter.searchType}' is not supported in the MongoDB search service")
        }
    }

    private fun applyEqualCriteria(criteria: Criteria, value: Any?): Criteria {
        return if (value is String) {
            criteria.regex("^${Pattern.quote(value.trim())}$", "i")
        } else {
            criteria.`is`(value)
        }
    }

    private fun applyLikeCriteria(criteria: Criteria, value: Any?): Criteria {
        if (value !is String) {
            throw IllegalArgumentException("LIKE search requires String values, got: ${value?.javaClass?.simpleName}")
        }
        return criteria.regex(".*${Pattern.quote(value.trim())}.*", "i")
    }

    private fun executeSearch(combined: Criteria, textCriteria: TextCriteria?, pageable: Pageable): Page<JsonSchemaDocument> {
        val translatedSort = translateSort(pageable.sort)
        val dataQuery = Query(combined).with(translatedSort)
        textCriteria?.let { dataQuery.addCriteria(it) }
        if (pageable.isPaged) {
            dataQuery.with(pageable)
        }

        val countQuery = Query(combined)
        textCriteria?.let { countQuery.addCriteria(it) }
        val total = mongoTemplate.count(countQuery, JsonSchemaDocumentDocument::class.java)

        val ids = mongoTemplate.find(dataQuery, JsonSchemaDocumentDocument::class.java).map { it.id }
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
            val mongoField = when {
                order.property.startsWith(DOC_PREFIX) -> "content.${order.property.removePrefix(DOC_PREFIX)}"
                order.property.startsWith(CASE_PREFIX) -> order.property.removePrefix(CASE_PREFIX)
                else -> order.property
            }
            if (order.isAscending) Sort.Order.asc(mongoField) else Sort.Order.desc(mongoField)
        }.toList()
        return Sort.by(orders)
    }

    companion object {
        private const val DOC_PREFIX = "doc:"
        private const val CASE_PREFIX = "case:"
        private const val DEFINITION_NAME_FIELD = "definitionId.name"
        private const val BLUEPRINT_TYPE_FIELD = "definitionId.blueprintId.blueprintType"

        /**
         * Calls [AdvancedSearchRequest.OtherFilter.getRangeFrom] via reflection to bypass the
         * Kotlin type-bounds check. The Java method signature uses `<T extends Comparable<? super T>>`
         * which Kotlin cannot satisfy with `Any`, but at runtime it just returns the boxed value.
         */
        private fun AdvancedSearchRequest.OtherFilter.rangeFromValue(): Any? =
            AdvancedSearchRequest.OtherFilter::class.java.getMethod("getRangeFrom").invoke(this)

        private fun AdvancedSearchRequest.OtherFilter.rangeToValue(): Any? =
            AdvancedSearchRequest.OtherFilter::class.java.getMethod("getRangeTo").invoke(this)
    }
}
