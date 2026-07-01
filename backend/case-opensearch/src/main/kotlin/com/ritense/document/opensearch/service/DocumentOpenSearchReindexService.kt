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

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.opensearch.repository.JsonSchemaDocumentOpenSearchRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.persistence.EntityManager
import jakarta.persistence.criteria.JoinType
import jakarta.persistence.criteria.Predicate
import net.javacrumbs.shedlock.core.LockConfiguration
import net.javacrumbs.shedlock.core.LockProvider
import org.springframework.beans.factory.DisposableBean
import org.springframework.data.elasticsearch.BulkFailureException
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
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
    private val openSearchRepository: JsonSchemaDocumentOpenSearchRepository,
    private val objectMapper: ObjectMapper,
    private val elasticsearchOperations: ElasticsearchOperations,
    private val transactionManager: PlatformTransactionManager,
    private val lockProvider: LockProvider,
    private val runService: OpenSearchReindexRunService,
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
                reindex(run.id, request)
            } catch (e: Exception) {
                logger.error(e) { "Re-index run ${run.id} terminated with error" }
            } finally {
                lock.get().unlock()
            }
        }
        return run.id
    }

    /**
     * Runs the chunked, resumable re-index loop for [runId] over the documents matching [scope].
     * Each DB page is read in its own short read-only transaction (keeping snapshots short) and the
     * persistence context is cleared after every page. Returns the number of documents processed.
     */
    open fun reindex(runId: UUID, scope: ReindexRequest): Long {
        var lastId: UUID? = runService.cursorOf(runId)
        var processed: Long = runService.processedOf(runId)
        var skipped = 0L
        val pageSize = scope.effectivePageSize()
        val txTemplate = TransactionTemplate(transactionManager).apply { isReadOnly = true }

        try {
            while (!cancelRequested) {
                val cursor = lastId
                val batch = txTemplate.execute {
                    fetchBatch(scope, cursor, pageSize).also { entityManager.clear() }
                } ?: break
                if (batch.isEmpty()) break

                val docs = batch.mapNotNull { jpaDoc ->
                    try {
                        val tree = objectMapper.valueToTree<JsonNode>(jpaDoc)
                        objectMapper.treeToValue(tree, JsonSchemaDocumentOsDocument::class.java)
                            .copy(contentText = extractLeafValues(tree.get("content")))
                    } catch (e: Exception) {
                        skipped++
                        logger.warn(e) { "Failed to convert document — skipping" }
                        null
                    }
                }
                skipped += docs.chunked(BULK_CHUNK_SIZE).sumOf { indexChunk(it) }

                processed += docs.size
                lastId = batch.last().id().id
                runService.recordProgress(runId, lastId, processed, skipped)
            }

            if (cancelRequested) {
                logger.info { "Re-index run $runId cancelled — marking STOPPED (processed=$processed, skipped=$skipped)" }
                runService.stop(runId)
            } else {
                indexOps().refresh()
                logger.info { "Re-index run $runId complete (processed=$processed, skipped=$skipped)" }
                runService.complete(runId)
            }
        } catch (e: Exception) {
            runService.fail(runId, e.message)
            logger.error(e) { "Re-index failed (run $runId)" }
            throw e
        }
        return processed
    }

    /** Status of a specific run (by id) or the most recent run when [runId] is null. */
    fun status(runId: UUID? = null): Map<String, Any?> = runService.toStatusMap(runId)

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

    private fun indexOps() = elasticsearchOperations.indexOps(JsonSchemaDocumentOsDocument::class.java)

    /**
     * Indexes a single bulk chunk. On an item-level [BulkFailureException] the poison document(s) are
     * isolated by retrying the chunk one document at a time, skipping (and counting) only those that
     * actually fail — a single bad document can never loop the run forever. Transport/connection errors
     * are NOT caught here: they propagate so the run is marked FAILED and is resumable from the cursor.
     *
     * @return the number of documents skipped in this chunk
     */
    private fun indexChunk(chunk: List<JsonSchemaDocumentOsDocument>): Long =
        try {
            openSearchRepository.saveAll(chunk)
            0L
        } catch (e: BulkFailureException) {
            var skipped = 0L
            chunk.forEach { doc ->
                try {
                    openSearchRepository.save(doc)
                } catch (ex: Exception) {
                    skipped++
                    logger.warn(ex) { "Failed to index document ${doc.id} — skipping" }
                }
            }
            skipped
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

        const val LOCK_NAME = "document-opensearch-reindex"

        /**
         * Generous lock lease. The persisted run-state heartbeat is the robust liveness signal; the lock
         * is only the cluster-wide mutex. A run exceeding this could in theory let a second runner start —
         * acceptable because all writes are idempotent upserts.
         */
        val LOCK_AT_MOST_FOR: Duration = Duration.ofHours(6)

        /** OpenSearch bulk payload size, decoupled from the DB page size (P2). */
        const val BULK_CHUNK_SIZE = 500

        private const val SHUTDOWN_TIMEOUT_SECONDS = 30L
    }
}
