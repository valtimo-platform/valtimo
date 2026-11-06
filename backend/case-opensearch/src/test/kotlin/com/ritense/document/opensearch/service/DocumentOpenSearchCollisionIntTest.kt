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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.document.opensearch.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.domain.search.AdvancedSearchRequest
import com.ritense.document.domain.search.SearchWithConfigRequest
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.opensearch.domain.OsBlueprintId
import com.ritense.document.opensearch.domain.OsDefinitionId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageRequest
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional

/**
 * Regression test for gzac-issues #924. Two definitions put the **same** `content.locatie` path at different
 * JSON types (a string in one case type, an object in the other). On the old single shared index the second
 * document collided with a `mapper_parsing_exception` and its case list came back empty. With one index per
 * definition each indexes cleanly into its own mapping namespace and both case lists populate.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class DocumentOpenSearchCollisionIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    lateinit var openSearchService: JsonSchemaDocumentOpenSearchService

    @AfterEach
    fun cleanUp() {
        runWithoutAuthorization {
            documentService.removeDocuments("house")
            documentService.removeDocuments("person")
        }
        openSearchRepository.deleteAll()
        refreshIndex()
        elasticsearchOperations.indexOps(IndexCoordinates.of(LEGACY_INDEX)).delete()
    }

    @Test
    fun `same content path at different JSON types indexes into both per-definition indices without collision`() {
        val houseDoc = seedWithLocatie("house", "Amsterdam")
        val personDoc = seedWithLocatie("person", mapOf("type" to "Point", "coordinates" to listOf(4.9, 52.4)))
        refreshIndex()

        val houseList = openSearchService.search("house", BlueprintType.CASE, AdvancedSearchRequest(), PageRequest.of(0, 10))
        val personList = openSearchService.search("person", BlueprintType.CASE, AdvancedSearchRequest(), PageRequest.of(0, 10))
        val groupList = openSearchService.search(
            listOf("house", "person"), BlueprintType.CASE, SearchWithConfigRequest(), emptyMap(), emptyMap(), PageRequest.of(0, 10)
        )

        assertThat(houseList.content.map { it.id() }).contains(houseDoc.id())
        assertThat(personList.content.map { it.id() }).contains(personDoc.id())
        assertThat(groupList.content.map { it.id() }).contains(houseDoc.id(), personDoc.id())
    }

    @Test
    fun `the same two documents in one shared index still collide - proving the per-definition fix is what resolves it`() {
        val legacy = IndexCoordinates.of(LEGACY_INDEX)
        // A single shared index with default dynamic mapping: content.locatie is type-locked by the first
        // document (string -> text), so the second document's object value collides — exactly #924.
        elasticsearchOperations.indexOps(legacy).create()

        elasticsearchOperations.save(osDocument("a", "house", "Amsterdam"), legacy)
        elasticsearchOperations.indexOps(legacy).refresh()

        assertThatThrownBy {
            elasticsearchOperations.save(
                osDocument("b", "person", mapOf("type" to "Point", "coordinates" to listOf(4.9, 52.4))),
                legacy
            )
        }.isInstanceOf(Exception::class.java)
    }

    private fun seedWithLocatie(definitionName: String, locatie: Any): JsonSchemaDocument {
        val jpaDoc = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(
                    definitionName,
                    definitionName,
                    "1.0.0",
                    objectMapper.createObjectNode().put(if (definitionName == "house") "street" else "firstName", "x"),
                )
            ).resultingDocument().get()
        }
        indexOsDocument(osDocument(jpaDoc.id().toString(), definitionName, locatie))
        return jpaDoc
    }

    private fun osDocument(id: String, definitionName: String, locatie: Any) = JsonSchemaDocumentOsDocument(
        id = id,
        content = mapOf("locatie" to locatie),
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
        contentText = locatie.toString(),
    )

    companion object {
        private const val LEGACY_INDEX = "json_schema_document_collision_repro"
    }
}
