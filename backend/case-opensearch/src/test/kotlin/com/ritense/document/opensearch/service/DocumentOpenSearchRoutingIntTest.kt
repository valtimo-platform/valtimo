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
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.opensearch.data.client.orhlc.NativeSearchQueryBuilder
import org.opensearch.index.query.QueryBuilders
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageRequest
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional

/**
 * Verifies read/write routing across the three scopes: a write lands in its definition's own index; a
 * single-definition read targets that index; a group read targets the set's indices; and the shared read
 * alias spans all per-definition indices ("All cases").
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class DocumentOpenSearchRoutingIntTest : BaseOpenSearchIntegrationTest() {

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
    }

    @Test
    fun `each write lands only in its own definition's index while the alias spans both`() {
        seed("house")
        seed("person")
        refreshIndex()

        assertThat(countInIndex(indexNameResolver.indexNameFor("house"))).isEqualTo(1L)
        assertThat(countInIndex(indexNameResolver.indexNameFor("person"))).isEqualTo(1L)
        assertThat(countInIndex(OpenSearchIndexNameResolver.READ_ALIAS)).isEqualTo(2L)
    }

    @Test
    fun `a single-definition read targets only that definition while a group read spans the set`() {
        val houseDoc = seed("house")
        val personDoc = seed("person")
        refreshIndex()

        val houseOnly = openSearchService.search("house", BlueprintType.CASE, AdvancedSearchRequest(), PageRequest.of(0, 10))
        val group = openSearchService.search(
            listOf("house", "person"), BlueprintType.CASE, SearchWithConfigRequest(), emptyMap(), emptyMap(), PageRequest.of(0, 10)
        )

        assertThat(houseOnly.content.map { it.id() }).containsExactly(houseDoc.id())
        assertThat(group.content.map { it.id() }).contains(houseDoc.id(), personDoc.id())
    }

    private fun countInIndex(indexName: String): Long {
        val query = NativeSearchQueryBuilder().withQuery(QueryBuilders.matchAllQuery()).build()
        return elasticsearchOperations.count(query, JsonSchemaDocumentOsDocument::class.java, IndexCoordinates.of(indexName))
    }

    private fun seed(definitionName: String): JsonSchemaDocument {
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
        indexOsDocument(
            JsonSchemaDocumentOsDocument(
                id = jpaDoc.id().toString(),
                content = mapOf("field" to "x"),
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
                contentText = "x",
            )
        )
        return jpaDoc
    }
}
