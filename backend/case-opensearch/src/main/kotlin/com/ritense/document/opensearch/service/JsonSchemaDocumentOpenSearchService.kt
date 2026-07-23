/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import com.ritense.case.service.CaseDefinitionService
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
import com.ritense.document.domain.impl.searchfield.SearchField
import com.ritense.document.domain.impl.searchfield.SearchFieldDataType
import com.ritense.document.domain.impl.searchfield.SearchFieldMatchType
import com.ritense.valtimo.contract.utils.SecurityUtils
import org.apache.commons.lang3.NotImplementedException
import org.opensearch.index.query.Operator
import org.opensearch.index.query.QueryBuilder
import org.opensearch.index.query.QueryBuilders
import org.opensearch.search.sort.SortBuilders
import org.opensearch.search.sort.SortOrder
import org.opensearch.data.client.orhlc.NativeSearchQueryBuilder
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.query.StringQuery
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.transaction.annotation.Transactional

private val logger = KotlinLogging.logger {}

@Transactional
class JsonSchemaDocumentOpenSearchService(
    private val elasticsearchOperations: ElasticsearchOperations,
    private val translator: OpenSearchPermissionConditionTranslator,
    private val authorizationService: AuthorizationService,
    private val jpaRepository: JsonSchemaDocumentRepository,
    private val userManagementService: UserManagementService,
    private val searchFieldService: SearchFieldService,
    private val outboxService: OutboxService,
    private val objectMapper: ObjectMapper,
    private val caseDefinitionService: CaseDefinitionService,
) : DocumentSearchService {

    override fun search(
        searchRequest: SearchRequest,
        blueprintType: BlueprintType,
        pageable: Pageable
    ): Page<JsonSchemaDocument> {
        val parts = mutableListOf<QueryBuilder>()

        parts.add(buildAuthQuery(JsonSchemaDocumentActionProvider.VIEW_LIST))
        parts.add(QueryBuilders.termQuery(BLUEPRINT_TYPE_FIELD, blueprintType.name))

        if (!searchRequest.documentDefinitionName.isNullOrEmpty()) {
            parts.add(QueryBuilders.termQuery(DEFINITION_NAME_FIELD, searchRequest.documentDefinitionName))
        }
        if (!searchRequest.createdBy.isNullOrEmpty()) {
            parts.add(QueryBuilders.termQuery("createdBy", searchRequest.createdBy))
        }
        if (searchRequest.sequence != null) {
            parts.add(QueryBuilders.termQuery("sequence", searchRequest.sequence))
        }
        val globalFilter = searchRequest.globalSearchFilter?.takeIf { it.isNotEmpty() }
        if (globalFilter != null) {
            if (!searchRequest.documentDefinitionName.isNullOrEmpty()) {
                val searchFields = runWithoutAuthorization {
                    searchFieldService.getSearchFields(searchRequest.documentDefinitionName)
                }
                if (searchFields.isNotEmpty()) {
                    parts.add(buildGlobalSearchQuery(globalFilter.trim(), searchFields))
                } else {
                    parts.add(MATCH_NONE)
                }
            } else {
                val scopedQuery = buildGlobalSearchQueryForAllDefinitions(globalFilter.trim())
                parts.add(scopedQuery)
            }
        }
        searchRequest.otherFilters?.forEach { sc ->
            parts.add(QueryBuilders.termQuery("content.${sc.path}", sc.value))
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
        val countQuery = StringQuery(combinedQuery.toString())
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
    ): QueryBuilder {
        val parts = mutableListOf<QueryBuilder>()

        parts.add(buildAuthQuery(action))
        parts.add(QueryBuilders.termQuery(BLUEPRINT_TYPE_FIELD, blueprintType.name))

        if (!documentDefinitionName.isNullOrEmpty()) {
            parts.add(QueryBuilders.termQuery(DEFINITION_NAME_FIELD, documentDefinitionName))
        }

        if (searchRequest.assigneeFilter != null && searchRequest.assigneeFilter != AssigneeFilter.ALL) {
            parts.add(buildAssigneeFilterQuery(searchRequest.assigneeFilter))
        }

        if (!searchRequest.statusFilter.isNullOrEmpty()) {
            parts.add(buildStatusFilterQuery(searchRequest.statusFilter))
        }

        if (!searchRequest.caseTagsFilter.isNullOrEmpty()) {
            parts.add(QueryBuilders.termsQuery("caseTags.key", searchRequest.caseTagsFilter.toList()))
        }

        if (!searchRequest.otherFilters.isNullOrEmpty()) {
            parts.add(buildOtherFiltersQuery(searchRequest.otherFilters, searchRequest.searchOperator))
        }

        val globalFilter = searchRequest.globalSearchFilter?.takeIf { it.isNotEmpty() }
        if (globalFilter != null) {
            if (!documentDefinitionName.isNullOrEmpty()) {
                val searchFields = runWithoutAuthorization {
                    searchFieldService.getSearchFields(documentDefinitionName)
                }
                if (searchFields.isNotEmpty()) {
                    parts.add(buildGlobalSearchQuery(globalFilter.trim(), searchFields))
                } else {
                    parts.add(MATCH_NONE)
                }
            } else {
                val scopedQuery = buildGlobalSearchQueryForAllDefinitions(globalFilter.trim())
                parts.add(scopedQuery)
            }
        }

        return andAll(parts)
    }

    private fun buildAuthQuery(action: Action<JsonSchemaDocument>): QueryBuilder {
        val userRoles = SecurityUtils.getCurrentUserRoles().toSet()
        val permissions = authorizationService.getPermissions(JsonSchemaDocument::class.java, action)
            .filter { it.role.key in userRoles }
        return translator.toQuery(permissions, action)
    }

    private fun buildAssigneeFilterQuery(filter: AssigneeFilter): QueryBuilder {
        val userId = userManagementService.currentUser.username
        return when (filter) {
            AssigneeFilter.MINE -> QueryBuilders.termQuery("assigneeId", userId)
            AssigneeFilter.OPEN -> QueryBuilders.boolQuery().mustNot(QueryBuilders.existsQuery("assigneeId"))
            else -> QueryBuilders.matchAllQuery()
        }
    }

    private fun buildStatusFilterQuery(statusKeys: Set<String?>): QueryBuilder {
        val conditions = statusKeys.map { key ->
            if (key.isNullOrEmpty()) {
                QueryBuilders.boolQuery().mustNot(QueryBuilders.existsQuery("internalStatus"))
            } else {
                QueryBuilders.termQuery("internalStatus", key)
            }
        }
        return if (conditions.size == 1) conditions.first()
        else QueryBuilders.boolQuery().apply {
            conditions.forEach { should(it) }
            minimumShouldMatch(1)
        }
    }

    private fun buildOtherFiltersQuery(
        filters: List<AdvancedSearchRequest.OtherFilter>,
        operator: SearchOperator?
    ): QueryBuilder {
        val filterQueries = filters.map { buildSingleFilterQuery(it) }
        return if (operator == SearchOperator.OR) {
            QueryBuilders.boolQuery().apply {
                filterQueries.forEach { should(it) }
                minimumShouldMatch(1)
            }
        } else {
            andAll(filterQueries)
        }
    }

    private fun buildSingleFilterQuery(filter: AdvancedSearchRequest.OtherFilter): QueryBuilder {
        val isDocField = filter.path.startsWith(DOC_PREFIX)
        val baseField = when {
            isDocField -> "content.${filter.path.removePrefix(DOC_PREFIX)}"
            filter.path.startsWith(CASE_PREFIX) -> filter.path.removePrefix(CASE_PREFIX)
            else -> throw IllegalArgumentException("Search path doesn't start with known prefix: '${filter.path}'")
        }
        // For doc: fields, string equality/like/in queries should target the .keyword sub-field
        val keywordField = if (isDocField) "$baseField.keyword" else baseField

        return when (filter.searchType) {
            DatabaseSearchType.EQUAL -> {
                val values = filter.getValues<Any>()
                when {
                    values.isEmpty() -> QueryBuilders.matchAllQuery()
                    values.size == 1 -> applyEqualQuery(keywordField, baseField, values[0])
                    else -> QueryBuilders.boolQuery().apply {
                        values.forEach { should(applyEqualQuery(keywordField, baseField, it)) }
                        minimumShouldMatch(1)
                    }
                }
            }
            DatabaseSearchType.LIKE -> {
                val values = filter.getValues<Any>()
                when {
                    values.isEmpty() -> QueryBuilders.matchAllQuery()
                    values.size == 1 -> applyLikeQuery(keywordField, values[0])
                    else -> QueryBuilders.boolQuery().apply {
                        values.forEach { should(applyLikeQuery(keywordField, it)) }
                        minimumShouldMatch(1)
                    }
                }
            }
            DatabaseSearchType.IN -> QueryBuilders.termsQuery(keywordField, filter.getValues<Any>())
            DatabaseSearchType.GREATER_THAN_OR_EQUAL_TO ->
                QueryBuilders.rangeQuery(baseField).gte(formatInstantForOpenSearch(filter.rangeFromValue()!! as Instant))
            DatabaseSearchType.LESS_THAN_OR_EQUAL_TO ->
                QueryBuilders.rangeQuery(baseField).lte(formatInstantForOpenSearch(filter.rangeToValue()!! as Instant))
            DatabaseSearchType.BETWEEN ->
                QueryBuilders.rangeQuery(baseField).gte(formatInstantForOpenSearch(filter.rangeFromValue()!! as Instant)).lte(formatInstantForOpenSearch(filter.rangeToValue()!! as Instant))
            else -> throw NotImplementedException("Search type '${filter.searchType}' is not supported in the OpenSearch search service")
        }
    }

    private fun applyEqualQuery(keywordField: String, baseField: String, value: Any?): QueryBuilder {
        return if (value is String) {
            // Case-insensitive exact match using term query with caseInsensitive flag
            QueryBuilders.termQuery(keywordField, value.trim()).caseInsensitive(true)
        } else {
            QueryBuilders.termQuery(baseField, value)
        }
    }

    private fun applyLikeQuery(keywordField: String, value: Any?): QueryBuilder {
        if (value !is String) {
            throw IllegalArgumentException("LIKE search requires String values, got: ${value?.javaClass?.simpleName}")
        }
        return QueryBuilders.wildcardQuery(keywordField, "*${value.trim()}*").caseInsensitive(true)
    }

    private fun formatInstantForOpenSearch(instant: Instant): String {
        return DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSS")
            .withZone(ZoneOffset.UTC)
            .format(instant)
    }

    private fun parseDateRange(dateValue: String): Pair<String, String> {
        val date = LocalDate.parse(dateValue)
        val startOfDay = date.atStartOfDay().atZone(ZoneOffset.UTC).toInstant()
        val endOfDay = date.plusDays(1).atStartOfDay().atZone(ZoneOffset.UTC).toInstant()
        return Pair(
            formatInstantForOpenSearch(startOfDay),
            formatInstantForOpenSearch(endOfDay)
        )
    }

    private fun executeSearch(combinedQuery: QueryBuilder, pageable: Pageable): Page<JsonSchemaDocument> {
        val queryBuilder = NativeSearchQueryBuilder()
            .withQuery(combinedQuery)
            .withTrackTotalHitsUpTo(Int.MAX_VALUE)

        if (pageable.isPaged) {
            queryBuilder.withPageable(PageRequest.of(pageable.pageNumber, pageable.pageSize))
        }

        if (pageable.sort.isSorted) {
            pageable.sort.forEach { order ->
                val osField = when {
                    order.property.startsWith(DOC_PREFIX) -> "content.${order.property.removePrefix(DOC_PREFIX)}.keyword"
                    order.property.startsWith(CASE_PREFIX) -> order.property.removePrefix(CASE_PREFIX)
                    else -> order.property
                }
                val sortOrder = if (order.isAscending) SortOrder.ASC else SortOrder.DESC
                val sortBuilder = SortBuilders.fieldSort(osField)
                    .order(sortOrder)
                    .unmappedType("keyword")
                queryBuilder.withSorts(sortBuilder)
                logger.info { "executeSearch: adding sort $osField $sortOrder" }
            }
        }

        val dataQuery = queryBuilder.build()
        val hits = elasticsearchOperations.search(dataQuery, JsonSchemaDocumentOsDocument::class.java)
        val total = hits.totalHits
        val ids: List<String> = hits.searchHits.mapNotNull { it.id }
        logger.info { "executeSearch: returned ${ids.size} IDs in order: $ids" }

        val docIds = ids.map { JsonSchemaDocumentId.existingId(it) }
        val entities = runWithoutAuthorization { jpaRepository.findAllById(docIds) }
        val entityMap = entities.associateBy { it.id().toString() }
        val orderedEntities = ids.mapNotNull { entityMap[it] }

        outboxService.send { DocumentsListed(objectMapper.valueToTree<ArrayNode>(orderedEntities)) }

        return PageImpl(orderedEntities, pageable, total)
    }


    private fun buildGlobalSearchQuery(query: String, searchFields: List<SearchField>): QueryBuilder {
        val fieldMap = searchFields.associateBy { removePrefixes(it.path) }
        val docFieldsLike = searchFields
            .filter { it.path?.startsWith(DOC_PREFIX) == true }
            .filter { it.matchType == SearchFieldMatchType.LIKE }
            .map { "content.${it.path?.removePrefix(DOC_PREFIX)}" }
        val docFieldsExact = searchFields
            .filter { it.path?.startsWith(DOC_PREFIX) == true }
            .filter { it.matchType != SearchFieldMatchType.LIKE }
            .map { "content.${it.path?.removePrefix(DOC_PREFIX)}" }
        val caseFieldsLike = searchFields
            .filter { it.path?.startsWith(CASE_PREFIX) == true }
            .filter { it.dataType == SearchFieldDataType.TEXT }
            .filter { it.matchType == SearchFieldMatchType.LIKE }
            .mapNotNull { it.path?.removePrefix(CASE_PREFIX) }
        val caseFieldsExact = searchFields
            .filter { it.path?.startsWith(CASE_PREFIX) == true }
            .filter { it.dataType == SearchFieldDataType.TEXT }
            .filter { it.matchType != SearchFieldMatchType.LIKE }
            .mapNotNull { it.path?.removePrefix(CASE_PREFIX) }

        val parsedTerms = parseGlobalSearch(query)

        val unknownFields = parsedTerms
            .filter { it.field != null }
            .map { removePrefixes(it.field) }
            .filter { fieldMap[it] == null }
            .distinct()

        if (unknownFields.isNotEmpty()) {
            throw IllegalArgumentException(
                "Unknown search field(s): ${unknownFields.joinToString(", ")}"
            )
        }

        val qualifiedQueries = mutableListOf<QueryBuilder>()
        val perTermQueries = mutableListOf<QueryBuilder>()

        parsedTerms.forEach { term ->
            if (term.field != null) {
                val fieldPath = removePrefixes(term.field)
                val field = fieldMap[fieldPath]!!
                val isDocField = field.path?.startsWith(DOC_PREFIX) == true
                val osPath = if (isDocField) "content.$fieldPath" else fieldPath

                if (!isDocField) {
                    if (field.dataType == SearchFieldDataType.DATE || field.dataType == SearchFieldDataType.DATETIME) {
                        val dateRange = parseDateRange(term.value)
                        qualifiedQueries.add(
                            QueryBuilders.rangeQuery(osPath)
                                .gte(dateRange.first)
                                .lte(dateRange.second)
                        )
                    } else {
                        val pattern = if (!term.quoted && field.matchType == SearchFieldMatchType.LIKE) {
                            "*${term.value}*"
                        } else {
                            term.value
                        }
                        qualifiedQueries.add(
                            QueryBuilders.wildcardQuery(osPath, pattern).caseInsensitive(true)
                        )
                    }
                } else {
                    val value = escapeQueryStringValue(term.value)
                    val wrappedValue = if (!term.quoted && field.matchType == SearchFieldMatchType.LIKE) {
                        "*$value*"
                    } else if (term.quoted) {
                        "\"$value\""
                    } else {
                        value
                    }
                    val queryString = "$osPath:$wrappedValue"
                    val analyzeWildcard = field.matchType == SearchFieldMatchType.LIKE
                    qualifiedQueries.add(
                        QueryBuilders.queryStringQuery(queryString)
                            .field(osPath)
                            .lenient(true)
                            .analyzeWildcard(analyzeWildcard)
                    )
                }
            } else {
                val termShouldQueries = mutableListOf<QueryBuilder>()

                if (docFieldsLike.isNotEmpty()) {
                    val escaped = escapeQueryStringValue(term.value)
                    val pattern = if (term.quoted) "\"$escaped\"" else "*$escaped*"
                    termShouldQueries.add(
                        QueryBuilders.queryStringQuery(pattern)
                            .apply { docFieldsLike.forEach { field(it) } }
                            .lenient(true)
                            .analyzeWildcard(true)
                    )
                }

                if (docFieldsExact.isNotEmpty()) {
                    val escaped = escapeQueryStringValue(term.value)
                    val pattern = if (term.quoted) "\"$escaped\"" else escaped
                    termShouldQueries.add(
                        QueryBuilders.queryStringQuery(pattern)
                            .apply { docFieldsExact.forEach { field(it) } }
                            .lenient(true)
                            .analyzeWildcard(false)
                    )
                }

                caseFieldsLike.forEach { caseField ->
                    val pattern = "*${term.value}*"
                    termShouldQueries.add(
                        QueryBuilders.wildcardQuery(caseField, pattern).caseInsensitive(true)
                    )
                }

                caseFieldsExact.forEach { caseField ->
                    termShouldQueries.add(
                        QueryBuilders.termQuery(caseField, term.value).caseInsensitive(true)
                    )
                }

                if (termShouldQueries.isNotEmpty()) {
                    if (termShouldQueries.size == 1) {
                        perTermQueries.add(termShouldQueries.first())
                    } else {
                        val termBool = QueryBuilders.boolQuery()
                        termShouldQueries.forEach { termBool.should(it) }
                        termBool.minimumShouldMatch(1)
                        perTermQueries.add(termBool)
                    }
                }
            }
        }

        if (qualifiedQueries.isEmpty() && perTermQueries.isEmpty()) {
            return QueryBuilders.matchAllQuery()
        }

        val boolQuery = QueryBuilders.boolQuery()
        qualifiedQueries.forEach { boolQuery.must(it) }
        perTermQueries.forEach { boolQuery.must(it) }

        return boolQuery
    }

    private fun buildGlobalSearchQueryForAllDefinitions(query: String): QueryBuilder {
        val accessibleDefinitions = caseDefinitionService.getCaseDefinitions(active = true)
        if (accessibleDefinitions.isEmpty()) {
            return MATCH_NONE
        }

        val definitionQueries = accessibleDefinitions.mapNotNull { definition ->
            val searchFields = runWithoutAuthorization {
                searchFieldService.getSearchFields(definition.id.key)
            }
            if (searchFields.isEmpty()) {
                null
            } else {
                QueryBuilders.boolQuery()
                    .must(QueryBuilders.termQuery(DEFINITION_NAME_FIELD, definition.id.key))
                    .must(buildGlobalSearchQuery(query, searchFields))
            }
        }

        if (definitionQueries.isEmpty()) {
            return MATCH_NONE
        }

        return QueryBuilders.boolQuery().apply {
            definitionQueries.forEach { should(it) }
            minimumShouldMatch(1)
        }
    }

    private data class ParsedTerm(
        val field: String?,
        val value: String,
        val quoted: Boolean
    )

    private fun parseGlobalSearch(query: String): List<ParsedTerm> {
        val terms = mutableListOf<ParsedTerm>()
        val fieldPattern = """(\w+(?:\.\w+)*):("([^"]+)"|(\S+))""".toRegex()

        var remaining = query
        var lastEnd = 0

        for (match in fieldPattern.findAll(query)) {
            val before = query.substring(lastEnd, match.range.first).trim()
            if (before.isNotEmpty()) {
                terms.addAll(parseUnqualifiedTerms(before))
            }

            val fieldName = match.groupValues[1]
            val quoted = match.groupValues[3].isNotEmpty()
            val value = if (quoted) match.groupValues[3] else match.groupValues[4]

            terms.add(ParsedTerm(fieldName, value, quoted))
            lastEnd = match.range.last + 1
        }

        val after = query.substring(lastEnd).trim()
        if (after.isNotEmpty()) {
            terms.addAll(parseUnqualifiedTerms(after))
        }

        return terms
    }

    private fun parseUnqualifiedTerms(text: String): List<ParsedTerm> {
        val terms = mutableListOf<ParsedTerm>()
        val quotedPattern = """"([^"]+)"""".toRegex()

        var remaining = text
        var lastEnd = 0

        for (match in quotedPattern.findAll(text)) {
            val before = text.substring(lastEnd, match.range.first).trim()
            if (before.isNotEmpty()) {
                before.split("\\s+".toRegex()).filter { it.isNotEmpty() }.forEach {
                    terms.add(ParsedTerm(null, it, false))
                }
            }
            terms.add(ParsedTerm(null, match.groupValues[1], true))
            lastEnd = match.range.last + 1
        }

        val after = text.substring(lastEnd).trim()
        if (after.isNotEmpty()) {
            after.split("\\s+".toRegex()).filter { it.isNotEmpty() }.forEach {
                terms.add(ParsedTerm(null, it, false))
            }
        }

        return terms
    }

    private fun escapeQueryStringValue(value: String): String {
        val specialChars = """[\+\-\=\&\|\!\(\)\{\}\[\]\^\~\*\?\:\\\/]""".toRegex()
        return value.replace(specialChars) { "\\${it.value}" }
    }

    private fun removePrefixes(path: String?): String? {
        return path?.removePrefix(DOC_PREFIX)?.removePrefix(CASE_PREFIX)
    }

    companion object {
        private const val DOC_PREFIX = "doc:"
        private const val CASE_PREFIX = "case:"
        private const val DEFINITION_NAME_FIELD = "definitionId.name"
        private const val BLUEPRINT_TYPE_FIELD = "definitionId.blueprintId.blueprintType"
        private val MATCH_NONE: QueryBuilder = QueryBuilders.boolQuery().mustNot(QueryBuilders.matchAllQuery())

        private fun AdvancedSearchRequest.OtherFilter.rangeFromValue(): Any? =
            AdvancedSearchRequest.OtherFilter::class.java.getMethod("getRangeFrom").invoke(this)

        private fun AdvancedSearchRequest.OtherFilter.rangeToValue(): Any? =
            AdvancedSearchRequest.OtherFilter::class.java.getMethod("getRangeTo").invoke(this)
    }
}
