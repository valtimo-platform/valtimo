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
import com.ritense.document.opensearch.domain.ReindexRunStatus
import com.ritense.valtimo.contract.blueprint.BlueprintType
import jakarta.persistence.EntityManager
import net.javacrumbs.shedlock.core.LockProvider
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argThat
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.eq
import org.mockito.kotlin.spy
import org.mockito.kotlin.whenever
import org.opensearch.data.client.orhlc.NativeSearchQueryBuilder
import org.opensearch.index.query.QueryBuilders
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageRequest
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import org.springframework.transaction.PlatformTransactionManager
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

    @Autowired
    lateinit var entityManager: EntityManager

    @Autowired
    lateinit var transactionManager: PlatformTransactionManager

    @Autowired
    lateinit var lockProvider: LockProvider

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

    @Test
    fun `a migrate run that skips a document keeps the legacy index in place`() {
        elasticsearchOperations.indexOps(IndexCoordinates.of(OpenSearchIndexNameResolver.LEGACY_INDEX)).create()
        val docs = (1..3).map { createHouseDocument("street-$it") }
        clearIndex()
        assertThat(indexInitializer.isLegacyOrStale()).isTrue()

        val failingId = docs.first().id().id
        val skippingConverter = spy(converter)
        doThrow(RuntimeException("conversion boom"))
            .whenever(skippingConverter).toOsDocument(argThat { id().id == failingId })

        reindexWith(skippingConverter, ReindexRequest(recreateIndex = true)).also { runId ->
            // A skipped document means the freshly built topology is missing it, so the legacy index must stay.
            assertThat(legacyExists()).isTrue()
            assertThat(indexInitializer.isLegacyOrStale()).isTrue()
            assertThat(reindexRunService.toStatusMap(runId)["status"]).isEqualTo(ReindexRunStatus.COMPLETED_WITH_ERRORS)
        }
    }

    @Test
    fun `a scoped rebuild re-indexes a write that landed in the old index during the rebuild`() {
        val document = createHouseDocument("concurrent")
        val id = document.id().id
        clearIndex()

        // Spy the initializer so that, when the swap runs (after the whole fill has indexed the pre-change state),
        // a concurrent write mutates the document in Postgres — the write that would land in the dropped old index.
        val spyInitializer = spy(indexInitializer)
        doAnswer { invocation ->
            runWithoutAuthorization { documentService.setInternalStatus(document.id(), "started") }
            invocation.callRealMethod()
        }.whenever(spyInitializer).swapInRebuiltIndex(eq("house"), any())

        val service = DocumentOpenSearchReindexService(
            entityManager, converter, elasticsearchOperations, transactionManager,
            lockProvider, reindexRunService, indexNameResolver, spyInitializer,
        )
        val run = reindexRunService.startOrResume(ReindexRequest(documentDefinitionName = "house", recreateIndex = true))
        service.reindex(run.id)

        refreshIndex()
        // The post-swap catch-up re-read the latest Postgres state, so the concurrent status change is present
        // in the swapped index — not lost with the dropped old index (where the fill's status-less copy would be).
        val indexed = findIndexedOptional(id.toString())
        assertThat(indexed).isPresent
        assertThat(indexed.get().internalStatus).isEqualTo("started")
    }

    private fun reindexWith(converter: JsonSchemaDocumentOsConverter, request: ReindexRequest): java.util.UUID {
        val service = DocumentOpenSearchReindexService(
            entityManager, converter, elasticsearchOperations, transactionManager,
            lockProvider, reindexRunService, indexNameResolver, indexInitializer,
        )
        val run = reindexRunService.startOrResume(request)
        service.reindex(run.id)
        return run.id
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
