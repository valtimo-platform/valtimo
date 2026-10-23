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

package com.ritense.document.service.impl

import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.JsonDocumentContent
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.domain.impl.searchfield.SearchFieldDataType
import com.ritense.document.domain.impl.searchfield.SearchFieldFieldType
import com.ritense.document.domain.impl.searchfield.SearchFieldMatchType
import com.ritense.document.domain.search.SearchWithConfigRequest
import com.ritense.document.service.GlobalSearchFieldMeta
import com.ritense.valtimo.contract.blueprint.BlueprintType
import java.time.LocalDate
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.springframework.data.domain.PageRequest
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.annotation.Transactional

@Tag("integration")
@Transactional
class JsonSchemaDocumentSearchServiceMultiDefinitionIntTest : BaseIntegrationTest() {

    @BeforeEach
    fun setUp() {
        // Clean up any existing documents
    }

    @Test
    @WithMockUser(username = "user@test.com", authorities = [FULL_ACCESS_ROLE])
    fun `should search across multiple definitions with path mappings`() {
        // Create documents in "house" definition with street field
        val houseDoc1 = createDocumentInDefinition("house", """{"street": "Amsterdam"}""")
        val houseDoc2 = createDocumentInDefinition("house", """{"street": "Rotterdam"}""")

        // Create documents in "person" definition with firstName field
        val personDoc1 = createDocumentInDefinition("person", """{"firstName": "Amsterdam"}""")
        val personDoc2 = createDocumentInDefinition("person", """{"firstName": "Utrecht"}""")

        // Build filter path mappings: "name" maps to different paths per definition
        val filterPathMappings = mapOf(
            "name" to mapOf(
                "house" to "doc:street",
                "person" to "doc:firstName"
            )
        )

        // Create search request with filter for "name" = "Amsterdam"
        val searchFilter = SearchWithConfigRequest.SearchWithConfigFilter().apply {
            key = "name"
            setValues(listOf("Amsterdam"))
        }

        val searchRequest = SearchWithConfigRequest()
        searchRequest.otherFilters = listOf(searchFilter)

        // Search across both definitions
        val results = documentSearchService.search(
            listOf("house", "person"),
            BlueprintType.CASE,
            searchRequest,
            filterPathMappings,
            PageRequest.of(0, 10)
        )

        // Should return 2 documents: houseDoc1 (street=Amsterdam) and personDoc1 (firstName=Amsterdam)
        assertThat(results.totalElements).isEqualTo(2)
        assertThat(results.content.map { it.id() })
            .containsExactlyInAnyOrder(houseDoc1.id(), personDoc1.id())
    }

    @Test
    @WithMockUser(username = "user@test.com", authorities = [FULL_ACCESS_ROLE])
    fun `should return empty when no matches in any definition`() {
        createDocumentInDefinition("house", """{"street": "Amsterdam"}""")
        createDocumentInDefinition("person", """{"firstName": "Rotterdam"}""")

        val filterPathMappings = mapOf(
            "name" to mapOf(
                "house" to "doc:street",
                "person" to "doc:firstName"
            )
        )

        val searchFilter = SearchWithConfigRequest.SearchWithConfigFilter().apply {
            key = "name"
            setValues(listOf("Paris"))
        }

        val searchRequest = SearchWithConfigRequest()
        searchRequest.otherFilters = listOf(searchFilter)

        val results = documentSearchService.search(
            listOf("house", "person"),
            BlueprintType.CASE,
            searchRequest,
            filterPathMappings,
            PageRequest.of(0, 10)
        )

        assertThat(results.totalElements).isEqualTo(0)
        assertThat(results.content).isEmpty()
    }

