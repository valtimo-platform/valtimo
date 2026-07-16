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
import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case.service.CaseDefinitionService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.role.Role
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.searchfield.SearchField
import com.ritense.document.domain.impl.searchfield.SearchFieldDataType
import com.ritense.document.domain.impl.searchfield.SearchFieldFieldType
import com.ritense.document.domain.impl.searchfield.SearchFieldMatchType
import com.ritense.document.domain.search.AdvancedSearchRequest
import com.ritense.document.opensearch.authorization.OpenSearchAuthorizationEntityMapper
import com.ritense.document.opensearch.authorization.OpenSearchPermissionConditionTranslator
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.document.service.SearchFieldService
import com.ritense.document.service.impl.SearchRequest
import com.ritense.outbox.OutboxService
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.blueprint.BlueprintType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageRequest
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.SearchHits
import org.springframework.data.elasticsearch.core.query.StringQuery
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder

class JsonSchemaDocumentOpenSearchServiceTest {

    private val elasticsearchOperations: ElasticsearchOperations = mock()
    private val authorizationService: AuthorizationService = mock()
    private val jpaRepository: JsonSchemaDocumentRepository = mock()
    private val userManagementService: UserManagementService = mock()
    private val searchFieldService: SearchFieldService = mock()
    private val outboxService: OutboxService = mock()
    private val objectMapper: ObjectMapper = ObjectMapper()
    private val caseDefinitionService: CaseDefinitionService = mock()

    private lateinit var service: JsonSchemaDocumentOpenSearchService

    @BeforeEach
    fun setUp() {
        val translator = OpenSearchPermissionConditionTranslator(
            openSearchMappers = emptyList<OpenSearchAuthorizationEntityMapper<*, *>>(),
            authorizationService = authorizationService,
            documentRepository = jpaRepository,
        )
        service = JsonSchemaDocumentOpenSearchService(
            elasticsearchOperations = elasticsearchOperations,
            translator = translator,
            authorizationService = authorizationService,
            jpaRepository = jpaRepository,
            userManagementService = userManagementService,
            searchFieldService = searchFieldService,
            outboxService = outboxService,
            objectMapper = objectMapper,
            caseDefinitionService = caseDefinitionService,
        )

        val auth = UsernamePasswordAuthenticationToken(
            USERNAME,
            null,
            listOf(SimpleGrantedAuthority(FULL_ACCESS_ROLE)),
        )
        SecurityContextHolder.getContext().authentication = auth

        val role = Role(key = FULL_ACCESS_ROLE)
        val viewListPermission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(JsonSchemaDocumentActionProvider.VIEW_LIST),
            conditionContainer = ConditionContainer(emptyList()),
            role = role,
        )
        whenever(
            authorizationService.getPermissions(
                eq(JsonSchemaDocument::class.java),
                eq(JsonSchemaDocumentActionProvider.VIEW_LIST),
            )
        ).thenReturn(listOf(viewListPermission))

