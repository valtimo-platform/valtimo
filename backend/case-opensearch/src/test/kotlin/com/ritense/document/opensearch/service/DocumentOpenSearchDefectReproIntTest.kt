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
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.valtimo.contract.blueprint.BlueprintType
import jakarta.persistence.EntityManager
import net.javacrumbs.shedlock.core.LockProvider
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.assertj.core.api.SoftAssertions.assertSoftly
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.spy
import org.mockito.kotlin.whenever
import org.opensearch.data.client.orhlc.NativeSearchQueryBuilder
import org.opensearch.index.query.QueryBuilders
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.actuate.health.Status
import org.springframework.data.domain.PageRequest
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import java.time.LocalDateTime
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/**
 * Defect-reproduction tests for the blocker/major findings of the per-definition OpenSearch review.
 *
 * Every test asserts the CORRECT behaviour: a red test confirms the defect, a green test means it is not
 * reproduced. Controls rule out harness artifacts. The base class mocks the event multicaster, so live-sync
 * deletes and pending-deletion rows are simulated explicitly (as in the reconcile integration test).
 *
 * Mapping-conflict scenarios for the reconciler/live path (M7) cannot use schema-violating content because the
 * `house` schema forbids additional properties; they instead poison the `content.street` mapping of the
 * `house` index with an object value (as if the field had changed type over time) and then index a legitimate
 * document whose `street` is a string.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class DocumentOpenSearchDefectReproIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    lateinit var reindexService: DocumentOpenSearchReindexService

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

    private val rebuildIndices = mutableListOf<String>()

    @AfterEach
    fun cleanUp() {
        runWithoutAuthorization { documentService.removeDocuments("house") }
        stateRepository.deleteAll()
        pendingIndexDeletionRepository.deleteAll()
        TEST_DEFINITION_KEYS.forEach { key ->
            val alias = indexNameResolver.indexNameFor(key)
            if (elasticsearchOperations.indexOps(IndexCoordinates.of(alias)).exists()) {
                elasticsearchOperations.indexOps(IndexCoordinates.of(alias)).getAliasesForIndex(alias).keys
                    .forEach { indexInitializer.dropIndex(it) }
            }
        }
        rebuildIndices.forEach { indexInitializer.dropIndex(it) }
        rebuildIndices.clear()
        indexInitializer.dropIndex(OpenSearchIndexNameResolver.LEGACY_INDEX)
        TEST_DEFINITION_KEYS.forEach { indexInitializer.ensureIndex(it) }
    }

    // ---------------------------------------------------------------- B1

    @Test
    fun `B1 upgrade - cases are listed from OpenSearch while only the legacy index holds the data`() {
        val document = createHouseDocument("legacy-street")
        clearIndex()
        elasticsearchOperations.indexOps(IndexCoordinates.of(OpenSearchIndexNameResolver.LEGACY_INDEX)).create()
        elasticsearchOperations.save(
            converter.toOsDocument(document),
            IndexCoordinates.of(OpenSearchIndexNameResolver.LEGACY_INDEX),
        )
        elasticsearchOperations.indexOps(IndexCoordinates.of(OpenSearchIndexNameResolver.LEGACY_INDEX)).refresh()
        refreshIndex()

        assertThat(indexInitializer.isLegacyOrStale()).`as`("precondition: legacy topology detected").isTrue()

        searchEngineToggle.set(SearchEngineToggle.Engine.POSTGRES)
        val controlIds = delegatingSearchService
            .search("house", BlueprintType.CASE, AdvancedSearchRequest(), PageRequest.of(0, 10)).content.map { it.id() }
        assertThat(controlIds).`as`("CONTROL: the POSTGRES engine lists the document").contains(document.id())

        searchEngineToggle.set(SearchEngineToggle.Engine.OPENSEARCH)
        val ids = delegatingSearchService
            .search("house", BlueprintType.CASE, AdvancedSearchRequest(), PageRequest.of(0, 10)).content.map { it.id() }
        assertThat(ids)
            .`as`("B1: with the OPENSEARCH engine on a legacy topology the case list must still contain the document (found $ids)")
            .contains(document.id())
    }

    // ---------------------------------------------------------------- B2

    @Test
    fun `B2 control - a scoped recreate run without failure keeps all four documents`() {
        val docs = fourIndexedHouseDocuments()

        val run = reindexRunService.startOrResume(ReindexRequest(documentDefinitionName = "house", recreateIndex = true, pageSize = 2))
        reindexService.reindex(run.id)

        refreshIndex()
        assertThat(missingFromAlias(docs)).`as`("CONTROL: documents missing after an uninterrupted rebuild").isEmpty()
    }

    @Test
    fun `B2 resume of a failed scoped recreate run loses the documents before the cursor`() {
        val docs = fourIndexedHouseDocuments()
        val failingConverter = spy(converter)
        val overrideCalls = AtomicInteger()
        doAnswer { invocation ->
            if (invocation.getArgument<IndexCoordinates?>(1) != null && overrideCalls.incrementAndGet() == 2) {
                throw RuntimeException("transport boom")
            }
            invocation.callRealMethod()
        }.whenever(failingConverter).indexChunk(any(), anyOrNull())

        val run = reindexRunService.startOrResume(ReindexRequest(documentDefinitionName = "house", recreateIndex = true, pageSize = 2))
        assertThatThrownBy { newService(failingConverter, capturingInitializer()).reindex(run.id) }
            .`as`("precondition: the first run fails on its 2nd chunk")
            .isInstanceOf(RuntimeException::class.java)
        assertThat(reindexRunService.toStatusMap(run.id)["status"]).isEqualTo(ReindexRunStatus.FAILED)
        assertThat(reindexRunService.cursorOf(run.id)).`as`("precondition: cursor after the first chunk").isNotNull()

        reindexRunService.startOrResume(ReindexRequest(resumeRunId = run.id))
        reindexService.reindex(run.id)

        refreshIndex()
        val missing = missingFromAlias(docs)
        assertThat(missing)
            .`as`("B2: after resuming a failed recreate run, all 4 documents must be in the house index; missing $missing")
            .isEmpty()
    }

    // ---------------------------------------------------------------- M3 / M8a

    @Test
    fun `M3a a live delete during a scoped rebuild must not leave the document in the swapped index`() {
        val (doomedId, keeperId) = rebuildWithLiveDelete(reconcileInWindow = false)

        refreshIndex()
        assertThat(findIndexedById(keeperId.toString())).`as`("precondition: keeper survives the rebuild").isNotNull()
        assertThat(findIndexedById(doomedId.toString()))
            .`as`("M3/M8a: document deleted during the rebuild is resurrected in the swapped index")
            .isNull()
    }

    @Test
    fun `M3b a pending deletion drained before the swap must not leave the document in the swapped index`() {
        val (doomedId, keeperId) = rebuildWithLiveDelete(reconcileInWindow = true)

        refreshIndex()
        assertThat(findIndexedById(keeperId.toString())).`as`("precondition: keeper survives the rebuild").isNotNull()
        val absentAfterRebuild = findIndexedById(doomedId.toString()) == null
        reconcileService.reconcile()
        refreshIndex()
        val absentAfterReconcile = findIndexedById(doomedId.toString()) == null
        assertSoftly { soft ->
            soft.assertThat(absentAfterRebuild)
                .`as`("M3b: doomed absent right after rebuild (reconcile drained before swap)").isTrue()
            soft.assertThat(absentAfterReconcile)
                .`as`("M3b: doomed absent after one more reconcile (permanent vs self-healing)").isTrue()
        }
    }

    @Test
    fun `M3c a pending deletion drained after the swap removes the resurrected document`() {
        val (doomedId, _) = rebuildWithLiveDelete(reconcileInWindow = false)
        refreshIndex()

        reconcileService.reconcile()

        refreshIndex()
        assertThat(findIndexedById(doomedId.toString()))
            .`as`("M3c: the reconciler must remove the resurrected document once it drains the pending deletion")
            .isNull()
    }

    private fun rebuildWithLiveDelete(reconcileInWindow: Boolean): Pair<UUID, UUID> {
        val doomed = createHouseDocument("doomed")
        val keeper = createHouseDocument("keeper")
        val doomedId = doomed.id().id
        clearIndex()
        indexOsDocument(converter.toOsDocument(doomed))
        indexOsDocument(converter.toOsDocument(keeper))
        refreshIndex()

        val fired = AtomicBoolean(false)
        val spyConverter = spy(converter)
        doAnswer { invocation ->
            val skipped = invocation.callRealMethod()
            if (invocation.getArgument<IndexCoordinates?>(1) != null && fired.compareAndSet(false, true)) {
                runWithoutAuthorization { documentService.deleteDocument(doomed.id()) }
                syncService.delete(doomedId)
                pendingIndexDeletionRepository.save(PendingIndexDeletion(documentId = doomedId))
                if (reconcileInWindow) reconcileService.reconcile()
            }
            skipped
        }.whenever(spyConverter).indexChunk(any(), anyOrNull())

        val run = reindexRunService.startOrResume(ReindexRequest(documentDefinitionName = "house", recreateIndex = true))
        newService(spyConverter, capturingInitializer()).reindex(run.id)
        assertThat(fired.get()).`as`("precondition: the delete window was exercised").isTrue()
        return doomedId to keeper.id().id
    }

    // ---------------------------------------------------------------- M4

    @Test
    fun `M4a control - a successful scoped rebuild leaves exactly the new index behind the alias`() {
        createHouseDocument("control")
        val before = concreteBehindHouseAlias()
        val initializer = capturingInitializer()

        val run = reindexRunService.startOrResume(ReindexRequest(documentDefinitionName = "house", recreateIndex = true))
        newService(converter, initializer).reindex(run.id)

        assertThat(rebuildIndices).hasSize(1)
        assertThat(concreteBehindHouseAlias()).`as`("CONTROL").isEqualTo(rebuildIndices.single())
        assertThat(indexExists(before)).`as`("CONTROL: old index dropped").isFalse()
    }

    @Test
    fun `M4a a failed scoped rebuild must not leak the unpublished index`() {
        createHouseDocument("fails")
        val before = concreteBehindHouseAlias()
        val failingConverter = spy(converter)
        doAnswer { invocation ->
            if (invocation.getArgument<IndexCoordinates?>(1) != null) throw RuntimeException("transport boom")
            invocation.callRealMethod()
        }.whenever(failingConverter).indexChunk(any(), anyOrNull())

        val run = reindexRunService.startOrResume(ReindexRequest(documentDefinitionName = "house", recreateIndex = true))
        assertThatThrownBy { newService(failingConverter, capturingInitializer()).reindex(run.id) }
            .isInstanceOf(RuntimeException::class.java)

        assertThat(concreteBehindHouseAlias()).`as`("precondition: alias still on the old index").isEqualTo(before)
        assertThat(rebuildIndices).hasSize(1)
        assertThat(indexExists(rebuildIndices.single()))
            .`as`("M4a: unpublished rebuild index '${rebuildIndices.single()}' leaked after a failed rebuild")
            .isFalse()
    }

    @Test
    fun `M4b a stopped scoped rebuild must not leak the unpublished index`() {
        createHouseDocument("one")
        createHouseDocument("two")
        val holder = AtomicReference<DocumentOpenSearchReindexService>()
        val stoppingConverter = spy(converter)
        val fired = AtomicBoolean(false)
        doAnswer { invocation ->
            val skipped = invocation.callRealMethod()
            if (invocation.getArgument<IndexCoordinates?>(1) != null && fired.compareAndSet(false, true)) {
                holder.get()?.destroy()
            }
            skipped
        }.whenever(stoppingConverter).indexChunk(any(), anyOrNull())
        val service = newService(stoppingConverter, capturingInitializer())
        holder.set(service)

        val run = reindexRunService.startOrResume(ReindexRequest(documentDefinitionName = "house", recreateIndex = true, pageSize = 1))
        service.reindex(run.id)

        assertThat(reindexRunService.toStatusMap(run.id)["status"]).`as`("precondition").isEqualTo(ReindexRunStatus.STOPPED)
        assertThat(rebuildIndices).hasSize(1)
        assertThat(indexExists(rebuildIndices.single()))
            .`as`("M4b: unpublished rebuild index '${rebuildIndices.single()}' leaked after a STOPPED rebuild")
            .isFalse()
    }

    // ---------------------------------------------------------------- M5

    @Test
    fun `M5 S1_2 control - an object and a scalar at the same path in different definitions both index`() {
        val base = converter.toOsDocument(createHouseDocument("base"))
        val house = base.copy(id = UUID.randomUUID().toString(), content = mapOf("openzaakgegevens" to mapOf("a" to 1)))
        val person = base.copy(
            id = UUID.randomUUID().toString(),
            definitionId = base.definitionId?.copy(name = "person"),
            content = mapOf("openzaakgegevens" to "plain"),
        )

        val skipped = converter.indexChunk(listOf(house)) + converter.indexChunk(listOf(person))

        refreshIndex()
        assertThat(skipped).`as`("CONTROL: cross-definition type shift").isZero()
        assertThat(findIndexedById(house.id)).isNotNull()
        assertThat(findIndexedById(person.id)).isNotNull()
    }

    @Test
    fun `M5 S1_2 an object and a scalar at the same path in one definition both index`() {
        val base = converter.toOsDocument(createHouseDocument("base"))
        val asObject = base.copy(id = UUID.randomUUID().toString(), content = mapOf("openzaakgegevens" to mapOf("a" to 1)))
        val asScalar = base.copy(id = UUID.randomUUID().toString(), content = mapOf("openzaakgegevens" to "plain"))

        val skipped = converter.indexChunk(listOf(asObject)) + converter.indexChunk(listOf(asScalar))

        refreshIndex()
        val missing = listOf(asObject, asScalar).filter { findIndexedById(it.id) == null }.map { it.content }
        assertThat(skipped).`as`("M5/S1.2: object-vs-scalar at one path in one definition skipped $skipped document(s)").isZero()
        assertThat(missing).`as`("M5/S1.2: documents not findable: $missing").isEmpty()
    }

    @Test
    fun `M5 S2_2 a document with more than 1000 distinct fields in one definition indexes`() {
        val base = converter.toOsDocument(createHouseDocument("base"))
        val small = base.copy(id = UUID.randomUUID().toString(), content = (1..200).associate { "small$it" to "v" })
        val big = base.copy(id = UUID.randomUUID().toString(), content = (1..1500).associate { "field$it" to "v" })

        val controlSkipped = converter.indexChunk(listOf(small))
        assertThat(controlSkipped).`as`("CONTROL: 200-field document").isZero()

        val skipped = converter.indexChunk(listOf(big))

        refreshIndex()
        assertThat(skipped).`as`("M5/S2.2: 1500-field document skipped count").isZero()
        assertThat(findIndexedById(big.id)).`as`("M5/S2.2: 1500-field document findable").isNotNull()
    }

    @Test
    fun `M5 S1_3 arbitrary nested blobs are not dynamically mapped`() {
        val base = converter.toOsDocument(createHouseDocument("base"))
        val doc = base.copy(
            id = UUID.randomUUID().toString(),
            content = mapOf("openzaakgegevens" to mapOf("a" to 1, "nested" to mapOf("b" to "x"))),
        )
        converter.indexChunk(listOf(doc))
        refreshIndex()

        val mapping = elasticsearchOperations.indexOps(IndexCoordinates.of(concreteBehindHouseAlias())).mapping
        val blob = (mapping["properties"] as? Map<*, *>)
            ?.let { it["content"] as? Map<*, *> }
            ?.let { it["properties"] as? Map<*, *> }
            ?.let { it["openzaakgegevens"] as? Map<*, *> }

        assertThat(blob?.containsKey("properties") ?: false)
            .`as`("M5/S1.3: content.openzaakgegevens is dynamically mapped: $blob")
            .isFalse()
    }

    // ---------------------------------------------------------------- M6

    @Test
    fun `M6a a failing catch-up must not complete the run as COMPLETED`() {
        createHouseDocument("fresh")
        val failingConverter = spy(converter)
        doAnswer { invocation ->
            if (invocation.getArgument<IndexCoordinates?>(1) == null) throw RuntimeException("catch-up boom")
            invocation.callRealMethod()
        }.whenever(failingConverter).indexChunk(any(), anyOrNull())

        val run = reindexRunService.startOrResume(ReindexRequest(documentDefinitionName = "house", recreateIndex = true))
        newService(failingConverter, capturingInitializer()).reindex(run.id)

        assertThat(reindexRunService.toStatusMap(run.id)["status"])
            .`as`("M6a: catch-up threw but the run status is reported as success")
            .isNotEqualTo(ReindexRunStatus.COMPLETED)
    }

    @Test
    fun `M6b catch-up skipped documents must be counted and flag the run`() {
        createHouseDocument("fresh")
        val skippingConverter = spy(converter)
        doAnswer { invocation ->
            if (invocation.getArgument<IndexCoordinates?>(1) == null) 1L else invocation.callRealMethod()
        }.whenever(skippingConverter).indexChunk(any(), anyOrNull())

        val run = reindexRunService.startOrResume(ReindexRequest(documentDefinitionName = "house", recreateIndex = true))
        newService(skippingConverter, capturingInitializer()).reindex(run.id)

        val status = reindexRunService.toStatusMap(run.id)
        assertSoftly { soft ->
            soft.assertThat(status["skippedCount"] as Long)
                .`as`("M6b: catch-up skipped a document but skippedCount is ${status["skippedCount"]}").isGreaterThan(0L)
            soft.assertThat(status["status"])
                .`as`("M6b: status after catch-up skip is ${status["status"]}").isEqualTo(ReindexRunStatus.COMPLETED_WITH_ERRORS)
        }
    }

    // ---------------------------------------------------------------- M7

    @Test
    fun `M7a a document rejected by the reconciler must stay retryable or be signalled`() {
        val contentConverter = contentPopulatingConverter()
        poisonHouseStreetMapping(contentConverter)
        val rejected = createHouseDocument("plain")
        val fine = createHouseDocument(null, housenumber = 5)
        clearIndexKeepMapping()
        assertThat(contentConverter.indexChunk(listOf(contentConverter.toOsDocument(rejected))))
            .`as`("precondition: the poisoned mapping rejects the document").isEqualTo(1L)
        val rejectedChangedOn = readChangedOn(rejected.id().id)
        stateRepository.save(OpenSearchReconcileState(watermark = LocalDateTime.now().minusHours(1)))

        DocumentOpenSearchReconcileService(
            entityManager, contentConverter, elasticsearchOperations, indexNameResolver, stateRepository,
            pendingIndexDeletionRepository, transactionManager, lockProvider, openSearchProperties,
        ).reconcile()

        refreshIndex()
        assertThat(findIndexedById(fine.id().id.toString())).`as`("CONTROL: non-conflicting document indexed").isNotNull()
        val indexed = findIndexedById(rejected.id().id.toString()) != null
        val watermark = stateRepository.findById(OpenSearchReconcileState.SINGLETON_ID).get().watermark
        val retryable = watermark.isBefore(rejectedChangedOn)
        val signalled = OpenSearchMappingHealthIndicator(indexInitializer).health().status != Status.UP
        assertThat(indexed || retryable || signalled)
            .`as`(
                "M7a: rejected document is dropped silently (indexed=$indexed, watermark=$watermark vs " +
                    "changedOn=$rejectedChangedOn retryable=$retryable, healthSignal=$signalled)"
            )
            .isTrue()
    }

    @Test
    fun `M7b a live sync rejection is surfaced and signalled to the operator`() {
        val contentConverter = contentPopulatingConverter()
        poisonHouseStreetMapping(contentConverter)
        val rejected = createHouseDocument("plain")
        clearIndexKeepMapping()

        val liveSync = DocumentOpenSearchSyncService(
            elasticsearchOperations, documentRepository, contentConverter, indexNameResolver, indexInitializer, transactionManager,
        )
        val thrown = runCatching { liveSync.upsertById(rejected.id().id) }.exceptionOrNull()

        assertThat(thrown).`as`("M7b: live upsert of a mapping-conflicting document must surface an exception").isNotNull()
        assertThat(OpenSearchMappingHealthIndicator(indexInitializer).health().status)
            .`as`("M7b: no operator-visible health signal after a rejected live write")
            .isNotEqualTo(Status.UP)
    }

    // The converter bean in this harness emits content=null (Jackson does not serialize JsonSchemaDocument.content()),
    // so a mapping conflict can never arise from real PostgreSQL documents. This spy adds the document content the
    // way the read model is meant to carry it, so the reconciler/live-sync paths can be exercised against conflicts.
    private fun contentPopulatingConverter(): JsonSchemaDocumentOsConverter {
        val spyConverter = spy(converter)
        doAnswer { invocation ->
            val osDocument = invocation.callRealMethod() as JsonSchemaDocumentOsDocument
            val document = invocation.getArgument<JsonSchemaDocument>(0)
            @Suppress("UNCHECKED_CAST")
            osDocument.copy(content = objectMapper.convertValue(document.content().asJson(), Map::class.java) as Map<String, Any?>)
        }.whenever(spyConverter).toOsDocument(any())
        return spyConverter
    }

    private fun poisonHouseStreetMapping(contentConverter: JsonSchemaDocumentOsConverter) {
        val base = contentConverter.toOsDocument(createHouseDocument("poison-base"))
        val ghost = base.copy(id = UUID.randomUUID().toString(), content = mapOf("street" to mapOf("a" to 1)))
        assertThat(contentConverter.indexChunk(listOf(ghost))).`as`("precondition: poison indexed").isZero()
        refreshIndex()
    }

    // ---------------------------------------------------------------- helpers

    private fun clearIndexKeepMapping() {
        openSearchRepository.deleteAll()
        refreshIndex()
    }

    private fun newService(
        conv: JsonSchemaDocumentOsConverter,
        initializer: DocumentOpenSearchIndexInitializer,
    ) = DocumentOpenSearchReindexService(
        entityManager, conv, elasticsearchOperations, transactionManager,
        lockProvider, reindexRunService, indexNameResolver, initializer,
    )

    private fun capturingInitializer(): DocumentOpenSearchIndexInitializer {
        val spyInitializer = spy(indexInitializer)
        doAnswer { invocation ->
            (invocation.callRealMethod() as String).also { rebuildIndices += it }
        }.whenever(spyInitializer).prepareRebuildIndex(any())
        return spyInitializer
    }

    private fun fourIndexedHouseDocuments(): List<JsonSchemaDocument> {
        val docs = (1..4).map { createHouseDocument("street-$it") }
        clearIndex()
        docs.forEach { indexOsDocument(converter.toOsDocument(it)) }
        refreshIndex()
        assertThat(countInIndex(OpenSearchIndexNameResolver.READ_ALIAS)).`as`("precondition").isEqualTo(4L)
        backdateHouseDocuments()
        return docs
    }

    // Documents created seconds ago would all fall inside the post-swap catch-up window and be re-indexed from
    // PostgreSQL, masking what the rebuild itself preserved. Real, long-lived documents are older than that.
    private fun backdateHouseDocuments() {
        TransactionTemplate(transactionManager).execute {
            entityManager.createNativeQuery(
                "UPDATE json_schema_document SET changed_on = :t WHERE document_definition_name = 'house'"
            ).setParameter("t", LocalDateTime.now().minusHours(1)).executeUpdate()
        }
    }

    private fun missingFromAlias(docs: List<JsonSchemaDocument>): List<UUID> =
        docs.map { it.id().id }.filter { findIndexedById(it.toString()) == null }

    private fun concreteBehindHouseAlias(): String {
        val alias = indexNameResolver.indexNameFor("house")
        return elasticsearchOperations.indexOps(IndexCoordinates.of(alias)).getAliasesForIndex(alias).keys.single()
    }

    private fun indexExists(name: String): Boolean = elasticsearchOperations.indexOps(IndexCoordinates.of(name)).exists()

    private fun countInIndex(indexName: String): Long {
        val query = NativeSearchQueryBuilder().withQuery(QueryBuilders.matchAllQuery()).build()
        return elasticsearchOperations.count(query, JsonSchemaDocumentOsDocument::class.java, IndexCoordinates.of(indexName))
    }

    private fun clearIndex() {
        openSearchRepository.deleteAll()
        refreshIndex()
    }

    private fun readChangedOn(id: UUID): LocalDateTime =
        requireNotNull(
            TransactionTemplate(transactionManager).execute {
                documentRepository.findById(JsonSchemaDocumentId.existingId(id)).get().changedOn()
            }
        )

    private fun createHouseDocument(street: String?, housenumber: Int? = null): JsonSchemaDocument =
        runWithoutAuthorization {
            val content = objectMapper.createObjectNode()
            street?.let { content.put("street", it) }
            housenumber?.let { content.put("housenumber", it) }
            documentService.createDocument(NewDocumentRequest("house", "house", "1.0.0", content))
                .resultingDocument().get()
        }
}