    @Test
    @WithMockUser(username = "user@test.com", authorities = [FULL_ACCESS_ROLE])
    fun `should respect pagination across definitions`() {
        // Create 3 house docs and 3 person docs matching "Test"
        repeat(3) {
            createDocumentInDefinition("house", """{"street": "Test"}""")
        }
        repeat(3) {
            createDocumentInDefinition("person", """{"firstName": "Test"}""")
        }

        val filterPathMappings = mapOf(
            "name" to mapOf(
                "house" to "doc:street",
                "person" to "doc:firstName"
            )
        )

        val searchFilter = SearchWithConfigRequest.SearchWithConfigFilter().apply {
            key = "name"
            setValues(listOf("Test"))
        }

        val searchRequest = SearchWithConfigRequest()
        searchRequest.otherFilters = listOf(searchFilter)

        // First page
        val page0 = documentSearchService.search(
            listOf("house", "person"),
            BlueprintType.CASE,
            searchRequest,
            filterPathMappings,
            PageRequest.of(0, 2)
        )

        assertThat(page0.totalElements).isEqualTo(6)
        assertThat(page0.content).hasSize(2)

        // Second page
        val page1 = documentSearchService.search(
            listOf("house", "person"),
            BlueprintType.CASE,
            searchRequest,
            filterPathMappings,
            PageRequest.of(1, 2)
        )

        assertThat(page1.totalElements).isEqualTo(6)
        assertThat(page1.content).hasSize(2)

        // No duplicates between pages
        val page0Ids = page0.content.map { it.id() }
        val page1Ids = page1.content.map { it.id() }
        assertThat(page0Ids).doesNotContainAnyElementsOf(page1Ids)
    }

    @Test
    @WithMockUser(username = "user@test.com", authorities = [FULL_ACCESS_ROLE])
    fun `should return empty when filter key has no path mappings configured`() {
        createDocumentInDefinition("house", """{"street": "Amsterdam"}""")
        createDocumentInDefinition("person", """{"firstName": "Amsterdam"}""")

        // No path mappings for "name" key at all
        val filterPathMappings = emptyMap<String, Map<String, String>>()

        val searchFilter = SearchWithConfigRequest.SearchWithConfigFilter().apply {
            key = "name"
            setValues(listOf("Amsterdam"))
        }

        val searchRequest = SearchWithConfigRequest()
        searchRequest.otherFilters = listOf(searchFilter)

        // Should return empty results, not throw an exception
        val results = documentSearchService.search(
            listOf("house", "person"),
            BlueprintType.CASE,
            searchRequest,
            filterPathMappings,
            PageRequest.of(0, 10)
        )

        assertThat(results.totalElements).isEqualTo(0)
        assertThat(results.content).isEmpty()
    }

    @Test
    @WithMockUser(username = "user@test.com", authorities = [FULL_ACCESS_ROLE])
    fun `should handle definition without path mapping`() {
        val houseDoc = createDocumentInDefinition("house", """{"street": "Amsterdam"}""")
        val personDoc = createDocumentInDefinition("person", """{"firstName": "Amsterdam"}""")

        // Only map "house", not "person"
        val filterPathMappings = mapOf(
            "name" to mapOf(
                "house" to "doc:street"
                // person is not mapped
            )
        )

        val searchFilter = SearchWithConfigRequest.SearchWithConfigFilter().apply {
            key = "name"
            setValues(listOf("Amsterdam"))
        }

        val searchRequest = SearchWithConfigRequest()
        searchRequest.otherFilters = listOf(searchFilter)

        val results = documentSearchService.search(
            listOf("house", "person"),
            BlueprintType.CASE,
            searchRequest,
            filterPathMappings,
            PageRequest.of(0, 10)
        )

        // Should only return house doc since person has no mapping
        assertThat(results.totalElements).isEqualTo(1)
        assertThat(results.content.map { it.id() }).containsExactly(houseDoc.id())
    }

    @Test
    @WithMockUser(username = "user@test.com", authorities = [FULL_ACCESS_ROLE])
    fun `should search without filters returning all documents`() {
        createDocumentInDefinition("house", """{"street": "Amsterdam"}""")
        createDocumentInDefinition("person", """{"firstName": "Rotterdam"}""")

        val filterPathMappings = emptyMap<String, Map<String, String>>()

        val searchRequest = SearchWithConfigRequest()
        searchRequest.otherFilters = emptyList()

        val results = documentSearchService.search(
            listOf("house", "person"),
            BlueprintType.CASE,
            searchRequest,
            filterPathMappings,
            PageRequest.of(0, 10)
        )

        assertThat(results.totalElements).isEqualTo(2)
    }

