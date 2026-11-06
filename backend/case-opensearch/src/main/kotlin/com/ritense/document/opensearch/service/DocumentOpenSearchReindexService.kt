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

import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.persistence.EntityManager
import jakarta.persistence.criteria.JoinType
import jakarta.persistence.criteria.Predicate
import net.javacrumbs.shedlock.core.LockConfiguration
import net.javacrumbs.shedlock.core.LockProvider
import org.springframework.beans.factory.DisposableBean
import org.opensearch.index.query.BoolQueryBuilder
import org.opensearch.index.query.QueryBuilders
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import org.opensearch.data.client.orhlc.NativeSearchQueryBuilder
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Re-runnable, scoped re-index of [JsonSchemaDocument] rows into the live `json_schema_document`
 * OpenSearch index.
 *
 * - **Cluster-safe single runner**: a ShedLock named lock ([LOCK_NAME]) guarantees at most one run
 *   cluster-wide; a concurrent [start] returns `null` (→ HTTP 409).
 * - **Persisted, resumable state**: progress (cursor, counts, heartbeat) lives in the database via
 *   [OpenSearchReindexRunService]; a FAILED/STOPPED run can be resumed from its cursor with an
 *   idempotent upsert.
 * - **Scoped**: only documents matching the [ReindexRequest] filters are (re)indexed; the index stays
 *   complete and queryable throughout.
 * - **Crash-safe refresh**: no global `refresh_interval` toggle — a single explicit refresh runs at
 *   successful completion.
 */
