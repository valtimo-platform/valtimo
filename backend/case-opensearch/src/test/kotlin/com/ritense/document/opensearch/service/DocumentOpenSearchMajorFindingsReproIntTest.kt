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
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.domain.search.AdvancedSearchRequest
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.opensearch.OpenSearchProperties
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.opensearch.domain.OpenSearchReconcileState
import com.ritense.document.opensearch.domain.PendingIndexDeletion
import com.ritense.document.opensearch.domain.ReindexRunStatus
import com.ritense.document.opensearch.health.OpenSearchMappingHealthIndicator
import com.ritense.document.opensearch.repository.OpenSearchReconcileStateRepository
import com.ritense.document.opensearch.repository.PendingIndexDeletionRepository
import com.ritense.document.opensearch.web.SearchEngineResource
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.valtimo.contract.blueprint.BlueprintType
import jakarta.persistence.EntityManager
import net.javacrumbs.shedlock.core.LockProvider
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.SoftAssertions.assertSoftly
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.spy
import org.mockito.kotlin.whenever
import org.opensearch.action.admin.cluster.health.ClusterHealthRequest
import org.opensearch.action.admin.cluster.settings.ClusterUpdateSettingsRequest
import org.opensearch.client.RequestOptions
import org.opensearch.client.RestHighLevelClient
import org.opensearch.common.settings.Settings
import org.opensearch.data.client.orhlc.NativeSearchQueryBuilder
import org.opensearch.index.query.QueryBuilders
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.actuate.health.Status
import org.springframework.data.domain.PageRequest
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.util.AopTestUtils
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import java.time.LocalDateTime
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Reproduction tests for the MAJOR findings (F5–F12) of the second per-definition OpenSearch review.
 *
 * Same convention as [DocumentOpenSearchDefectReproIntTest]: every test asserts the CORRECT behaviour, so a red test
 * confirms the finding and a green test refutes it. Controls rule out harness artifacts.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class DocumentOpenSearchMajorFindingsReproIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    lateinit var reindexRunService: OpenSearchReindexRunService

    @Autowired
    lateinit var reconcileService: DocumentOpenSearchReconcileService

    @Autowired
    lateinit var syncService: DocumentOpenSearchSyncService

    @Autowired
    lateinit var converter: JsonSchemaDocumentOsConverter

    @Autowired
    lateinit var delegatingSearchService: DelegatingDocumentSearchService

    @Autowired
    lateinit var searchEngineResource: SearchEngineResource

    @Autowired
    lateinit var stateRepository: OpenSearchReconcileStateRepository

    @Autowired
    lateinit var pendingIndexDeletionRepository: PendingIndexDeletionRepository

    @Autowired
    lateinit var documentRepository: JsonSchemaDocumentRepository

    @Autowired
    lateinit var openSearchProperties: OpenSearchProperties

    @Autowired
    lateinit var entityManager: EntityManager

    @Autowired
    lateinit var transactionManager: PlatformTransactionManager

    @Autowired
    lateinit var lockProvider: LockProvider

    @Autowired
    lateinit var restHighLevelClient: RestHighLevelClient

    private val rebuildIndices = mutableListOf<String>()

    @BeforeEach
    fun resetWriteFailureSignal() {
        // The write-failure timestamp lives on the shared initializer bean and survives 5 minutes, so a rejection
        // recorded by another test class would make the health assertions here pass for the wrong reason.
        val target = AopTestUtils.getUltimateTargetObject<DocumentOpenSearchIndexInitializer>(indexInitializer)
        DocumentOpenSearchIndexInitializer::class.java.getDeclaredField("lastWriteFailureAt").apply {
            isAccessible = true
            setLong(target, 0L)
        }
        stateRepository.deleteAll()
    }

    @AfterEach
    fun cleanUp() {
        resetShardLimit()
        runWithoutAuthorization { documentService.removeDocuments("house") }
        stateRepository.deleteAll()
        pendingIndexDeletionRepository.deleteAll()
        EXTRA_VERSION_TAGS.forEach { tag -> dropConcretesBehind(indexNameResolver.writeAliasFor("house", tag)) }
        TEST_DEFINITION_KEYS.forEach { key -> dropConcretesBehind(indexNameResolver.indexNameFor(key)) }
        rebuildIndices.forEach { indexInitializer.dropIndex(it) }
        rebuildIndices.clear()
        indexInitializer.dropIndex(OpenSearchIndexNameResolver.LEGACY_INDEX)
        TEST_DEFINITION_KEYS.forEach { indexInitializer.ensureIndex(it, TEST_VERSION_TAG) }
    }

    // ---------------------------------------------------------------- F5

    @Test
    fun `F5 control - prune keeps the active version index when it holds documents`() {
        indexOsDocument(houseOsDocument(versionTag = TEST_VERSION_TAG))
        indexOsDocument(houseOsDocument(versionTag = OLD_VERSION_TAG))
        refreshIndex()

        freshReconcileService().reconcile()

        assertThat(indexExists(indexNameResolver.writeAliasFor("house", TEST_VERSION_TAG))).`as`("CONTROL").isTrue()
        assertThat(indexInitializer.isLegacyOrStale()).`as`("CONTROL").isFalse()
    }

    @Test
    fun `F5 prune must not drop the empty index of the active version`() {
        // Cases still live on an older (no longer active) version; the active house 1.0.0 has no cases yet.
        indexOsDocument(houseOsDocument(versionTag = OLD_VERSION_TAG))
        refreshIndex()
        assertThat(indexInitializer.isLegacyOrStale()).`as`("precondition: healthy topology").isFalse()
        assertThat(countIn(indexNameResolver.writeAliasFor("house", TEST_VERSION_TAG)))
            .`as`("precondition: the active version index is empty").isZero()
        assertThat(countIn(indexNameResolver.writeAliasFor("house", OLD_VERSION_TAG)))
            .`as`("precondition: the old version index holds the case").isEqualTo(1L)
        // No house 1.0.0 case may exist in PostgreSQL, or the reconcile cycle upserts it before pruning.
        runWithoutAuthorization { documentService.removeDocuments("house") }

        freshReconcileService().reconcile()

        val activeAlias = indexNameResolver.writeAliasFor("house", TEST_VERSION_TAG)
        if (indexExists(activeAlias)) {
            assertThat(countIn(activeAlias)).`as`("precondition: the reconcile did not fill the active index").isZero()
        }
        assertSoftly { soft ->
            soft.assertThat(indexExists(indexNameResolver.writeAliasFor("house", TEST_VERSION_TAG)))
                .`as`("F5: the active version's write alias must survive the prune").isTrue()
            soft.assertThat(indexInitializer.isLegacyOrStale())
                .`as`("F5: pruning must not flip the topology to legacy/stale (all search to PostgreSQL)").isFalse()
        }
    }

    // ---------------------------------------------------------------- F6

    @Test
    fun `F6 enabling OpenSearch on an existing install must not show empty case lists`() {
        // Long-lived cases with different change times, as on a real install.
        val docs = (1..3L).map { hoursAgo -> createHouseDocument("case-$hoursAgo").also { backdate(it, hoursAgo) } }
        clearIndex()

        val controlIds = searchHouseIds()
        assertThat(controlIds).`as`("CONTROL: PostgreSQL lists the cases").containsAll(docs.map { it.id() })

        searchEngineResource.setActive(SearchEngineResource.UpdateSearchEngineDto("OPENSEARCH"))
        reconcileService.reconcile()
        refreshIndex()
        expireTopologyCache()

        val ids = searchHouseIds()
        assertThat(ids)
            .`as`("F6: after switching to OpenSearch (+1 reconcile cycle) the case list must still show the cases; found $ids")
            .containsAll(docs.map { it.id() })
    }

    // ---------------------------------------------------------------- F7

    @Test
    fun `F7 a non-recreate reindex that skips a case must not serve a list without it`() {
        val contentConverter = oversizedContentConverter()
        val rejected = createHouseDocument("rejected")
        val fine = createHouseDocument("fine")
        clearIndex()

        val run = reindexRunService.startOrResume(ReindexRequest())
        newReindexService(contentConverter, indexInitializer).reindex(run.id)
        refreshIndex()
        assertThat(reindexRunService.toStatusMap(run.id)["status"])
            .`as`("precondition: the run reports the skip").isEqualTo(ReindexRunStatus.COMPLETED_WITH_ERRORS)

        val controlIds = searchHouseIds()
        assertThat(controlIds).`as`("CONTROL: PostgreSQL lists both").contains(rejected.id(), fine.id())

        searchEngineToggle.set(SearchEngineToggle.Engine.OPENSEARCH)
        expireTopologyCache()
        val ids = searchHouseIds()
        assertThat(ids).`as`("precondition: the indexed case is listed").contains(fine.id())
        assertThat(ids)
            .`as`("F7: the case list after a reindex with skips must still contain the skipped case; found $ids")
            .contains(rejected.id())
    }

    // ---------------------------------------------------------------- F8

    @Test
    fun `F8 control - a long string at the top level of content indexes`() {
        val doc = houseOsDocument(content = mapOf("data" to LONG_VALUE))

        assertThat(converter.indexChunk(listOf(doc))).`as`("CONTROL: skipped").isZero()
        refreshIndex()
        assertThat(findIndexedById(doc.id)).`as`("CONTROL").isNotNull()
    }

    @Test
    fun `F8 a long string inside an object must not reject the whole case`() {
        val doc = houseOsDocument(content = mapOf("bijlage" to mapOf("data" to LONG_VALUE)))

        val skipped = converter.indexChunk(listOf(doc))
        refreshIndex()

        assertSoftly { soft ->
            soft.assertThat(skipped).`as`("F8: a ${LONG_VALUE.length}-byte nested leaf was rejected").isZero()
            soft.assertThat(findIndexedById(doc.id)).`as`("F8: case with a long nested leaf findable").isNotNull()
        }
    }

    // ---------------------------------------------------------------- F9

    @Test
    fun `F9 a permanently rejected case must not make the reconciler rescan every later case each cycle`() {
        val sentIds = mutableListOf<String>()
        val contentConverter = oversizedContentConverter().also { spyConverter ->
            doAnswer { invocation ->
                sentIds += invocation.getArgument<List<JsonSchemaDocumentOsDocument>>(0).map { it.id }
                invocation.callRealMethod()
            }.whenever(spyConverter).indexChunk(any(), anyOrNull())
        }
        val rejected = createHouseDocument("rejected")
        val later = (1..3).map { createHouseDocument("later-$it") }
        val newest = createHouseDocument("newest")
        backdate(rejected, hoursAgo = 3)
        later.forEach { backdate(it, hoursAgo = 2) }
        backdate(newest, hoursAgo = 1)
        clearIndex()
        stateRepository.save(OpenSearchReconcileState(watermark = LocalDateTime.now().minusHours(4)))
        val reconciler = freshReconcileService(contentConverter)

        reconciler.reconcile()
        refreshIndex()
        assertThat(later.map { findIndexedById(it.id().id.toString()) }).`as`("CONTROL: later cases indexed").doesNotContainNull()

        sentIds.clear()
        reconciler.reconcile()
        val resentLater = later.map { it.id().id.toString() }.filter { it in sentIds }

        assertSoftly { soft ->
            soft.assertThat(resentLater)
                .`as`("F9: cases already indexed in cycle 1 are re-sent in cycle 2 because the watermark is pinned")
                .isEmpty()
            soft.assertThat(OpenSearchMappingHealthIndicator(topologyGate, indexInitializer).health().status)
                .`as`("F9: a reconciler rejection must give an operator signal")
                .isNotEqualTo(Status.UP)
        }
    }

    // ---------------------------------------------------------------- F10

    @Test
    fun `F10 hitting the shard limit for one new version must not stop indexing of other cases`() {
        val newVersion = createHouseDocument("needs-new-index")
        val fine = createHouseDocument("fine")
        backdate(newVersion, hoursAgo = 2)
        backdate(fine, hoursAgo = 1)
        clearIndex()
        stateRepository.save(OpenSearchReconcileState(watermark = LocalDateTime.now().minusHours(3)))
        val routingConverter = spy(converter)
        doAnswer { invocation ->
            val osDocument = invocation.callRealMethod() as JsonSchemaDocumentOsDocument
            if (osDocument.id == newVersion.id().id.toString()) withVersionTag(osDocument, NEW_VERSION_TAG) else osDocument
        }.whenever(routingConverter).toOsDocument(any())

        capShardsAtCurrentCount()
        assertThat(runCatching { indexInitializer.ensureIndex("house", PROBE_VERSION_TAG) }.isFailure)
            .`as`("precondition: the cluster refuses new indices").isTrue()

        freshReconcileService(routingConverter).reconcile()
        resetShardLimit()
        refreshIndex()

        assertThat(findIndexedById(fine.id().id.toString()))
            .`as`("F10: an index-creation failure for one version must not stop other cases from being indexed")
            .isNotNull()
    }

    @Test
    fun `F10 an active version whose index cannot be created must not abort the whole reconcile cycle`() {
        val house = createHouseDocument("fine")
        backdate(house, hoursAgo = 1)
        clearIndex()
        val seededWatermark = LocalDateTime.now().minusHours(3)
        stateRepository.save(OpenSearchReconcileState(watermark = seededWatermark))

        // 'person' is a second active definition. Drop its index so ensureIndex must re-create it, then cap shards
        // so that creation is refused — while 'house' keeps its index and short-circuits.
        dropConcretesBehind(indexNameResolver.writeAliasFor("person", TEST_VERSION_TAG))
        capShardsAtCurrentCount()
        assertThat(runCatching { indexInitializer.ensureIndex("person", TEST_VERSION_TAG) }.isFailure)
            .`as`("precondition: the cluster refuses the active version's new index").isTrue()

        freshReconcileService().reconcile()
        resetShardLimit()
        refreshIndex()

        assertSoftly { soft ->
            soft.assertThat(findIndexedById(house.id().id.toString()))
                .`as`("one active version's index-creation failure must not stop other cases from being indexed")
                .isNotNull()
            soft.assertThat(stateRepository.findAll().single().watermark)
                .`as`("the reconcile watermark must still advance")
                .isAfter(seededWatermark)
        }
    }

    // ---------------------------------------------------------------- F11

    @Test
    fun `F11 a migrate run that is not published must say so`() {
        elasticsearchOperations.indexOps(IndexCoordinates.of(OpenSearchIndexNameResolver.LEGACY_INDEX)).create()
        createHouseDocument("rejected")
        createHouseDocument("fine")
        clearIndex()

        val run = reindexRunService.startOrResume(ReindexRequest(recreateIndex = true))
        newReindexService(oversizedContentConverter(), indexInitializer).reindex(run.id)

        val status = reindexRunService.toStatusMap(run.id)
        assertThat(status["status"]).`as`("precondition").isEqualTo(ReindexRunStatus.COMPLETED_WITH_ERRORS)
        assertThat(indexInitializer.isLegacyOrStale()).`as`("precondition: legacy index kept").isTrue()
        assertThat(status["error"])
            .`as`("F11: the run must tell the admin the migration was not published (status map: $status)")
            .isNotNull()
    }

    // ---------------------------------------------------------------- F12

    @Test
    fun `F12 a delete handled on another node during a scoped rebuild must not survive the swap`() {
        val doomed = createHouseDocument("doomed")
        val keeper = createHouseDocument("keeper")
        val doomedId = doomed.id().id
        clearIndex()
        indexOsDocument(converter.toOsDocument(doomed))
        indexOsDocument(converter.toOsDocument(keeper))
        refreshIndex()

        // "Node B": its own resolver, so it does not see the rebuild registered on this node ("node A").
        val nodeBResolver = OpenSearchIndexNameResolver()
        val nodeBSync = DocumentOpenSearchSyncService(
            elasticsearchOperations, documentRepository, converter, nodeBResolver, transactionManager,
        )
        val nodeBReconciler = freshReconcileService(converter, nodeBResolver)

        val fired = AtomicBoolean(false)
        val spyConverter = spy(converter)
        doAnswer { invocation ->
            val skipped = invocation.callRealMethod()
            if (invocation.getArgument<IndexCoordinates?>(1) != null && fired.compareAndSet(false, true)) {
                runWithoutAuthorization { documentService.deleteDocument(JsonSchemaDocumentId.existingId(doomedId)) }
                nodeBSync.delete(doomedId)
                pendingIndexDeletionRepository.save(PendingIndexDeletion(documentId = doomedId))
                nodeBReconciler.reconcile()
            }
            skipped
        }.whenever(spyConverter).indexChunk(any(), anyOrNull())

        val run = reindexRunService.startOrResume(ReindexRequest(documentDefinitionName = "house", recreateIndex = true))
        newReindexService(spyConverter, capturingInitializer()).reindex(run.id)
        assertThat(fired.get()).`as`("precondition: the delete window was exercised").isTrue()
        refreshIndex()
        assertThat(findIndexedById(keeper.id().id.toString())).`as`("precondition: keeper survives").isNotNull()

        reconcileService.reconcile()
        refreshIndex()

        assertThat(findIndexedById(doomedId.toString()))
            .`as`("F12: case deleted on another node during the rebuild is still in the swapped index")
            .isNull()
    }

    // ---------------------------------------------------------------- N1

    @Test
    fun `N1 an abandoned recreate must not clear the rejection row of a case missing from the live index`() {
        val previouslyRejected = createHouseDocument("a")
        createHouseDocument("rejected") // oversized under the spy converter -> the recreate skips it and is abandoned
        indexCompletenessService.recordRejected(mapOf(previouslyRejected.id().id to "house"))
        clearIndex()

        val run = reindexRunService.startOrResume(ReindexRequest(recreateIndex = true))
        newReindexService(oversizedContentConverter(), indexInitializer).reindex(run.id)

        assertSoftly { soft ->
            soft.assertThat(reindexRunService.toStatusMap(run.id)["status"])
                .`as`("precondition: the recreate was abandoned").isEqualTo(ReindexRunStatus.COMPLETED_WITH_ERRORS)
            soft.assertThat(indexCompletenessService.stillRejected(setOf(previouslyRejected.id().id)))
                .`as`("N1: an abandoned recreate cleared the rejection row of a case not in the live index")
                .containsExactly(previouslyRejected.id().id)
        }
    }

    @Test
    fun `N1 a clean full recreate clears every stale rejection row`() {
        val previouslyRejected = createHouseDocument("a")
        indexCompletenessService.recordRejected(mapOf(previouslyRejected.id().id to "house"))
        clearIndex()

        val run = reindexRunService.startOrResume(ReindexRequest(recreateIndex = true))
        newReindexService(converter, indexInitializer).reindex(run.id)

        assertSoftly { soft ->
            soft.assertThat(reindexRunService.toStatusMap(run.id)["status"])
                .`as`("precondition: the recreate completed").isEqualTo(ReindexRunStatus.COMPLETED)
            soft.assertThat(indexCompletenessService.stillRejected(setOf(previouslyRejected.id().id)))
                .`as`("N1: a clean full recreate must clear stale rejection rows").isEmpty()
        }
    }

    // ---------------------------------------------------------------- N3

    @Test
    fun `N3 reconcile recreates a missing active-version index so search leaves the PostgreSQL fallback`() {
        // No documents for this version — an empty version whose index was pruned and then activated. The reconcile
        // upsert scan therefore writes nothing for it, so only ensureAllIndices() can re-create its index.
        val (key, tag) = indexInitializer.activeDefinitionVersions().first { it.first == "house" }
        val writeAlias = indexNameResolver.writeAliasFor(key, tag)
        clearIndex()
        dropConcretesBehind(writeAlias)

        assertThat(indexExists(writeAlias)).`as`("precondition: the active version has no index").isFalse()
        assertThat(indexInitializer.isLegacyOrStale()).`as`("precondition: topology flags legacy or stale").isTrue()

        reconcileService.reconcile()

        assertSoftly { soft ->
            soft.assertThat(indexExists(writeAlias)).`as`("N3: reconcile re-created the missing active-version index").isTrue()
            soft.assertThat(indexInitializer.isLegacyOrStale()).`as`("N3: topology no longer advises a migration").isFalse()
        }
    }

    // ---------------------------------------------------------------- helpers

    private fun searchHouseIds() =
        delegatingSearchService.search("house", BlueprintType.CASE, AdvancedSearchRequest(), PageRequest.of(0, 50))
            .content.map { it.id() }

    private fun freshReconcileService(
        conv: JsonSchemaDocumentOsConverter = converter,
        resolver: OpenSearchIndexNameResolver = indexNameResolver,
    ) = DocumentOpenSearchReconcileService(
        entityManager, conv, elasticsearchOperations, resolver, stateRepository,
        pendingIndexDeletionRepository, transactionManager, lockProvider, openSearchProperties,
        indexInitializer, indexCompletenessService,
    )

    private fun newReindexService(
        conv: JsonSchemaDocumentOsConverter,
        initializer: DocumentOpenSearchIndexInitializer,
    ) = DocumentOpenSearchReindexService(
        entityManager, conv, elasticsearchOperations, transactionManager,
        lockProvider, reindexRunService, indexNameResolver, initializer, indexCompletenessService,
    )

    private fun capturingInitializer(): DocumentOpenSearchIndexInitializer {
        val spyInitializer = spy(indexInitializer)
        doAnswer { invocation ->
            (invocation.callRealMethod() as String).also { rebuildIndices += it }
        }.whenever(spyInitializer).prepareRebuildIndex(any(), any())
        return spyInitializer
    }

    // Same approach as DefectReproIntTest.oversizedContentConverter: the harness converter emits content=null, so
    // the spy fills in the real content and turns street="rejected" into more fields than total_fields.limit.
    private fun oversizedContentConverter(): JsonSchemaDocumentOsConverter {
        val overLimit = (0..openSearchProperties.totalFieldsLimit.toInt() + 100).associate { "field$it" to "v" }
        val spyConverter = spy(converter)
        doAnswer { invocation ->
            val osDocument = invocation.callRealMethod() as JsonSchemaDocumentOsDocument
            val document = invocation.getArgument<JsonSchemaDocument>(0)
            @Suppress("UNCHECKED_CAST")
            val content = objectMapper.convertValue(document.content().asJson(), Map::class.java) as Map<String, Any?>
            osDocument.copy(content = if (content["street"] == "rejected") overLimit else content)
        }.whenever(spyConverter).toOsDocument(any())
        return spyConverter
    }

    private fun houseOsDocument(
        versionTag: String = TEST_VERSION_TAG,
        content: Map<String, Any?> = mapOf("street" to "x"),
    ): JsonSchemaDocumentOsDocument {
        val base = converter.toOsDocument(createHouseDocument("template"))
        return withVersionTag(base, versionTag).copy(id = UUID.randomUUID().toString(), content = content)
    }

    // TopologyGate caches its verdict for CACHE_TTL_MS; wait it out so a value cached by an earlier test (e.g. a
    // legacy index) cannot route the search to PostgreSQL and hide the finding.
    private fun expireTopologyCache() = Thread.sleep(TopologyGate.CACHE_TTL_MS + 200)

    private fun withVersionTag(osDocument: JsonSchemaDocumentOsDocument, versionTag: String): JsonSchemaDocumentOsDocument {
        val definitionId = requireNotNull(osDocument.definitionId)
        val blueprintId = requireNotNull(definitionId.blueprintId)
        return osDocument.copy(
            definitionId = definitionId.copy(blueprintId = blueprintId.copy(blueprintVersionTag = versionTag))
        )
    }

    private fun capShardsAtCurrentCount() {
        val activeShards = restHighLevelClient.cluster().health(ClusterHealthRequest(), RequestOptions.DEFAULT).activeShards
        restHighLevelClient.cluster().putSettings(
            ClusterUpdateSettingsRequest().transientSettings(
                Settings.builder().put("cluster.max_shards_per_node", activeShards).build()
            ),
            RequestOptions.DEFAULT,
        )
    }

    private fun resetShardLimit() {
        restHighLevelClient.cluster().putSettings(
            ClusterUpdateSettingsRequest().transientSettings(Settings.builder().putNull("cluster.max_shards_per_node").build()),
            RequestOptions.DEFAULT,
        )
    }

    private fun dropConcretesBehind(alias: String) {
        if (indexExists(alias)) {
            elasticsearchOperations.indexOps(IndexCoordinates.of(alias)).getAliasesForIndex(alias).keys
                .forEach { indexInitializer.dropIndex(it) }
        }
    }

    private fun countIn(indexName: String): Long =
        elasticsearchOperations.count(
            NativeSearchQueryBuilder().withQuery(QueryBuilders.matchAllQuery()).build(),
            JsonSchemaDocumentOsDocument::class.java,
            IndexCoordinates.of(indexName),
        )

    private fun indexExists(name: String): Boolean = elasticsearchOperations.indexOps(IndexCoordinates.of(name)).exists()

    private fun clearIndex() {
        openSearchRepository.deleteAll()
        refreshIndex()
    }

    private fun backdate(document: JsonSchemaDocument, hoursAgo: Long) {
        TransactionTemplate(transactionManager).execute {
            entityManager.createNativeQuery("UPDATE json_schema_document SET changed_on = :t WHERE json_schema_document_id = :id")
                .setParameter("t", LocalDateTime.now().minusHours(hoursAgo))
                .setParameter("id", document.id().id)
                .executeUpdate()
        }
    }

    private fun createHouseDocument(street: String): JsonSchemaDocument =
        runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest("house", "house", "1.0.0", objectMapper.createObjectNode().put("street", street))
            ).resultingDocument().get()
        }

    companion object {
        private const val OLD_VERSION_TAG = "0.9.0"
        private const val NEW_VERSION_TAG = "9.9.9"
        private const val PROBE_VERSION_TAG = "8.8.8"
        private val EXTRA_VERSION_TAGS = listOf(OLD_VERSION_TAG, NEW_VERSION_TAG, PROBE_VERSION_TAG)
        private val LONG_VALUE = "x".repeat(33_000)
    }
}