    @Test
    @WithMockUser(username = "user@test.com", authorities = [FULL_ACCESS_ROLE])
    fun `should filter only specified definitions`() {
        val houseDoc = createDocumentInDefinition("house", """{"street": "Test"}""")
        createDocumentInDefinition("person", """{"firstName": "Test"}""")

        val filterPathMappings = mapOf(
            "name" to mapOf(
                "house" to "doc:street",
                "person" to "doc:firstName"
            )
        )

        val searchFilter = SearchWithConfigRequest.SearchWithConfigFilter().apply {
            key = "name"
            setValues(listOf("Test"))
        }

        val searchRequest = SearchWithConfigRequest()
        searchRequest.otherFilters = listOf(searchFilter)

        // Search only in "house" definition
        val results = documentSearchService.search(
            listOf("house"),
            BlueprintType.CASE,
            searchRequest,
            filterPathMappings,
            PageRequest.of(0, 10)
        )

        assertThat(results.totalElements).isEqualTo(1)
        assertThat(results.content.map { it.id() }).containsExactly(houseDoc.id())
    }

    @Test
    @WithMockUser(username = "user@test.com", authorities = [FULL_ACCESS_ROLE])
    fun `should match a number search field exactly across definitions`() {
        val house4 = createDocumentInDefinition("house", """{"housenumber": 4}""")
        createDocumentInDefinition("house", """{"housenumber": 14}""")
        val person4 = createDocumentInDefinition("person", """{"age": 4}""")
        createDocumentInDefinition("person", """{"age": 40}""")

        val results = searchNumber(
            SearchWithConfigRequest.SearchWithConfigFilter().apply {
                key = "amount"
                setValues(listOf(4))
            },
            SearchFieldFieldType.SINGLE
        )

        assertThat(results.content.map { it.id() })
            .containsExactlyInAnyOrder(house4.id(), person4.id())
    }

    @Test
    @WithMockUser(username = "user@test.com", authorities = [FULL_ACCESS_ROLE])
    fun `should search a number range across definitions`() {
        val house4 = createDocumentInDefinition("house", """{"housenumber": 4}""")
        createDocumentInDefinition("house", """{"housenumber": 14}""")
        val person5 = createDocumentInDefinition("person", """{"age": 5}""")
        createDocumentInDefinition("person", """{"age": 2}""")

        val results = searchNumber(
            SearchWithConfigRequest.SearchWithConfigFilter().apply {
                key = "amount"
                setRangeFrom(3)
                setRangeTo(5)
            },
            SearchFieldFieldType.RANGE
        )

        assertThat(results.content.map { it.id() })
            .containsExactlyInAnyOrder(house4.id(), person5.id())
    }

    @Test
    @WithMockUser(username = "user@test.com", authorities = [FULL_ACCESS_ROLE])
    fun `should keep contains matching for a text search field with match type like`() {
        val houseDoc = createDocumentInDefinition("house", """{"street": "Amsterdam"}""")
        createDocumentInDefinition("person", """{"firstName": "Utrecht"}""")

        val searchRequest = SearchWithConfigRequest()
        searchRequest.otherFilters = listOf(
            SearchWithConfigRequest.SearchWithConfigFilter().apply {
                key = "name"
                setValues(listOf("Amster"))
            }
        )

        val results = documentSearchService.search(
            listOf("house", "person"),
            BlueprintType.CASE,
            searchRequest,
            mapOf("name" to mapOf("house" to "doc:street", "person" to "doc:firstName")),
            mapOf(
                "name" to GlobalSearchFieldMeta(
                    SearchFieldDataType.TEXT,
                    SearchFieldFieldType.SINGLE,
                    SearchFieldMatchType.LIKE
                )
            ),
            PageRequest.of(0, 10)
        )

        assertThat(results.content.map { it.id() }).containsExactly(houseDoc.id())
    }