        val emptySearchHits: SearchHits<JsonSchemaDocumentOsDocument> = mock()
        whenever(emptySearchHits.searchHits).thenReturn(emptyList())
        whenever(emptySearchHits.totalHits).thenReturn(0L)
        whenever(elasticsearchOperations.search(any<StringQuery>(), eq(JsonSchemaDocumentOsDocument::class.java))).thenReturn(emptySearchHits)
        whenever(jpaRepository.findAllById(any())).thenReturn(emptyList())
    }

    @AfterEach
    fun tearDown() {
        SecurityContextHolder.clearContext()
    }

    @Test
    fun `search with globalSearchFilter includes contentText in query`() {
        val queryCaptor = argumentCaptor<StringQuery>()
        val emptySearchHits: SearchHits<JsonSchemaDocumentOsDocument> = mock()
        whenever(emptySearchHits.searchHits).thenReturn(emptyList())
        whenever(emptySearchHits.totalHits).thenReturn(0L)
        whenever(elasticsearchOperations.search(queryCaptor.capture(), eq(JsonSchemaDocumentOsDocument::class.java))).thenReturn(emptySearchHits)

        val request = AdvancedSearchRequest().globalSearchFilter("Amsterdam")
        service.search("house", BlueprintType.CASE, request, PageRequest.of(0, 10))

        val capturedQuery = queryCaptor.firstValue
        assertThat(capturedQuery.source).contains("contentText")
    }

    @Test
    fun `search without globalSearchFilter does not include contentText in query`() {
        val queryCaptor = argumentCaptor<StringQuery>()
        val emptySearchHits: SearchHits<JsonSchemaDocumentOsDocument> = mock()
        whenever(emptySearchHits.searchHits).thenReturn(emptyList())
        whenever(emptySearchHits.totalHits).thenReturn(0L)
        whenever(elasticsearchOperations.search(queryCaptor.capture(), eq(JsonSchemaDocumentOsDocument::class.java))).thenReturn(emptySearchHits)

        val request = AdvancedSearchRequest()
        service.search("house", BlueprintType.CASE, request, PageRequest.of(0, 10))

        val capturedQuery = queryCaptor.firstValue
        assertThat(capturedQuery.source).doesNotContain("contentText")
    }

    @Test
    fun `search with empty globalSearchFilter does not include contentText in query`() {
        val queryCaptor = argumentCaptor<StringQuery>()
        val emptySearchHits: SearchHits<JsonSchemaDocumentOsDocument> = mock()
        whenever(emptySearchHits.searchHits).thenReturn(emptyList())
        whenever(emptySearchHits.totalHits).thenReturn(0L)
        whenever(elasticsearchOperations.search(queryCaptor.capture(), eq(JsonSchemaDocumentOsDocument::class.java))).thenReturn(emptySearchHits)

        val request = AdvancedSearchRequest().globalSearchFilter("")
        service.search("house", BlueprintType.CASE, request, PageRequest.of(0, 10))

        val capturedQuery = queryCaptor.firstValue
        assertThat(capturedQuery.source).doesNotContain("contentText")
    }

    @Test
    fun `search result uses count from opensearch`() {
        val searchHits: SearchHits<JsonSchemaDocumentOsDocument> = mock()
        whenever(searchHits.searchHits).thenReturn(emptyList())
        whenever(searchHits.totalHits).thenReturn(5L)
        whenever(elasticsearchOperations.search(any<StringQuery>(), eq(JsonSchemaDocumentOsDocument::class.java))).thenReturn(searchHits)

        val request = AdvancedSearchRequest().globalSearchFilter("test")
        val page = service.search("house", BlueprintType.CASE, request, PageRequest.of(0, 10))

        assertThat(page.totalElements).isEqualTo(5L)
    }

    @Test
    fun `search with field-qualified term targets specific field`() {
        val queryCaptor = argumentCaptor<StringQuery>()
        val emptySearchHits: SearchHits<JsonSchemaDocumentOsDocument> = mock()
        whenever(emptySearchHits.searchHits).thenReturn(emptyList())
        whenever(emptySearchHits.totalHits).thenReturn(0L)
        whenever(elasticsearchOperations.search(queryCaptor.capture(), eq(JsonSchemaDocumentOsDocument::class.java))).thenReturn(emptySearchHits)
        whenever(searchFieldService.getSearchFields("house")).thenReturn(listOf(
            SearchField("city", "doc:city", SearchFieldDataType.TEXT, SearchFieldFieldType.SINGLE, SearchFieldMatchType.LIKE, null, 0, "City")
        ))

        val request = AdvancedSearchRequest().globalSearchFilter("city:amsterdam")
        service.search("house", BlueprintType.CASE, request, PageRequest.of(0, 10))

        val capturedQuery = queryCaptor.firstValue
        assertThat(capturedQuery.source).contains("content.city")
        assertThat(capturedQuery.source).contains("amsterdam")
    }

    @Test
    fun `search with EXACT match type field does not add wildcards`() {
        val queryCaptor = argumentCaptor<StringQuery>()
        val emptySearchHits: SearchHits<JsonSchemaDocumentOsDocument> = mock()
        whenever(emptySearchHits.searchHits).thenReturn(emptyList())
        whenever(emptySearchHits.totalHits).thenReturn(0L)
        whenever(elasticsearchOperations.search(queryCaptor.capture(), eq(JsonSchemaDocumentOsDocument::class.java))).thenReturn(emptySearchHits)
        whenever(searchFieldService.getSearchFields("house")).thenReturn(listOf(
            SearchField("status", "doc:status", SearchFieldDataType.TEXT, SearchFieldFieldType.SINGLE, SearchFieldMatchType.EXACT, null, 0, "Status")
        ))

        val request = AdvancedSearchRequest().globalSearchFilter("status:active")
        service.search("house", BlueprintType.CASE, request, PageRequest.of(0, 10))

        val capturedQuery = queryCaptor.firstValue
        assertThat(capturedQuery.source).contains("content.status:active")
        assertThat(capturedQuery.source).doesNotContain("*active*")
    }

    @Test
    fun `search with LIKE match type field adds wildcards`() {
        val queryCaptor = argumentCaptor<StringQuery>()
        val emptySearchHits: SearchHits<JsonSchemaDocumentOsDocument> = mock()
        whenever(emptySearchHits.searchHits).thenReturn(emptyList())
        whenever(emptySearchHits.totalHits).thenReturn(0L)
        whenever(elasticsearchOperations.search(queryCaptor.capture(), eq(JsonSchemaDocumentOsDocument::class.java))).thenReturn(emptySearchHits)
        whenever(searchFieldService.getSearchFields("house")).thenReturn(listOf(
            SearchField("name", "doc:name", SearchFieldDataType.TEXT, SearchFieldFieldType.SINGLE, SearchFieldMatchType.LIKE, null, 0, "Name")
        ))

        val request = AdvancedSearchRequest().globalSearchFilter("name:john")
        service.search("house", BlueprintType.CASE, request, PageRequest.of(0, 10))

        val capturedQuery = queryCaptor.firstValue
        assertThat(capturedQuery.source).contains("content.name:*john*")
    }

    @Test
    fun `search with quoted field value does not add wildcards even for LIKE fields`() {
        val queryCaptor = argumentCaptor<StringQuery>()
        val emptySearchHits: SearchHits<JsonSchemaDocumentOsDocument> = mock()
        whenever(emptySearchHits.searchHits).thenReturn(emptyList())
        whenever(emptySearchHits.totalHits).thenReturn(0L)
        whenever(elasticsearchOperations.search(queryCaptor.capture(), eq(JsonSchemaDocumentOsDocument::class.java))).thenReturn(emptySearchHits)
        whenever(searchFieldService.getSearchFields("house")).thenReturn(listOf(
            SearchField("address", "doc:address", SearchFieldDataType.TEXT, SearchFieldFieldType.SINGLE, SearchFieldMatchType.LIKE, null, 0, "Address")
        ))

        val request = AdvancedSearchRequest().globalSearchFilter("""address:"Main Street 123"""")
        service.search("house", BlueprintType.CASE, request, PageRequest.of(0, 10))

        val capturedQuery = queryCaptor.firstValue
        assertThat(capturedQuery.source).contains("""content.address:\"Main Street 123\"""")
        assertThat(capturedQuery.source).doesNotContain("*Main Street 123*")
    }

    @Test
    fun `search with unknown field throws exception listing unknown fields`() {
        whenever(searchFieldService.getSearchFields("house")).thenReturn(listOf(
            SearchField("city", "doc:city", SearchFieldDataType.TEXT, SearchFieldFieldType.SINGLE, SearchFieldMatchType.LIKE, null, 0, "City")
        ))

        val request = AdvancedSearchRequest().globalSearchFilter("unknownField:value anotherBad:x city:amsterdam")

        val exception = org.junit.jupiter.api.assertThrows<IllegalArgumentException> {
            service.search("house", BlueprintType.CASE, request, PageRequest.of(0, 10))
        }

        assertThat(exception.message).contains("unknownField")
        assertThat(exception.message).contains("anotherBad")
    }

    @Test
    fun `search with mixed qualified and unqualified terms`() {
        val queryCaptor = argumentCaptor<StringQuery>()
        val emptySearchHits: SearchHits<JsonSchemaDocumentOsDocument> = mock()
        whenever(emptySearchHits.searchHits).thenReturn(emptyList())
        whenever(emptySearchHits.totalHits).thenReturn(0L)
        whenever(elasticsearchOperations.search(queryCaptor.capture(), eq(JsonSchemaDocumentOsDocument::class.java))).thenReturn(emptySearchHits)
        whenever(searchFieldService.getSearchFields("house")).thenReturn(listOf(
            SearchField("city", "doc:city", SearchFieldDataType.TEXT, SearchFieldFieldType.SINGLE, SearchFieldMatchType.EXACT, null, 0, "City")
        ))

        val request = AdvancedSearchRequest().globalSearchFilter("city:amsterdam urgent")
        service.search("house", BlueprintType.CASE, request, PageRequest.of(0, 10))

        val capturedQuery = queryCaptor.firstValue
        assertThat(capturedQuery.source).contains("content.city:amsterdam")
        assertThat(capturedQuery.source).contains("*urgent*")
    }

    @Test
    fun `global search without definition name builds per-definition scoped query`() {
        val queryCaptor = argumentCaptor<StringQuery>()
        val emptySearchHits: SearchHits<JsonSchemaDocumentOsDocument> = mock()
        whenever(emptySearchHits.searchHits).thenReturn(emptyList())
        whenever(emptySearchHits.totalHits).thenReturn(0L)
        whenever(elasticsearchOperations.search(queryCaptor.capture(), eq(JsonSchemaDocumentOsDocument::class.java))).thenReturn(emptySearchHits)

        val houseDef = mock<CaseDefinition>()
        val houseDefId = mock<CaseDefinitionId>()
        whenever(houseDefId.key).thenReturn("house")
        whenever(houseDef.id).thenReturn(houseDefId)

        val carDef = mock<CaseDefinition>()
        val carDefId = mock<CaseDefinitionId>()
        whenever(carDefId.key).thenReturn("car")
        whenever(carDef.id).thenReturn(carDefId)

        whenever(caseDefinitionService.getCaseDefinitions(active = true)).thenReturn(listOf(houseDef, carDef))
        whenever(searchFieldService.getSearchFields("house")).thenReturn(listOf(
            SearchField("city", "doc:city", SearchFieldDataType.TEXT, SearchFieldFieldType.SINGLE, SearchFieldMatchType.LIKE, null, 0, "City")
        ))
        whenever(searchFieldService.getSearchFields("car")).thenReturn(listOf(
            SearchField("brand", "doc:brand", SearchFieldDataType.TEXT, SearchFieldFieldType.SINGLE, SearchFieldMatchType.LIKE, null, 0, "Brand")
        ))

        val request = SearchRequest()
        request.globalSearchFilter = "test"
        service.search(request, BlueprintType.CASE, PageRequest.of(0, 10))

        val capturedQuery = queryCaptor.firstValue
        assertThat(capturedQuery.source).contains("definitionId.name")
        assertThat(capturedQuery.source).contains("house")
        assertThat(capturedQuery.source).contains("car")
        assertThat(capturedQuery.source).contains("content.city")
        assertThat(capturedQuery.source).contains("content.brand")
    }

    @Test
    fun `global search without definition name and no accessible definitions adds matchNone query`() {
        val queryCaptor = argumentCaptor<StringQuery>()
        val emptySearchHits: SearchHits<JsonSchemaDocumentOsDocument> = mock()
        whenever(emptySearchHits.searchHits).thenReturn(emptyList())
        whenever(emptySearchHits.totalHits).thenReturn(0L)
        whenever(elasticsearchOperations.search(queryCaptor.capture(), eq(JsonSchemaDocumentOsDocument::class.java))).thenReturn(emptySearchHits)

        whenever(caseDefinitionService.getCaseDefinitions(active = true)).thenReturn(emptyList())

        val request = SearchRequest()
        request.globalSearchFilter = "test"
        service.search(request, BlueprintType.CASE, PageRequest.of(0, 10))

        val capturedQuery = queryCaptor.firstValue
        assertThat(capturedQuery.source).contains("must_not")
        assertThat(capturedQuery.source).contains("match_all")
    }

    companion object {
        private const val FULL_ACCESS_ROLE = "full access role"
        private const val USERNAME = "test@test.com"
    }
}
