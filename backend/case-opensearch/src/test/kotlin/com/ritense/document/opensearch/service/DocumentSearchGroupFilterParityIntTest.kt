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

import com.fasterxml.jackson.core.type.TypeReference
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.JsonDocumentContent
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.domain.impl.searchfield.SearchFieldDataType
import com.ritense.document.domain.impl.searchfield.SearchFieldFieldType
import com.ritense.document.domain.search.SearchWithConfigRequest
import com.ritense.document.domain.search.SearchWithConfigRequest.SearchWithConfigFilter
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.service.DocumentSearchService
import com.ritense.document.service.GlobalSearchFieldMeta
import com.ritense.document.service.impl.JsonSchemaDocumentSearchService
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valueresolver.ValueResolverService
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.domain.PageRequest
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.context.bean.override.mockito.MockitoBean
import java.time.LocalDateTime
import java.util.UUID

@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class DocumentSearchGroupFilterParityIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    @Qualifier("jpaDocumentSearchService")
    lateinit var jpaSearchService: JsonSchemaDocumentSearchService

    @Autowired
    @Qualifier("openSearchDocumentSearchService")
    lateinit var openSearchSearchService: JsonSchemaDocumentOpenSearchService

    @Autowired
    lateinit var converter: JsonSchemaDocumentOsConverter

    @Autowired
    lateinit var documentRepository: JsonSchemaDocumentRepository

    @Autowired
    lateinit var entityManager: EntityManager

    @MockitoBean
    lateinit var valueResolverService: ValueResolverService

    private val ids = mutableMapOf<String, String>()

    @BeforeEach
    fun seed() {
        // Person allows extra properties, so it can hold explicit JSON nulls; house can't
        seed("house4", "house", """{"housenumber": 4}""", IN_2020)
        seed("house14", "house", """{"housenumber": 14}""", IN_2026)
        seed("houseEmpty", "house", "{}", IN_2026)
        seed("person5", "person", """{"score": 5, "flag": true}""", IN_2026)
        seed("person2", "person", """{"score": 2, "flag": false}""", IN_2026)
        seed("personNull", "person", """{"score": null, "flag": null}""", IN_2026)
        seed("personEmpty", "person", "{}", IN_2026)
        refreshIndex()
    }

    @TestFactory
    fun `group filters return the same cases on JPA and OpenSearch`(): List<DynamicTest> = listOf(
        Scenario("number exact on the house path", "amount", values(4), setOf("house4")),
        Scenario("number exact on the person path", "amount", values(5), setOf("person5")),
        Scenario("boolean true", "flag", values(true), setOf("person5")),
        Scenario("boolean false", "flag", values(false), setOf("person2")),
        Scenario("number range with both bounds", "range", range(3, 5), setOf("house4", "person5")),
        Scenario("number range with only a lower bound", "range", range(3, null), setOf("house4", "house14", "person5")),
        Scenario("number range with only an upper bound", "range", range(null, 4), setOf("house4", "person2")),
        Scenario("date range on a case field", "created", range("2020-01-01", "2020-12-31"), setOf("house4")),
        Scenario("unsupported zaak path", "zaak", values("x"), emptySet()),
        Scenario("path without prefix", "unprefixed", values("x"), emptySet()),
        Scenario("field without path mappings", "unmapped", values("x"), emptySet()),
    ).map { scenario ->
        DynamicTest.dynamicTest(scenario.name) {
            val filter = scenario.filter.apply { key = scenario.key }
            val jpa = search(jpaSearchService, filter)
            val openSearch = search(openSearchSearchService, filter)

            assertThat(jpa).describedAs("JPA").isEqualTo(scenario.expected)
            assertThat(openSearch).describedAs("OpenSearch").isEqualTo(scenario.expected)
        }
    }

    private fun search(service: DocumentSearchService, filter: SearchWithConfigFilter): Set<String> {
        val idToName = ids.entries.associate { (name, id) -> id to name }
        return service.search(
            listOf("house", "person"),
            BlueprintType.CASE,
            SearchWithConfigRequest().apply { otherFilters = listOf(filter) },
            PATH_MAPPINGS,
            SEARCH_FIELDS,
            PageRequest.of(0, 50)
        ).content.mapNotNull { idToName[it.id().toString()] }.toSet()
    }

    private fun seed(name: String, definitionName: String, contentJson: String, createdOn: LocalDateTime) {
        val created = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(definitionName, definitionName, "1.0.0", JsonDocumentContent(contentJson).asJson())
            ).resultingDocument().orElseThrow()
        }
        setCreatedOn(created.id().id, createdOn)
        val jpaDoc = documentRepository.findById(created.id()).orElseThrow()
        val osContent = objectMapper.convertValue(jpaDoc.content().asJson(), object : TypeReference<Map<String, Any?>>() {})
        openSearchRepository.save(converter.toOsDocument(jpaDoc).copy(content = osContent))
        ids[name] = created.id().toString()
    }

    private fun setCreatedOn(documentId: UUID, createdOn: LocalDateTime) {
        entityManager.flush()
        entityManager.createQuery("UPDATE JsonSchemaDocument d SET d.createdOn = :createdOn WHERE d.id.id = :id")
            .setParameter("createdOn", createdOn)
            .setParameter("id", documentId)
            .executeUpdate()
        entityManager.clear()
    }

    private data class Scenario(
        val name: String,
        val key: String,
        val filter: SearchWithConfigFilter,
        val expected: Set<String>
    )

    companion object {
        private val IN_2020 = LocalDateTime.of(2020, 6, 1, 12, 0, 0)
        private val IN_2026 = LocalDateTime.of(2026, 6, 1, 12, 0, 0)

        private val PATH_MAPPINGS = mapOf(
            "amount" to mapOf("house" to "doc:housenumber", "person" to "doc:score"),
            "range" to mapOf("house" to "doc:housenumber", "person" to "doc:score"),
            // The house boolean is 'loan-approved', which Postgres can't address as an unquoted jsonpath
            "flag" to mapOf("person" to "doc:flag"),
            "created" to mapOf("house" to "case:createdOn", "person" to "case:createdOn"),
            "zaak" to mapOf("house" to "zaak:identificatie"),
            "unprefixed" to mapOf("house" to "street"),
        )

        private val SEARCH_FIELDS = mapOf(
            "amount" to GlobalSearchFieldMeta(SearchFieldDataType.NUMBER, SearchFieldFieldType.SINGLE, null),
            "range" to GlobalSearchFieldMeta(SearchFieldDataType.NUMBER, SearchFieldFieldType.RANGE, null),
            "flag" to GlobalSearchFieldMeta(SearchFieldDataType.BOOLEAN, SearchFieldFieldType.SINGLE, null),
            "created" to GlobalSearchFieldMeta(SearchFieldDataType.DATE, SearchFieldFieldType.RANGE, null),
            "zaak" to GlobalSearchFieldMeta(SearchFieldDataType.TEXT, SearchFieldFieldType.SINGLE, null),
            "unprefixed" to GlobalSearchFieldMeta(SearchFieldDataType.TEXT, SearchFieldFieldType.SINGLE, null),
            "unmapped" to GlobalSearchFieldMeta(SearchFieldDataType.TEXT, SearchFieldFieldType.SINGLE, null),
        )

        private fun values(vararg values: Any) = SearchWithConfigFilter().apply { setValues(values.toList()) }

        private fun range(from: Any?, to: Any?) = SearchWithConfigFilter().apply {
            setRangeFrom(from)
            setRangeTo(to)
        }
    }
}
