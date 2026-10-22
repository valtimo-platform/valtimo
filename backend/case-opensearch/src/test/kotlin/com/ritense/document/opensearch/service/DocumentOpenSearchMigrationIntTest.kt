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
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
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
 * Phase 3 — legacy-index migration, stale/legacy detection and the alias-swap rebuild.
 *
 * Runs non-transactionally ([Propagation.NOT_SUPPORTED]) like the re-index integration test, because the
 * re-index commits its run-state in its own short transactions and reads documents from committed state.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class DocumentOpenSearchMigrationIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    lateinit var reindexService: DocumentOpenSearchReindexService

    @Autowired
    lateinit var reindexRunService: OpenSearchReindexRunService

    @Autowired
    lateinit var converter: JsonSchemaDocumentOsConverter

    @Autowired
    lateinit var openSearchService: JsonSchemaDocumentOpenSearchService

    @AfterEach
    fun cleanUp() {
        runWithoutAuthorization { documentService.removeDocuments("house") }
        openSearchRepository.deleteAll()
        refreshIndex()
        indexInitializer.dropIndex(OpenSearchIndexNameResolver.LEGACY_INDEX)
    }

    @Test
    fun `a present legacy single index makes the topology legacy or stale`() {
        assertThat(indexInitializer.isLegacyOrStale()).isFalse()

        elasticsearchOperations.indexOps(IndexCoordinates.of(OpenSearchIndexNameResolver.LEGACY_INDEX)).create()

        assertThat(indexInitializer.isLegacyOrStale()).isTrue()
    }

    @Test
    fun `an unscoped migrate run reindexes off the legacy index, drops it, and populates the case list`() {
        elasticsearchOperations.indexOps(IndexCoordinates.of(OpenSearchIndexNameResolver.LEGACY_INDEX)).create()
        val docs = (1..3).map { createHouseDocument("street-$it") }
        clearIndex()
        assertThat(indexInitializer.isLegacyOrStale()).isTrue()

        runReindex(ReindexRequest(recreateIndex = true))

        assertThat(legacyExists()).isFalse()
        assertThat(indexInitializer.isLegacyOrStale()).isFalse()
        refreshIndex()
        val houseList = openSearchService.search("house", BlueprintType.CASE, AdvancedSearchRequest(), PageRequest.of(0, 10))
        assertThat(houseList.content.map { it.id() }).containsExactlyInAnyOrderElementsOf(docs.map { it.id() })
    }

    @Test
    fun `a scoped rebuild alias-swaps onto a fresh index without dropping documents from the shared alias`() {
        val docs = (1..4).map { createHouseDocument("street-$it") }
        clearIndex()
        docs.forEach { indexOsDocument(converter.toOsDocument(it)) }
        refreshIndex()

        val concreteBefore = concreteBehindHouseAlias()
        assertThat(countInIndex(OpenSearchIndexNameResolver.READ_ALIAS)).isEqualTo(4L)

        runReindex(ReindexRequest(documentDefinitionName = "house", recreateIndex = true))

        refreshIndex()
        // The alias now fronts a brand-new concrete index, and every document survived the swap.
        val concreteAfter = concreteBehindHouseAlias()
        assertThat(concreteAfter).isNotEqualTo(concreteBefore)
        assertThat(legacyIndexExists(concreteBefore)).isFalse()
        assertThat(countInIndex(OpenSearchIndexNameResolver.READ_ALIAS)).isEqualTo(4L)

        val houseList = openSearchService.search("house", BlueprintType.CASE, AdvancedSearchRequest(), PageRequest.of(0, 10))
        assertThat(houseList.content.map { it.id() }).containsExactlyInAnyOrderElementsOf(docs.map { it.id() })

        // Writes still route through the stable per-definition alias onto the swapped-in index.
        val extra = createHouseDocument("after-rebuild")
        indexOsDocument(converter.toOsDocument(extra))
        refreshIndex()
        assertThat(countInIndex(OpenSearchIndexNameResolver.READ_ALIAS)).isEqualTo(5L)
    }

    private fun concreteBehindHouseAlias(): String {
        val alias = indexNameResolver.indexNameFor("house")
        return elasticsearchOperations.indexOps(IndexCoordinates.of(alias))
            .getAliasesForIndex(alias)
            .keys
            .single()
    }

    private fun legacyExists(): Boolean =
        elasticsearchOperations.indexOps(IndexCoordinates.of(OpenSearchIndexNameResolver.LEGACY_INDEX)).exists()

    private fun legacyIndexExists(name: String): Boolean =
        elasticsearchOperations.indexOps(IndexCoordinates.of(name)).exists()

    private fun countInIndex(indexName: String): Long {
        val query = NativeSearchQueryBuilder().withQuery(QueryBuilders.matchAllQuery()).build()
        return elasticsearchOperations.count(query, JsonSchemaDocumentOsDocument::class.java, IndexCoordinates.of(indexName))
    }

    private fun clearIndex() {
        openSearchRepository.deleteAll()
        refreshIndex()
    }

    private fun runReindex(request: ReindexRequest) {
        val run = reindexRunService.startOrResume(request)
        reindexService.reindex(run.id)
    }

    private fun createHouseDocument(street: String): JsonSchemaDocument =
        runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest("house", "house", "1.0.0", objectMapper.createObjectNode().put("street", street))
            ).resultingDocument().get()
        }
}
