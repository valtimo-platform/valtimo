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

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.condition.ExpressionPermissionCondition
import com.ritense.authorization.permission.condition.PermissionConditionOperator
import com.ritense.authorization.role.Role
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.domain.impl.searchfield.SearchField
import com.ritense.document.domain.impl.searchfield.SearchFieldDataType
import com.ritense.document.domain.impl.searchfield.SearchFieldFieldType
import com.ritense.document.domain.impl.searchfield.SearchFieldId
import com.ritense.document.domain.impl.searchfield.SearchFieldMatchType
import com.ritense.document.domain.search.AdvancedSearchRequest
import com.ritense.document.domain.search.DatabaseSearchType
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.service.DocumentSearchService
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.document.service.impl.JsonSchemaDocumentSearchService
import com.ritense.valtimo.contract.blueprint.BlueprintType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.security.test.context.support.WithMockUser
import java.time.LocalDate
import java.util.UUID

/**
 * Parity between PostgreSQL and OpenSearch for `content` fields nested inside an object, which OpenSearch maps as
 * `flat_object` leaves. The JPA search service is the oracle.
 */
@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class NestedContentSearchParityIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    @Qualifier("jpaDocumentSearchService")
    lateinit var jpaSearchService: JsonSchemaDocumentSearchService

    @Autowired
    @Qualifier("openSearchDocumentSearchService")
    lateinit var openSearchSearchService: JsonSchemaDocumentOpenSearchService

    @Autowired
    lateinit var converter: JsonSchemaDocumentOsConverter

    @Test
    fun `global search with a like search field on a nested leaf matches part of the value`() {
        nestedSearchField(SearchFieldMatchType.LIKE)
        val rotterdam = seedPerson("Alice", plaats = "Rotterdam")
        seedPerson("Bob", plaats = "Utrecht")
        val request = AdvancedSearchRequest().globalSearchFilter("OTTER")

        assertThat(searchIds(jpaSearchService, request)).`as`("JPA").containsExactly(rotterdam)
        assertThat(searchIds(openSearchSearchService, request)).`as`("OpenSearch").containsExactly(rotterdam)
    }

    @Test
    fun `global search with an exact search field on a nested leaf matches the whole value regardless of case`() {
        nestedSearchField(SearchFieldMatchType.EXACT)
        val rotterdam = seedPerson("Alice", plaats = "Rotterdam")
        seedPerson("Bob", plaats = "Utrecht")

        assertThat(searchIds(openSearchSearchService, AdvancedSearchRequest().globalSearchFilter("rotterdam")))
            .containsExactly(rotterdam)
        assertThat(searchIds(openSearchSearchService, AdvancedSearchRequest().globalSearchFilter("otter"))).isEmpty()
    }

    @Test
    fun `a date range on a nested leaf compares dates, not strings`() {
        seedPerson("Early", plaats = "Utrecht", aangevraagd = "2024-02-28")
        val sameDay = seedPerson("SameDay", plaats = "Utrecht", aangevraagd = "2024-03-01")
        val later = seedPerson("Later", plaats = "Utrecht", aangevraagd = "2024-03-01T10:00:00Z")
        val request = AdvancedSearchRequest().addOtherFilters(
            AdvancedSearchRequest.OtherFilter().path("doc:aanvraag.datum")
                .searchType(DatabaseSearchType.GREATER_THAN_OR_EQUAL_TO).rangeFrom(LocalDate.of(2024, 3, 1))
        )

        assertThat(searchIds(openSearchSearchService, request)).containsExactlyInAnyOrder(sameDay, later)
    }

    @Test
    @WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [CONDITION_ROLE])
    fun `a numeric range on a nested leaf excludes the bound when it is exclusive`() {
        seedPerson("Exact", plaats = "Utrecht", bedrag = 1000)
        val above = seedPerson("Above", plaats = "Utrecht", bedrag = 1001)
        setUpPermission("$.lening.bedrag", PermissionConditionOperator.GREATER_THAN, 1000, Int::class.java)

        assertThat(searchIds(jpaSearchService)).`as`("JPA").containsExactly(above)
        assertThat(searchIds(openSearchSearchService)).`as`("OpenSearch").containsExactly(above)
    }

    @Test
    fun `sorting on a leaf two levels inside an object orders like PostgreSQL`() {
        val expected = listOf(seedPerson("Carol", "Utrecht"), seedPerson("Alice", "Rotterdam"), seedPerson("Bob", "Amsterdam"))
            .let { listOf(it[2], it[1], it[0]) }
        val pageable = PageRequest.of(0, 10, Sort.by(Sort.Direction.ASC, "doc:contact.adres.plaats"))

        assertThat(searchIds(jpaSearchService, AdvancedSearchRequest(), pageable)).`as`("JPA").isEqualTo(expected)
        assertThat(searchIds(openSearchSearchService, AdvancedSearchRequest(), pageable)).`as`("OpenSearch").isEqualTo(expected)
    }

    @Test
    @WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [CONDITION_ROLE])
    fun `a null permission condition on a leaf two levels inside an object only matches cases without it`() {
        seedPerson("WithPlace", plaats = "Utrecht")
        val withoutPlace = seedPerson("WithoutPlace", plaats = null)
        setUpPermission("$.contact.adres.plaats", PermissionConditionOperator.EQUAL_TO, null, String::class.java)

        assertThat(searchIds(jpaSearchService)).`as`("JPA").containsExactly(withoutPlace)
        assertThat(searchIds(openSearchSearchService)).`as`("OpenSearch").containsExactly(withoutPlace)
    }

    private fun searchIds(
        service: DocumentSearchService,
        request: AdvancedSearchRequest = AdvancedSearchRequest(),
        pageable: PageRequest = PageRequest.of(0, 50),
    ): List<String> = service.search("person", BlueprintType.CASE, request, pageable).content.map { it.id().toString() }

    private fun nestedSearchField(matchType: SearchFieldMatchType) {
        searchFieldRepository.deleteAllByIdCaseDefinitionKey("person")
        val searchField = SearchField(
            "plaats", "doc:contact.adres.plaats", SearchFieldDataType.TEXT, SearchFieldFieldType.SINGLE, matchType, null, 0, "Plaats"
        )
        searchField.id = SearchFieldId.newId("person").newIdentity()
        searchFieldRepository.save(searchField)
    }

    private fun <T : Any> setUpPermission(path: String, operator: PermissionConditionOperator, value: T?, type: Class<T>) {
        permissionRepository.deleteAll()
        val role = roleRepository.findByKey(CONDITION_ROLE) ?: roleRepository.save(Role(UUID.randomUUID(), CONDITION_ROLE))
        permissionRepository.save(
            Permission(
                UUID.randomUUID(),
                JsonSchemaDocument::class.java,
                mutableListOf(JsonSchemaDocumentActionProvider.VIEW_LIST),
                ConditionContainer(listOf(ExpressionPermissionCondition("content", path, operator, value, type))),
                role,
            )
        )
    }

    private fun seedPerson(firstName: String, plaats: String?, bedrag: Int? = null, aangevraagd: String? = null): String {
        val content = objectMapper.createObjectNode().apply {
            put("firstName", firstName)
            plaats?.let {
                set<ObjectNode>("adres", objectMapper.createObjectNode().put("plaats", it))
                set<ObjectNode>("contact", objectMapper.createObjectNode().set("adres", objectMapper.createObjectNode().put("plaats", it)))
            }
            bedrag?.let { set<ObjectNode>("lening", objectMapper.createObjectNode().put("bedrag", it)) }
            aangevraagd?.let { set<ObjectNode>("aanvraag", objectMapper.createObjectNode().put("datum", it)) }
        }
        val document = runWithoutAuthorization {
            documentService.createDocument(NewDocumentRequest("person", "person", "1.0.0", content)).resultingDocument().get()
        }
        @Suppress("UNCHECKED_CAST")
        val osContent = objectMapper.convertValue(content, Map::class.java) as Map<String, Any?>
        indexOsDocument(converter.toOsDocument(document).copy(content = osContent))
        refreshIndex()
        return document.id().toString()
    }

    companion object {
        const val CONDITION_ROLE = "nested-condition-test-role"
    }
}
