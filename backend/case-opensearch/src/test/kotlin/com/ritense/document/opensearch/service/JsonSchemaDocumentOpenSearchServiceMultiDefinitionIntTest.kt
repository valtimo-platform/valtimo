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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.domain.impl.searchfield.SearchFieldDataType
import com.ritense.document.domain.impl.searchfield.SearchFieldMatchType
import com.ritense.document.domain.search.SearchWithConfigRequest
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.opensearch.domain.OsBlueprintId
import com.ritense.document.opensearch.domain.OsDefinitionId
import com.ritense.document.service.DocumentSearchService
import com.ritense.document.service.GlobalSearchFieldMeta
import com.ritense.valtimo.contract.blueprint.BlueprintType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageRequest
import org.springframework.security.test.context.support.WithMockUser

@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class JsonSchemaDocumentOpenSearchServiceMultiDefinitionIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    lateinit var documentSearchService: DocumentSearchService

    @Test
    fun `should search across multiple definitions with path mappings`() {
        val houseDoc1 = seedDocumentInDefinition("house", mapOf("street" to "Amsterdam"))
        seedDocumentInDefinition("house", mapOf("street" to "Rotterdam"))
        val personDoc1 = seedDocumentInDefinition("person", mapOf("firstName" to "Amsterdam"))
        seedDocumentInDefinition("person", mapOf("firstName" to "Utrecht"))

        val filterPathMappings = mapOf(
            "name" to mapOf(
                "house" to "doc:street",
                "person" to "doc:firstName"
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
            emptyMap(),
            PageRequest.of(0, 10)
        )

        assertThat(results.totalElements).isEqualTo(2)
        assertThat(results.content.map { it.id() })
            .containsExactlyInAnyOrder(houseDoc1.id(), personDoc1.id())
    }

    @Test
    fun `should filter by global search fields`() {
        val houseDoc = seedDocumentInDefinition("house", mapOf("street" to "Keizersgracht"))
        seedDocumentInDefinition("house", mapOf("street" to "Prinsengracht"))
        seedDocumentInDefinition("person", mapOf("firstName" to "John"))

        val globalSearchFields = mapOf(
            "street" to GlobalSearchFieldMeta(SearchFieldDataType.TEXT, SearchFieldMatchType.LIKE)
        )

        val searchFilter = SearchWithConfigRequest.SearchWithConfigFilter().apply {
            key = "street"
            setValues(listOf("Keizers"))
        }

        val searchRequest = SearchWithConfigRequest()
        searchRequest.otherFilters = listOf(searchFilter)

        val filterPathMappings = mapOf(
            "street" to mapOf(
                "house" to "doc:street"
            )
        )

        val results = documentSearchService.search(
            listOf("house", "person"),
            BlueprintType.CASE,
            searchRequest,
            filterPathMappings,
            globalSearchFields,
            PageRequest.of(0, 10)
        )

        assertThat(results.totalElements).isEqualTo(1)
        assertThat(results.content[0].id()).isEqualTo(houseDoc.id())
    }

    @Test
    fun `should paginate results across definitions`() {
        repeat(3) {
            seedDocumentInDefinition("house", mapOf("street" to "Test"))
        }
        repeat(3) {
            seedDocumentInDefinition("person", mapOf("firstName" to "Test"))
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

        val page0 = documentSearchService.search(
            listOf("house", "person"),
            BlueprintType.CASE,
            searchRequest,
            filterPathMappings,
            emptyMap(),
            PageRequest.of(0, 2)
        )

        assertThat(page0.totalElements).isEqualTo(6)
        assertThat(page0.content).hasSize(2)

        val page1 = documentSearchService.search(
            listOf("house", "person"),
            BlueprintType.CASE,
            searchRequest,
            filterPathMappings,
            emptyMap(),
            PageRequest.of(1, 2)
        )

        assertThat(page1.totalElements).isEqualTo(6)
        assertThat(page1.content).hasSize(2)

        val page0Ids = page0.content.map { it.id() }
        val page1Ids = page1.content.map { it.id() }
        assertThat(page0Ids).doesNotContainAnyElementsOf(page1Ids)
    }

    @Test
    fun `should return empty when no matches in any definition`() {
        seedDocumentInDefinition("house", mapOf("street" to "Amsterdam"))
        seedDocumentInDefinition("person", mapOf("firstName" to "Rotterdam"))

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
            emptyMap(),
            PageRequest.of(0, 10)
        )

        assertThat(results.totalElements).isEqualTo(0)
        assertThat(results.content).isEmpty()
    }

    @Test
    fun `should return empty when definition list is empty`() {
        seedDocumentInDefinition("house", mapOf("street" to "Amsterdam"))

        val searchRequest = SearchWithConfigRequest()
        searchRequest.otherFilters = emptyList()

        val results = documentSearchService.search(
            emptyList(),
            BlueprintType.CASE,
            searchRequest,
            emptyMap(),
            emptyMap(),
            PageRequest.of(0, 10)
        )

        assertThat(results.totalElements).isEqualTo(0)
        assertThat(results.content).isEmpty()
    }

    private fun seedDocumentInDefinition(definitionName: String, contentMap: Map<String, String>): JsonSchemaDocument {
        val content = objectMapper.createObjectNode().apply {
            contentMap.forEach { (key, value) -> put(key, value) }
        }
        val jpaDoc = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(definitionName, definitionName, "1.0.0", content)
            ).resultingDocument().get()
        }
        openSearchRepository.save(
            JsonSchemaDocumentOsDocument(
                id = jpaDoc.id().toString(),
                content = contentMap,
                definitionId = OsDefinitionId(
                    name = definitionName,
                    version = null,
                    blueprintId = OsBlueprintId(
                        blueprintType = "CASE",
                        blueprintKey = null,
                        blueprintVersionTag = null,
                        isBuildingBlock = null,
                        isCase = null,
                    ),
                ),
                createdOn = null,
                modifiedOn = null,
                createdBy = null,
                sequence = null,
                version = null,
                assigneeId = null,
                assigneeFullName = null,
                internalStatus = null,
                caseTags = null,
                relations = null,
                relatedFiles = null,
                retentionDate = null,
                contentText = contentMap.values.joinToString(" "),
            )
        )
        refreshIndex()
        return jpaDoc
    }
}
