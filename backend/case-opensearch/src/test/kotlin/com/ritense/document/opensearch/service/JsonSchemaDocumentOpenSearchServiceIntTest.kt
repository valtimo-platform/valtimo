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
import com.ritense.document.domain.impl.searchfield.SearchField
import com.ritense.document.domain.impl.searchfield.SearchFieldDataType
import com.ritense.document.domain.impl.searchfield.SearchFieldFieldType
import com.ritense.document.domain.impl.searchfield.SearchFieldId
import com.ritense.document.domain.impl.searchfield.SearchFieldMatchType
import com.ritense.document.domain.search.AdvancedSearchRequest
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.opensearch.domain.OsBlueprintId
import com.ritense.document.opensearch.domain.OsDefinitionId
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.service.DocumentSearchService
import com.ritense.valtimo.contract.blueprint.BlueprintType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.security.test.context.support.WithMockUser

@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class JsonSchemaDocumentOpenSearchServiceIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    lateinit var documentSearchService: DocumentSearchService

    @Autowired
    lateinit var documentRepository: JsonSchemaDocumentRepository

    @Test
    fun `globalSearchFilter returns matching document`() {
        seedDocument("Funenpark")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("Funenpark"),
            PageRequest.of(0, 10)
        )

        assertThat(page.totalElements).isEqualTo(1L)
    }

    @Test
    fun `globalSearchFilter is case insensitive`() {
        seedDocument("Funenpark")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("FUNENPARK"),
            PageRequest.of(0, 10)
        )

        assertThat(page.totalElements).isEqualTo(1L)
    }

    @Test
    fun `globalSearchFilter excludes non-matching documents`() {
        val docA = seedDocument("Funenpark")
        seedDocument("Keizersgracht")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("Funenpark"),
            PageRequest.of(0, 10)
        )

        assertThat(page.totalElements).isEqualTo(1L)
        assertThat(page.content[0].id()).isEqualTo(docA.id())
    }

    @Test
    fun `no globalSearchFilter returns all authorized documents`() {
        seedDocument("Funenpark")
        seedDocument("Keizersgracht")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest(),
            PageRequest.of(0, 10)
        )

        assertThat(page.totalElements).isEqualTo(2L)
    }

    @Test
    fun `globalSearchFilter supports partial match`() {
        seedDocument("Keizersgracht")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("Keizers"),
            PageRequest.of(0, 10)
        )

        assertThat(page.totalElements).isEqualTo(1L)
    }

    @Test
    fun `global search on doc field with LIKE matchType should use wildcards`() {
        searchFieldRepository.deleteAllByIdCaseDefinitionKey("house")
        val searchField = SearchField(
            "street", "doc:street", SearchFieldDataType.TEXT,
            SearchFieldFieldType.SINGLE, SearchFieldMatchType.LIKE, null, 0, "Street"
        )
        searchField.id = SearchFieldId.newId("house").newIdentity()
        searchFieldRepository.save(searchField)

        seedDocument("Funenpark")
        seedDocument("Keizersgracht")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("funen"),
            Pageable.unpaged()
        )

        assertThat(page.totalElements).isEqualTo(1L)
    }

    @Test
    fun `global search on doc field with EXACT matchType should not use wildcards`() {
        searchFieldRepository.deleteAllByIdCaseDefinitionKey("house")
        val searchField = SearchField(
            "street", "doc:street", SearchFieldDataType.TEXT,
            SearchFieldFieldType.SINGLE, SearchFieldMatchType.EXACT, null, 0, "Street"
        )
        searchField.id = SearchFieldId.newId("house").newIdentity()
        searchFieldRepository.save(searchField)

        seedDocument("Funenpark")
        seedDocument("Keizersgracht")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("funen"),
            Pageable.unpaged()
        )

        assertThat(page.totalElements).isEqualTo(0L)
    }

    @Test
    fun `global search on doc field with EXACT matchType should find exact match`() {
        searchFieldRepository.deleteAllByIdCaseDefinitionKey("house")
        val searchField = SearchField(
            "street", "doc:street", SearchFieldDataType.TEXT,
            SearchFieldFieldType.SINGLE, SearchFieldMatchType.EXACT, null, 0, "Street"
        )
        searchField.id = SearchFieldId.newId("house").newIdentity()
        searchFieldRepository.save(searchField)

        seedDocument("Funenpark")
        seedDocument("Keizersgracht")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("Funenpark"),
            Pageable.unpaged()
        )

        assertThat(page.totalElements).isEqualTo(1L)
    }

    @Test
    fun `global search on case field with LIKE matchType should use wildcards`() {
        searchFieldRepository.deleteAllByIdCaseDefinitionKey("house")
        val searchField = SearchField(
            "assignee", "case:assigneeFullName", SearchFieldDataType.TEXT,
            SearchFieldFieldType.SINGLE, SearchFieldMatchType.LIKE, null, 0, "Assignee"
        )
        searchField.id = SearchFieldId.newId("house").newIdentity()
        searchFieldRepository.save(searchField)

        val doc1 = seedDocumentWithAssignee("street1", "John Smith")
        val doc2 = seedDocumentWithAssignee("street2", "Jane Doe")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("john"),
            Pageable.unpaged()
        )

        assertThat(page.totalElements).isEqualTo(1L)
        assertThat(page.content[0].assigneeFullName()).isEqualTo("John Smith")
    }

    @Test
    fun `global search on case field with EXACT matchType should not use wildcards`() {
        searchFieldRepository.deleteAllByIdCaseDefinitionKey("house")
        val searchField = SearchField(
            "assignee", "case:assigneeFullName", SearchFieldDataType.TEXT,
            SearchFieldFieldType.SINGLE, SearchFieldMatchType.EXACT, null, 0, "Assignee"
        )
        searchField.id = SearchFieldId.newId("house").newIdentity()
        searchFieldRepository.save(searchField)

        seedDocumentWithAssignee("street1", "John Smith")
        seedDocumentWithAssignee("street2", "Jane Doe")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("john"),
            Pageable.unpaged()
        )

        assertThat(page.totalElements).isEqualTo(0L)
    }

    @Test
    fun `global search on case field with EXACT matchType should find exact match`() {
        searchFieldRepository.deleteAllByIdCaseDefinitionKey("house")
        val searchField = SearchField(
            "assignee", "case:assigneeFullName", SearchFieldDataType.TEXT,
            SearchFieldFieldType.SINGLE, SearchFieldMatchType.EXACT, null, 0, "Assignee"
        )
        searchField.id = SearchFieldId.newId("house").newIdentity()
        searchFieldRepository.save(searchField)

        val doc1 = seedDocumentWithAssignee("street1", "active")
        seedDocumentWithAssignee("street2", "inactive")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("active"),
            Pageable.unpaged()
        )

        assertThat(page.totalElements).isEqualTo(1L)
        assertThat(page.content[0].assigneeFullName()).isEqualTo("active")
    }

    @Test
    fun `global search with mixed LIKE and EXACT case fields should respect matchTypes`() {
        searchFieldRepository.deleteAllByIdCaseDefinitionKey("house")

        val likeField = SearchField(
            "assignee", "case:assigneeFullName", SearchFieldDataType.TEXT,
            SearchFieldFieldType.SINGLE, SearchFieldMatchType.LIKE, null, 0, "Assignee"
        )
        likeField.id = SearchFieldId.newId("house").newIdentity()

        val exactField = SearchField(
            "createdBy", "case:createdBy", SearchFieldDataType.TEXT,
            SearchFieldFieldType.SINGLE, SearchFieldMatchType.EXACT, null, 1, "Created By"
        )
        exactField.id = SearchFieldId.newId("house").newIdentity()

        searchFieldRepository.saveAll(listOf(likeField, exactField))

        seedDocumentWithAssignee("street1", "John Smith")
        seedDocumentWithAssignee("street2", "Jane Doe")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("john"),
            Pageable.unpaged()
        )

        assertThat(page.totalElements).isEqualTo(1L)
        assertThat(page.content[0].assigneeFullName()).isEqualTo("John Smith")
    }

    private fun seedDocument(street: String): JsonSchemaDocument {
        val content = objectMapper.createObjectNode().apply { put("street", street) }
        val jpaDoc = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest("house", "house", "1.0.0", content)
            ).resultingDocument().get()
        }
        openSearchRepository.save(
            JsonSchemaDocumentOsDocument(
                id = jpaDoc.id().toString(),
                content = mapOf("street" to street),
                definitionId = OsDefinitionId(
                    name = "house",
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
                contentText = street,
            )
        )
        elasticsearchOperations.indexOps(JsonSchemaDocumentOsDocument::class.java).refresh()
        return jpaDoc
    }

    private fun seedDocumentWithAssignee(street: String, assigneeFullName: String): JsonSchemaDocument {
        val content = objectMapper.createObjectNode().apply { put("street", street) }
        val jpaDoc = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest("house", "house", "1.0.0", content)
            ).resultingDocument().get()
        } as JsonSchemaDocument

        jpaDoc.setAssignee("user-${assigneeFullName.hashCode()}", assigneeFullName)
        documentRepository.save(jpaDoc)

        openSearchRepository.save(
            JsonSchemaDocumentOsDocument(
                id = jpaDoc.id().toString(),
                content = mapOf("street" to street),
                definitionId = OsDefinitionId(
                    name = "house",
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
                assigneeId = "user-${assigneeFullName.hashCode()}",
                assigneeFullName = assigneeFullName,
                internalStatus = null,
                caseTags = null,
                relations = null,
                relatedFiles = null,
                retentionDate = null,
                contentText = street,
            )
        )
        refreshIndex()
        return jpaDoc
    }
}
