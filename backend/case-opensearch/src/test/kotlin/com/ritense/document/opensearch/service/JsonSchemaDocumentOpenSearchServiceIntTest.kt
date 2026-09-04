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
import com.ritense.document.domain.search.SearchWithConfigRequest
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
import org.springframework.data.domain.Sort
import org.springframework.security.test.context.support.WithMockUser

@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class JsonSchemaDocumentOpenSearchServiceIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    lateinit var documentSearchService: DocumentSearchService

    @Autowired
    lateinit var documentRepository: JsonSchemaDocumentRepository

    // Bypasses DelegatingDocumentSearchService, so the engine toggle cannot route these assertions to JPA
    @Autowired
    lateinit var openSearchDocumentSearchService: JsonSchemaDocumentOpenSearchService

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

    @Test
    fun `multiple search terms with mixed doc and case fields should match all terms`() {
        searchFieldRepository.deleteAllByIdCaseDefinitionKey("house")

        val streetField = SearchField(
            "street", "doc:street", SearchFieldDataType.TEXT,
            SearchFieldFieldType.SINGLE, SearchFieldMatchType.LIKE, null, 0, "Street"
        )
        streetField.id = SearchFieldId.newId("house").newIdentity()

        val assigneeField = SearchField(
            "assignee", "case:assigneeFullName", SearchFieldDataType.TEXT,
            SearchFieldFieldType.SINGLE, SearchFieldMatchType.LIKE, null, 1, "Assignee"
        )
        assigneeField.id = SearchFieldId.newId("house").newIdentity()

        searchFieldRepository.saveAll(listOf(streetField, assigneeField))

        seedDocumentWithAssignee("Funenpark", "John Smith")
        seedDocumentWithAssignee("Keizersgracht", "John Doe")
        seedDocumentWithAssignee("Funenpark", "Jane Doe")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("funen john"),
            Pageable.unpaged()
        )

        assertThat(page.totalElements).isEqualTo(1L)
        assertThat(page.content[0].assigneeFullName()).isEqualTo("John Smith")
    }

    @Test
    fun `multiple search terms with EXACT doc field should require exact match for each term`() {
        searchFieldRepository.deleteAllByIdCaseDefinitionKey("house")

        val streetField = SearchField(
            "street", "doc:street", SearchFieldDataType.TEXT,
            SearchFieldFieldType.SINGLE, SearchFieldMatchType.EXACT, null, 0, "Street"
        )
        streetField.id = SearchFieldId.newId("house").newIdentity()

        val userInfoField = SearchField(
            "userInfo", "doc:userInfo", SearchFieldDataType.TEXT,
            SearchFieldFieldType.SINGLE, SearchFieldMatchType.EXACT, null, 1, "User Info"
        )
        userInfoField.id = SearchFieldId.newId("house").newIdentity()

        searchFieldRepository.saveAll(listOf(streetField, userInfoField))

        seedDocumentWithContent(mapOf("street" to "active", "userInfo" to "urgent"))
        seedDocumentWithContent(mapOf("street" to "active", "userInfo" to "normal"))
        seedDocumentWithContent(mapOf("street" to "inactive", "userInfo" to "urgent"))

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("active urgent"),
            Pageable.unpaged()
        )

        assertThat(page.totalElements).isEqualTo(1L)
    }

    @Test
    fun `multiple search terms with mixed LIKE and EXACT fields should apply correct matching`() {
        searchFieldRepository.deleteAllByIdCaseDefinitionKey("house")

        val streetField = SearchField(
            "street", "doc:street", SearchFieldDataType.TEXT,
            SearchFieldFieldType.SINGLE, SearchFieldMatchType.LIKE, null, 0, "Street"
        )
        streetField.id = SearchFieldId.newId("house").newIdentity()

        val userInfoField = SearchField(
            "userInfo", "doc:userInfo", SearchFieldDataType.TEXT,
            SearchFieldFieldType.SINGLE, SearchFieldMatchType.EXACT, null, 1, "User Info"
        )
        userInfoField.id = SearchFieldId.newId("house").newIdentity()

        searchFieldRepository.saveAll(listOf(streetField, userInfoField))

        seedDocumentWithContent(mapOf("street" to "Funenpark", "userInfo" to "active"))
        seedDocumentWithContent(mapOf("street" to "Keizersgracht", "userInfo" to "active"))
        seedDocumentWithContent(mapOf("street" to "Funenpark", "userInfo" to "inactive"))

        val pageLikeAndExact = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("funen active"),
            Pageable.unpaged()
        )
        assertThat(pageLikeAndExact.totalElements).isEqualTo(1L)

        val pagePartialExactFails = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("funen act"),
            Pageable.unpaged()
        )
        assertThat(pagePartialExactFails.totalElements).isEqualTo(0L)
    }

    @Test
    fun `multi-term search where each term matches different field group should find document`() {
        searchFieldRepository.deleteAllByIdCaseDefinitionKey("house")

        val streetField = SearchField(
            "street", "doc:street", SearchFieldDataType.TEXT,
            SearchFieldFieldType.SINGLE, SearchFieldMatchType.LIKE, null, 0, "Street"
        )
        streetField.id = SearchFieldId.newId("house").newIdentity()

        val buildDateField = SearchField(
            "buildDate", "doc:buildDate", SearchFieldDataType.TEXT,
            SearchFieldFieldType.SINGLE, SearchFieldMatchType.EXACT, null, 1, "Build Date"
        )
        buildDateField.id = SearchFieldId.newId("house").newIdentity()

        searchFieldRepository.saveAll(listOf(streetField, buildDateField))

        seedDocumentWithContent(mapOf("street" to "Funenpark", "buildDate" to "2024"))
        seedDocumentWithContent(mapOf("street" to "Keizersgracht", "buildDate" to "2023"))
        seedDocumentWithContent(mapOf("street" to "Alexanderplein", "buildDate" to "2024"))

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest().globalSearchFilter("funen 2024"),
            Pageable.unpaged()
        )

        assertThat(page.totalElements).isEqualTo(1L)
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

    @Test
    fun `should sort by doc field using doc prefix`() {
        val docA = seedDocument("Apple Street")
        val docB = seedDocument("Zebra Lane")
        val docC = seedDocument("Maple Avenue")

        val pageAsc = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest(),
            PageRequest.of(0, 10, Sort.by(Sort.Direction.ASC, "doc:street"))
        )

        assertThat(pageAsc.totalElements).isEqualTo(3L)
        assertThat(pageAsc.content[0].id()).isEqualTo(docA.id())
        assertThat(pageAsc.content[1].id()).isEqualTo(docC.id())
        assertThat(pageAsc.content[2].id()).isEqualTo(docB.id())

        val pageDesc = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest(),
            PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "doc:street"))
        )

        assertThat(pageDesc.totalElements).isEqualTo(3L)
        assertThat(pageDesc.content[0].id()).isEqualTo(docB.id())
        assertThat(pageDesc.content[1].id()).isEqualTo(docC.id())
        assertThat(pageDesc.content[2].id()).isEqualTo(docA.id())
    }

    @Test
    fun `search should return disjunct pages when all documents share the same assigneeFullName`() {
        repeat(25) { seedDocumentWithAssignee("Funenpark", "Beth Xander") }

        val sort = Sort.by(Sort.Direction.DESC, "assigneeFullName")
        val firstPageIds = searchDocumentIds(PageRequest.of(0, 10, sort))
        val secondPageIds = searchDocumentIds(PageRequest.of(1, 10, sort))

        assertThat(firstPageIds).hasSize(10)
        assertThat(firstPageIds).doesNotContainAnyElementsOf(secondPageIds)
        assertThat(firstPageIds + secondPageIds).isSorted()
    }

    private fun searchDocumentIds(pageable: Pageable): List<String> =
        openSearchDocumentSearchService.search("house", BlueprintType.CASE, AdvancedSearchRequest(), pageable)
            .content.map { it.id().toString() }

    private fun seedDocumentWithContent(contentMap: Map<String, String>): JsonSchemaDocument {
        val content = objectMapper.createObjectNode().apply {
            contentMap.forEach { (key, value) -> put(key, value) }
        }
        val jpaDoc = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest("house", "house", "1.0.0", content)
            ).resultingDocument().get()
        }
        openSearchRepository.save(
            JsonSchemaDocumentOsDocument(
                id = jpaDoc.id().toString(),
                content = contentMap,
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
                contentText = contentMap.values.joinToString(" "),
            )
        )
        refreshIndex()
        return jpaDoc
    }

    @Test
    fun `unpaged search should return more than default OpenSearch size of 10 documents`() {
        repeat(15) { i ->
            seedDocument("Street $i")
        }

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest(),
            Pageable.unpaged()
        )

        assertThat(page.totalElements).isEqualTo(15L)
        assertThat(page.content)
            .describedAs("Unpaged search should return all 15 documents, not default OpenSearch size of 10")
            .hasSize(15)
    }

    @Test
    fun `unpaged search with sort should return all documents in correct order`() {
        val docA = seedDocument("Alpha Street")
        val docB = seedDocument("Beta Street")
        val docC = seedDocument("Gamma Street")
        val docD = seedDocument("Delta Street")
        val docE = seedDocument("Epsilon Street")
        val docF = seedDocument("Zeta Street")
        val docG = seedDocument("Eta Street")
        val docH = seedDocument("Theta Street")
        val docI = seedDocument("Iota Street")
        val docJ = seedDocument("Kappa Street")
        val docK = seedDocument("Lambda Street")
        val docL = seedDocument("Mu Street")

        val page = documentSearchService.search(
            "house",
            BlueprintType.CASE,
            AdvancedSearchRequest(),
            Pageable.unpaged(Sort.by(Sort.Direction.ASC, "doc:street"))
        )

        assertThat(page.totalElements).isEqualTo(12L)
        assertThat(page.content).hasSize(12)
        assertThat(page.content[0].id()).isEqualTo(docA.id())
        assertThat(page.content[1].id()).isEqualTo(docB.id())
    }

    @Test
    fun `searchForExport with unpaged should return more than default OpenSearch size of 10 documents`() {
        repeat(15) { i ->
            seedDocument("Street $i")
        }

        val page = documentSearchService.searchForExport(
            "house",
            BlueprintType.CASE,
            SearchWithConfigRequest(),
            Pageable.unpaged()
        )

        assertThat(page.totalElements).isEqualTo(15L)
        assertThat(page.content)
            .describedAs("Export with unpaged should return all 15 documents, not default OpenSearch size of 10")
            .hasSize(15)
    }
}