open class DocumentOpenSearchReindexService(
    private val entityManager: EntityManager,
    private val converter: JsonSchemaDocumentOsConverter,
    private val elasticsearchOperations: ElasticsearchOperations,
    private val transactionManager: PlatformTransactionManager,
    private val lockProvider: LockProvider,
    private val runService: OpenSearchReindexRunService,
    private val resolver: OpenSearchIndexNameResolver,
    private val indexInitializer: DocumentOpenSearchIndexInitializer,
) : DisposableBean {

    private val executor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "opensearch-reindex").apply { isDaemon = true }
    }

    @Volatile
    private var cancelRequested = false

    /**
     * Acquires the cluster-wide lock, creates (or resumes) a run record and dispatches the re-index on
     * the managed executor. Returns the run id, or `null` if a re-index is already running anywhere in
     * the cluster.
     */
    fun start(request: ReindexRequest): UUID? {
        require(!(request.recreateIndex && request.hasSubsetFilters())) {
            "recreateIndex cannot be combined with modifiedAfter, modifiedBefore or documentIds — " +
                "a filtered rebuild would replace the index with only the matching subset"
        }

        val lock = lockProvider.lock(
            LockConfiguration(Instant.now(), LOCK_NAME, LOCK_AT_MOST_FOR, Duration.ZERO)
        )
        if (lock.isEmpty) return null

        cancelRequested = false
        val run = try {
            runService.startOrResume(request)
        } catch (e: Exception) {
            lock.get().unlock()
            throw e
        }

        executor.execute {
            try {
                reindex(run.id)
            } catch (e: Exception) {
                logger.error(e) { "Re-index run ${run.id} terminated with error" }
            } finally {
                lock.get().unlock()
            }
        }
        return run.id
    }

    /**
     * Runs the chunked, resumable re-index loop for [runId].
     * Each DB page is read in its own short read-only transaction (keeping snapshots short) and the
     * persistence context is cleared after every page. Returns the number of documents processed.
     */
    open fun reindex(runId: UUID): Long {
        val scope = runService.scopeOf(runId)
        var lastId: UUID? = runService.cursorOf(runId)
        var processed: Long = runService.processedOf(runId)
        var skipped = runService.skippedOf(runId)
        val pageSize = runService.pageSizeOf(runId)
        val txTemplate = TransactionTemplate(transactionManager).apply { isReadOnly = true }

        // Lower bound for the post-swap catch-up: any document whose changedOn moved at/after this may have
        // taken a live write into the old index that the swap drops. The overlap absorbs node clock skew.
        val catchUpFrom = LocalDateTime.now().minus(CATCH_UP_OVERLAP)

        try {
            // Inside the try so a preparation failure (index create, definition query) marks the run FAILED
            // instead of leaving it stuck RUNNING until stale-run reconciliation.
            val rebuild = prepareRebuild(scope)

            while (!cancelRequested) {
                val cursor = lastId
                val batch = txTemplate.execute {
                    fetchBatch(scope, cursor, pageSize).also { entityManager.clear() }
                } ?: break
                if (batch.isEmpty()) break

                val docs = batch.mapNotNull { jpaDoc ->
                    try {
                        converter.toOsDocument(jpaDoc)
                    } catch (e: Exception) {
                        skipped++
                        logger.warn(e) { "Failed to convert document — skipping" }
                        null
                    }
                }
                skipped += docs.chunked(JsonSchemaDocumentOsConverter.BULK_CHUNK_SIZE)
                    .sumOf { converter.indexChunk(it, rebuild?.targetIndex) }

                processed += docs.size
                lastId = batch.last().id().id
                runService.recordProgress(runId, lastId, processed, skipped)
            }

            if (cancelRequested) {
                logger.info { "Re-index run $runId cancelled — marking STOPPED (processed=$processed, skipped=$skipped)" }
                runService.stop(runId)
            } else {
                // Pruning is meaningless for a rebuild/migrate — the target index is freshly built from the
                // source of truth and holds no orphans.
                if (scope.pruneOrphans && rebuild == null) {
                    val pruned = pruneOrphans(runId, scope)
                    logger.info { "Pruned $pruned orphan document(s) from OpenSearch" }
                }
                val refreshTarget = rebuild?.targetIndex ?: indexCoordinatesFor(scope)
                elasticsearchOperations.indexOps(refreshTarget).takeIf { it.exists() }?.refresh()
                rebuild?.let { publishOrAbandonRebuild(it, skipped) }
                // A published scoped rebuild (newConcrete != null, nothing skipped) just dropped the old index;
                // re-index anything changed during the rebuild so a concurrent write to that old index is not lost.
                if (skipped == 0L && rebuild?.newConcrete != null) {
                    catchUpConcurrentWrites(rebuild.definitionName!!, catchUpFrom, pageSize)
                }
                logger.info { "Re-index run $runId complete (processed=$processed, skipped=$skipped)" }
                runService.complete(runId, processed + skipped, skipped)
            }
        } catch (e: Exception) {
            runService.fail(runId, e.message)
            logger.error(e) { "Re-index failed (run $runId)" }
            throw e
        }
        return processed
    }

    /**
     * Topology plan for a `recreateIndex` run, resolved once up front:
     * - **scoped** (a definition name) — build a fresh concrete index and fill it ([targetIndex]); on success
     *   atomically swap the per-definition and read aliases onto it and drop the old one.
     * - **unscoped** (migration off the legacy single index) — provision the per-definition indices now so the
     *   routed writes land in them, then drop the legacy index on success.
     *
     * A non-recreate run returns `null` and behaves exactly as before.
     */
    private fun prepareRebuild(scope: ReindexRequest): RebuildPlan? {
        if (!scope.recreateIndex) return null
        val definitionName = scope.documentDefinitionName
        if (definitionName != null) {
            val newIndex = indexInitializer.prepareRebuildIndex(definitionName)
            return RebuildPlan(definitionName = definitionName, targetIndex = IndexCoordinates.of(newIndex), newConcrete = newIndex)
        }
        indexInitializer.ensureAllIndices()
        return RebuildPlan(definitionName = null, targetIndex = null, newConcrete = null)
    }

    /**
     * Publishes a completed rebuild, or abandons it when documents were skipped. A skipped document is absent
     * from the freshly built index, so swapping it in (scoped) or dropping the legacy index (migrate) would make
     * that document unsearchable. On skips the existing index keeps serving every document and the operator can
     * resolve the skips and re-run; for a scoped rebuild the unpublished partial index is dropped to avoid a leak.
     */
    private fun publishOrAbandonRebuild(plan: RebuildPlan, skipped: Long) {
        if (skipped == 0L) {
            completeRebuild(plan)
            return
        }
        if (plan.newConcrete != null) {
            logger.warn {
                "Rebuild for definition '${plan.definitionName}' skipped $skipped document(s) — keeping the existing " +
                    "index and dropping the unpublished partial index '${plan.newConcrete}'"
            }
            indexInitializer.dropIndex(plan.newConcrete)
        } else {
            logger.warn {
                "Migration skipped $skipped document(s) — keeping the legacy index " +
                    "'${OpenSearchIndexNameResolver.LEGACY_INDEX}' in place; resolve the skips and re-run to complete it"
            }
        }
    }

    private fun completeRebuild(plan: RebuildPlan) {
        if (plan.definitionName != null && plan.newConcrete != null) {
            indexInitializer.swapInRebuiltIndex(plan.definitionName, plan.newConcrete)
        } else {
            indexInitializer.dropLegacyIndex()
        }
    }

    private data class RebuildPlan(
        val definitionName: String?,
        val targetIndex: IndexCoordinates?,
        val newConcrete: String?,
    )

    /**
     * After a scoped rebuild has swapped the alias onto the fresh index and dropped the old one, re-index every
     * document of [definitionName] whose `changedOn` moved at/after [from] (i.e. during the rebuild) from
     * PostgreSQL into the now-live index. A live write during the rebuild landed in the dropped old index; this
     * restores it. Re-reading the latest state and routing by definition (plain [JsonSchemaDocumentOsConverter.indexChunk])
     * is race-free: external versioning ([JsonSchemaDocumentOsDocument.indexVersion]) means the catch-up write
     * either wins or is a benign version conflict against a concurrent live write. A failure here is logged, not
     * fatal — the rebuild already succeeded and the reconciler remains the backstop.
     */
    private fun catchUpConcurrentWrites(definitionName: String, from: LocalDateTime, pageSize: Int) {
        val txTemplate = TransactionTemplate(transactionManager).apply { isReadOnly = true }
        var lastChangedOn: LocalDateTime? = null
        var lastId: UUID? = null
        var caughtUp = 0L
        try {
            while (!cancelRequested) {
                val cursorChangedOn = lastChangedOn
                val cursorId = lastId
                val page = txTemplate.execute {
                    val batch = fetchChangedSince(definitionName, from, cursorChangedOn, cursorId, pageSize)
                    if (batch.isEmpty()) {
                        null
                    } else {
                        val osDocuments = batch.mapNotNull { jpaDoc ->
                            try {
                                converter.toOsDocument(jpaDoc)
                            } catch (e: Exception) {
                                logger.warn(e) { "Failed to convert document ${jpaDoc.id().id} during catch-up — skipping" }
                                null
                            }
                        }
                        CatchUpPage(osDocuments, batch.last().changedOn(), batch.last().id().id).also { entityManager.clear() }
                    }
                } ?: break

                page.osDocuments.chunked(JsonSchemaDocumentOsConverter.BULK_CHUNK_SIZE).forEach { converter.indexChunk(it) }
                caughtUp += page.osDocuments.size
                lastChangedOn = page.lastChangedOn
                lastId = page.lastId
            }
            if (caughtUp > 0) {
                logger.info { "Re-indexed $caughtUp concurrently-changed document(s) into the rebuilt '$definitionName' index" }
            }
        } catch (e: Exception) {
            logger.warn(e) { "Catch-up after rebuilding '$definitionName' failed — the reconciler will repair any missed write" }
        }
    }

    /** Keyset scan (by `changedOn`, then id) of a single definition's documents changed at/after [from]. */
    private fun fetchChangedSince(
        definitionName: String,
        from: LocalDateTime,
        lastChangedOn: LocalDateTime?,
        lastId: UUID?,
        pageSize: Int,
    ): List<JsonSchemaDocument> {
        val hasCursor = lastChangedOn != null && lastId != null
        val jpql = buildString {
            append("SELECT d FROM JsonSchemaDocument d LEFT JOIN FETCH d.internalStatus")
            append(" WHERE d.documentDefinitionId.name = :definitionName AND d.changedOn >= :from")
            if (hasCursor) {
                append(" AND (d.changedOn > :lastChangedOn OR (d.changedOn = :lastChangedOn AND d.id.id > :lastId))")
            }
            append(" ORDER BY d.changedOn ASC, d.id.id ASC")
        }
        val query = entityManager.createQuery(jpql, JsonSchemaDocument::class.java)
        query.setParameter("definitionName", definitionName)
        query.setParameter("from", from)
        if (hasCursor) {
            query.setParameter("lastChangedOn", lastChangedOn)
            query.setParameter("lastId", lastId)
        }
        return query.setMaxResults(pageSize).resultList
    }

    private data class CatchUpPage(
        val osDocuments: List<JsonSchemaDocumentOsDocument>,
        val lastChangedOn: LocalDateTime,
        val lastId: UUID,
    )

    /** Status of a specific run (by id) or the most recent run when [runId] is null. */
    fun status(runId: UUID? = null): Map<String, Any?> = runService.toStatusMap(runId)

    fun listRuns(pageable: Pageable): Page<Map<String, Any?>> = runService.listRuns(pageable)

    /**
     * Scoped keyset fetch. Applies the optional [scope] filters, eagerly loads the lazy `internalStatus`
     * `@ManyToOne` (C1 — so the detached entity serializes the real status key, not null), and keeps a
     * keyset cursor on the primary key for constant-cost pagination.
     */
    private fun fetchBatch(scope: ReindexRequest, lastId: UUID?, pageSize: Int): List<JsonSchemaDocument> {
        val cb = entityManager.criteriaBuilder
        val query = cb.createQuery(JsonSchemaDocument::class.java)
        val root = query.from(JsonSchemaDocument::class.java)
        root.fetch<Any, Any>("internalStatus", JoinType.LEFT)

        val predicates = mutableListOf<Predicate>()
        scope.modifiedAfter?.let { predicates += cb.greaterThan(root.get<LocalDateTime>("modifiedOn"), it) }
        scope.modifiedBefore?.let { predicates += cb.lessThan(root.get<LocalDateTime>("modifiedOn"), it) }
        scope.documentDefinitionName?.let {
            predicates += cb.equal(root.get<Any>("documentDefinitionId").get<String>("name"), it)
        }
        scope.documentIds?.takeIf { it.isNotEmpty() }?.let {
            predicates += root.get<Any>("id").get<UUID>("id").`in`(it)
        }
        lastId?.let { predicates += cb.greaterThan(root.get<Any>("id").get<UUID>("id"), it) }

        // Only restrict when there is at least one predicate; an empty where(...) matches no rows.
        if (predicates.isNotEmpty()) {
            query.where(*predicates.toTypedArray())
        }
        query.orderBy(cb.asc(root.get<Any>("id").get<UUID>("id")))
        return entityManager.createQuery(query).setMaxResults(pageSize).resultList
    }

    /**
     * Scans OpenSearch for documents matching [scope], checks each batch against PostgreSQL,
     * and deletes orphans (documents in OpenSearch but not in PostgreSQL).
     * Uses scroll API to handle datasets larger than 10k documents.
     */
    private fun pruneOrphans(runId: UUID, scope: ReindexRequest): Long {
        var pruned = 0L
        var checked = 0L
        val txTemplate = TransactionTemplate(transactionManager).apply { isReadOnly = true }

        val totalOsCount = countOpenSearchDocs(scope)
        runService.startPruning(runId, totalOsCount)

        scrollOpenSearchDocs(scope, PRUNE_BATCH_SIZE) { osDocs ->
            if (cancelRequested) return@scrollOpenSearchDocs false

            val existingIds = txTemplate.execute {
                findExistingIds(osDocs.mapNotNull { it.id.toUuidOrNull() })
            }.orEmpty()

            val orphans = osDocs.filter { it.id.toUuidOrNull() !in existingIds }
            orphans.forEach { deleteFromConcreteIndex(it) }
            pruned += orphans.size
            checked += osDocs.size

            runService.recordPruneProgress(runId, checked, pruned)
            true
        }
        return pruned
    }

    /** Deletes an orphan from its own per-definition index (resolved from the indexed document). */
    private fun deleteFromConcreteIndex(osDocument: JsonSchemaDocumentOsDocument) {
        val definitionName = osDocument.definitionId?.name
        if (definitionName == null) {
            logger.warn { "Orphan document ${osDocument.id} has no definition name — cannot resolve index to prune it" }
            return
        }
        elasticsearchOperations.delete(osDocument.id, IndexCoordinates.of(resolver.indexNameFor(definitionName)))
    }

    private fun String.toUuidOrNull(): UUID? = try {
        UUID.fromString(this)
    } catch (e: IllegalArgumentException) {
        null
    }

    /**
     * Resolves the OpenSearch index for a run: a scoped run (single definition) targets that definition's
     * index; an unscoped run targets the shared read alias spanning every per-definition index.
     */
    private fun indexCoordinatesFor(scope: ReindexRequest): IndexCoordinates =
        scope.documentDefinitionName
            ?.let { IndexCoordinates.of(resolver.indexNameFor(it)) }
            ?: IndexCoordinates.of(OpenSearchIndexNameResolver.READ_ALIAS)

    private fun countOpenSearchDocs(scope: ReindexRequest): Long {
        val boolQuery = BoolQueryBuilder()

        scope.documentDefinitionName?.let {
            boolQuery.filter(QueryBuilders.termQuery("definitionId.name", it))
        }
        scope.modifiedAfter?.let {
            boolQuery.filter(QueryBuilders.rangeQuery("modifiedOn").gt(it.format(OS_DATE_FORMAT)))
        }
        scope.modifiedBefore?.let {
            boolQuery.filter(QueryBuilders.rangeQuery("modifiedOn").lt(it.format(OS_DATE_FORMAT)))
        }
        scope.documentIds?.takeIf { it.isNotEmpty() }?.let { ids ->
            boolQuery.filter(QueryBuilders.idsQuery().addIds(*ids.map { it.toString() }.toTypedArray()))
        }

        val query = NativeSearchQueryBuilder()
            .withQuery(boolQuery)
            .build()

        return elasticsearchOperations.count(query, JsonSchemaDocumentOsDocument::class.java, indexCoordinatesFor(scope))
    }

    /**
     * Scrolls through all OpenSearch documents matching [scope], invoking [handler] for each batch.
     * Handler returns `true` to continue, `false` to stop early. The full document (not just its id) is
     * carried so an orphan delete can route to the document's own per-definition index.
     */
    private fun scrollOpenSearchDocs(
        scope: ReindexRequest,
        batchSize: Int,
        handler: (List<JsonSchemaDocumentOsDocument>) -> Boolean
    ) {
        val boolQuery = BoolQueryBuilder()

        scope.documentDefinitionName?.let {
            boolQuery.filter(QueryBuilders.termQuery("definitionId.name", it))
        }
        scope.modifiedAfter?.let {
            boolQuery.filter(QueryBuilders.rangeQuery("modifiedOn").gt(it.format(OS_DATE_FORMAT)))
        }
        scope.modifiedBefore?.let {
            boolQuery.filter(QueryBuilders.rangeQuery("modifiedOn").lt(it.format(OS_DATE_FORMAT)))
        }
        scope.documentIds?.takeIf { it.isNotEmpty() }?.let { ids ->
            boolQuery.filter(QueryBuilders.idsQuery().addIds(*ids.map { it.toString() }.toTypedArray()))
        }

        val query = NativeSearchQueryBuilder()
            .withQuery(boolQuery)
            .withPageable(PageRequest.of(0, batchSize))
            .build()

        elasticsearchOperations.searchForStream(query, JsonSchemaDocumentOsDocument::class.java, indexCoordinatesFor(scope)).use { stream ->
            val iterator = stream.iterator()
            val batch = mutableListOf<JsonSchemaDocumentOsDocument>()

            while (iterator.hasNext()) {
                val content = iterator.next().content ?: continue
                batch.add(content)
                if (batch.size >= batchSize) {
                    if (!handler(batch.toList())) return
                    batch.clear()
                }
            }
            if (batch.isNotEmpty()) {
                handler(batch)
            }
        }
    }

    private fun findExistingIds(ids: List<UUID>): Set<UUID> {
        if (ids.isEmpty()) return emptySet()
        return entityManager.createQuery(
            "SELECT d.id.id FROM JsonSchemaDocument d WHERE d.id.id IN :ids",
            UUID::class.java
        ).setParameter("ids", ids).resultList.toSet()
    }

    /** Signals an in-flight run to stop gracefully and shuts the executor down on context close. */
    override fun destroy() {
        cancelRequested = true
        executor.shutdown()
        try {
            if (!executor.awaitTermination(SHUTDOWN_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                executor.shutdownNow()
            }
        } catch (e: InterruptedException) {
            executor.shutdownNow()
            Thread.currentThread().interrupt()
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        private val OS_DATE_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSS")

        const val LOCK_NAME = "document-opensearch-reindex"

        /**
         * Generous lock lease. The persisted run-state heartbeat is the robust liveness signal; the lock
         * is only the cluster-wide mutex. A run exceeding this could in theory let a second runner start —
         * acceptable because all writes are idempotent upserts.
         */
        val LOCK_AT_MOST_FOR: Duration = Duration.ofHours(6)

        private const val SHUTDOWN_TIMEOUT_SECONDS = 30L
        private const val PRUNE_BATCH_SIZE = 1000

        /** Clock-skew margin on the post-swap catch-up lower bound. Over-inclusion is harmless (idempotent). */
        private val CATCH_UP_OVERLAP: Duration = Duration.ofSeconds(10)
    }
}