    @Test
    @WithMockUser(username = "user@test.com", authorities = [FULL_ACCESS_ROLE])
    fun `should search a date range on a case field across definitions`() {
        val houseDoc = createDocumentInDefinition("house", """{"street": "Amsterdam"}""")
        val personDoc = createDocumentInDefinition("person", """{"firstName": "Utrecht"}""")
        val today = LocalDate.now()

        val in2020 = searchCreatedOn("2020-01-01", "2020-12-31")
        val aroundToday = searchCreatedOn(today.minusDays(1).toString(), today.plusDays(1).toString())

        assertThat(in2020.content.map { it.id() }).doesNotContain(houseDoc.id(), personDoc.id())
        assertThat(aroundToday.content.map { it.id() }).contains(houseDoc.id(), personDoc.id())
    }

    @Test
    @WithMockUser(username = "user@test.com", authorities = [FULL_ACCESS_ROLE])
    fun `should treat paths with an unsupported or missing prefix as unmapped`() {
        createDocumentInDefinition("house", """{"street": "Amsterdam"}""")
        val personDoc = createDocumentInDefinition("person", """{"firstName": "Amsterdam"}""")

        val results = documentSearchService.search(
            listOf("house", "person"),
            BlueprintType.CASE,
            SearchWithConfigRequest().apply {
                otherFilters = listOf(
                    SearchWithConfigRequest.SearchWithConfigFilter().apply {
                        key = "name"
                        setValues(listOf("Amsterdam"))
                    }
                )
            },
            mapOf("name" to mapOf("house" to "zaak:identificatie", "person" to "doc:firstName")),
            mapOf(
                "name" to GlobalSearchFieldMeta(
                    SearchFieldDataType.TEXT,
                    SearchFieldFieldType.SINGLE,
                    SearchFieldMatchType.EXACT
                )
            ),
            PageRequest.of(0, 10)
        )
        val noPrefixResults = documentSearchService.search(
            listOf("house", "person"),
            BlueprintType.CASE,
            SearchWithConfigRequest().apply {
                otherFilters = listOf(
                    SearchWithConfigRequest.SearchWithConfigFilter().apply {
                        key = "name"
                        setValues(listOf("Amsterdam"))
                    }
                )
            },
            mapOf("name" to mapOf("house" to "street", "person" to "firstName")),
            PageRequest.of(0, 10)
        )

        assertThat(results.content.map { it.id() }).containsExactly(personDoc.id())
        assertThat(noPrefixResults.content).isEmpty()
    }

    private fun searchCreatedOn(from: String, to: String) = documentSearchService.search(
        listOf("house", "person"),
        BlueprintType.CASE,
        SearchWithConfigRequest().apply {
            otherFilters = listOf(
                SearchWithConfigRequest.SearchWithConfigFilter().apply {
                    key = "created-on"
                    setRangeFrom(from)
                    setRangeTo(to)
                }
            )
        },
        mapOf("created-on" to mapOf("house" to "case:createdOn", "person" to "case:createdOn")),
        mapOf("created-on" to GlobalSearchFieldMeta(SearchFieldDataType.DATE, SearchFieldFieldType.RANGE, null)),
        PageRequest.of(0, 50)
    )

    private fun searchNumber(
        filter: SearchWithConfigRequest.SearchWithConfigFilter,
        fieldType: SearchFieldFieldType
    ) = documentSearchService.search(
        listOf("house", "person"),
        BlueprintType.CASE,
        SearchWithConfigRequest().apply { otherFilters = listOf(filter) },
        mapOf("amount" to mapOf("house" to "doc:housenumber", "person" to "doc:age")),
        mapOf("amount" to GlobalSearchFieldMeta(SearchFieldDataType.NUMBER, fieldType, null)),
        PageRequest.of(0, 10)
    )

    private fun createDocumentInDefinition(definitionName: String, contentJson: String): JsonSchemaDocument {
        return runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(
                    definitionName,
                    definitionName,
                    "1.0.0",
                    JsonDocumentContent(contentJson).asJson()
                )
            ).resultingDocument().orElseThrow()
        }
    }
}
