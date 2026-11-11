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
import com.ritense.document.opensearch.OpenSearchProperties
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.opensearch.domain.OpenSearchReconcileState
import com.ritense.document.opensearch.repository.OpenSearchReconcileStateRepository
import com.ritense.document.opensearch.repository.PendingIndexDeletionRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.persistence.EntityManager
import net.javacrumbs.shedlock.core.LockConfiguration
import net.javacrumbs.shedlock.core.LockProvider
import org.opensearch.data.client.orhlc.NativeSearchQueryBuilder
import org.opensearch.index.query.QueryBuilders
import org.springframework.data.domain.PageRequest
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.util.UUID

/**
 * The self-healing backbone: a single-writer, watermark-based incremental reindex that makes the
 * OpenSearch index a derived read-model of PostgreSQL.
 *
 * Each cycle (guarded cluster-wide by a ShedLock named lock so exactly one node runs it):
 * 1. reads the persisted watermark (initialised to the beginning of time on the first ever run, so enabling
 *    OpenSearch on an install that already has cases backfills them);
 * 2. keyset-scans every document with `changed_on > (watermark − overlap)` and idempotently upserts it —
 *    covering status/tags/anything the live path missed or that happened during an OpenSearch outage. A cycle
 *    stops after [CYCLE_BUDGET] so a large backfill spreads over several cycles within the lock lease;
 * 3. retries the cases OpenSearch rejected earlier ([IndexCompletenessService]);
 * 4. drains the pending-index-deletion table (O(deletes), never an O(index) scan);
 * 5. advances the watermark to the highest `changed_on` processed. A rejected case does not hold the watermark —
 *    it is recorded and retried in step 3 — but any other failure leaves the watermark parked.
 *
 * All writes are idempotent, so re-processing the overlap window (or a whole failed cycle) is safe.
 */
open class DocumentOpenSearchReconcileService(
    private val entityManager: EntityManager,
    private val converter: JsonSchemaDocumentOsConverter,
    private val operations: ElasticsearchOperations,
    private val resolver: OpenSearchIndexNameResolver,
    private val stateRepository: OpenSearchReconcileStateRepository,
    private val pendingIndexDeletionRepository: PendingIndexDeletionRepository,
    private val transactionManager: PlatformTransactionManager,
    private val lockProvider: LockProvider,
    private val properties: OpenSearchProperties,
    private val indexInitializer: DocumentOpenSearchIndexInitializer,
    private val completeness: IndexCompletenessService,
) {

    // Best-effort, per-node timestamp of the last empty-version-index prune. The ShedLock serializes reconcile
    // cycles cluster-wide, so a per-node clock is enough to keep the prune to roughly once per pruneInterval.
    @Volatile
    private var lastPruneAtMillis: Long = 0L

    open fun reconcile() {
        if (!properties.enabled) return

        val lock = lockProvider.lock(
            LockConfiguration(Instant.now(), LOCK_NAME, LOCK_AT_MOST_FOR, Duration.ZERO)
        )
        if (lock.isEmpty) {
            logger.debug { "Another node is reconciling — skipping this cycle" }
            return
        }

        try {
            val watermark = completeness.initializeWatermarkIfAbsent()
            val from = watermark.minus(properties.reconcile.overlap)
            val maxSeen = processUpserts(from)
            retryDueRejections()
            drainPendingDeletions()
            pruneEmptyVersionIndicesIfDue()
            if (maxSeen.isAfter(watermark)) {
                advanceWatermark(maxSeen)
                logger.debug { "Reconcile advanced watermark to $maxSeen" }
            }
        } catch (e: Exception) {
            logger.error(e) { "OpenSearch reconcile cycle failed — watermark not advanced; retrying next cycle" }
        } finally {
            lock.get().unlock()
        }
    }

    /**
     * Keyset-paginates over `changed_on > from` (tie-broken by id), converting and idempotently upserting
     * each page. Returns the highest `changed_on` processed (or [from] when nothing changed).
     */
    private fun processUpserts(from: LocalDateTime): LocalDateTime {
        val deadline = System.nanoTime() + CYCLE_BUDGET.toNanos()
        var processedThrough = from
        var skippedTotal = 0L
        var lastChangedOn: LocalDateTime? = null
        var lastId: UUID? = null
        val pageSize = properties.reconcile.pageSize
        val txTemplate = TransactionTemplate(transactionManager).apply { isReadOnly = true }

        while (System.nanoTime() < deadline) {
            val cursorChangedOn = lastChangedOn
            val cursorId = lastId
            val page = txTemplate.execute {
                val batch = fetchPage(from, cursorChangedOn, cursorId, pageSize)
                if (batch.isEmpty()) {
                    null
                } else {
                    val osDocuments = batch.mapNotNull { converter.convertOrReject(it) }
                    val last = batch.last()
                    ReconcilePage(osDocuments, batch.size - osDocuments.size, last.changedOn(), last.id().id)
                        .also { entityManager.clear() }
                }
            } ?: break

            skippedTotal += page.convFailed + page.osDocuments.chunked(JsonSchemaDocumentOsConverter.BULK_CHUNK_SIZE)
                .sumOf { converter.indexChunk(it) }
            processedThrough = page.lastChangedOn
            lastChangedOn = page.lastChangedOn
            lastId = page.lastId
        }
        if (skippedTotal > 0) {
            logger.warn { "Reconcile could not index $skippedTotal document(s) this cycle — recorded for retry" }
        }
        return processedThrough
    }

    /**
     * Scoped keyset fetch. Eagerly loads the lazy `internalStatus` `@ManyToOne` so the converted document
     * carries the real status key, and keeps a composite `(changed_on, id)` cursor for constant-cost
     * pagination that is stable when many rows share the same `changed_on`.
     */
    private fun fetchPage(
        from: LocalDateTime,
        lastChangedOn: LocalDateTime?,
        lastId: UUID?,
        pageSize: Int,
    ): List<JsonSchemaDocument> {
        val hasCursor = lastChangedOn != null && lastId != null
        val jpql = buildString {
            append("SELECT d FROM JsonSchemaDocument d LEFT JOIN FETCH d.internalStatus WHERE d.changedOn > :from")
            if (hasCursor) {
                append(" AND (d.changedOn > :lastChangedOn OR (d.changedOn = :lastChangedOn AND d.id.id > :lastId))")
            }
            append(" ORDER BY d.changedOn ASC, d.id.id ASC")
        }
        val query = entityManager.createQuery(jpql, JsonSchemaDocument::class.java)
        query.setParameter("from", from)
        if (hasCursor) {
            query.setParameter("lastChangedOn", lastChangedOn)
            query.setParameter("lastId", lastId)
        }
        return query.setMaxResults(pageSize).resultList
    }

    /**
     * Re-sends the rejected cases whose retry is due, so they are indexed once the cause is gone (a raised shard
     * or field limit); a changed case is already re-sent by the scan. A case that no longer exists is forgotten.
     */
    private fun retryDueRejections() {
        val ids = completeness.dueForRetry(properties.reconcile.pageSize)
        if (ids.isEmpty()) return
        val osDocuments = TransactionTemplate(transactionManager).apply { isReadOnly = true }.execute {
            val documents = entityManager.createQuery(
                "SELECT d FROM JsonSchemaDocument d LEFT JOIN FETCH d.internalStatus WHERE d.id.id IN :ids",
                JsonSchemaDocument::class.java,
            ).setParameter("ids", ids).resultList
            completeness.clearRejected(ids - documents.map { it.id().id }.toSet())
            documents.mapNotNull { converter.convertOrReject(it) }.also { entityManager.clear() }
        }.orEmpty()
        val stillRejected = osDocuments.chunked(JsonSchemaDocumentOsConverter.BULK_CHUNK_SIZE).sumOf { converter.indexChunk(it) }
        logger.debug { "Retried ${ids.size} rejected document(s); $stillRejected still rejected" }
    }

    /**
     * Removes pending-deletion documents from OpenSearch in batches, then deletes the drained
     * pending-deletion rows.
     */
    private fun drainPendingDeletions() {
        val batchSize = properties.reconcile.pendingDeletionBatchSize
        val readTemplate = TransactionTemplate(transactionManager).apply { isReadOnly = true }
        val writeTemplate = TransactionTemplate(transactionManager)
        // The id-resolution search below is near-real-time; refresh so a just-indexed document is visible and
        // cannot be orphaned when we drop its pending row. A post-refresh miss then truly means it is already gone.
        operations.indexOps(IndexCoordinates.of(OpenSearchIndexNameResolver.READ_ALIAS)).refresh()
        while (true) {
            val pendingDeletions = readTemplate.execute {
                pendingIndexDeletionRepository.findByOrderByDeletedOnAsc(PageRequest.of(0, batchSize))
            }.orEmpty()
            if (pendingDeletions.isEmpty()) break

            val ids = pendingDeletions.map { it.documentId }
            ids.forEach { deleteEveryCopy(it.toString()) }
            completeness.clearRejected(ids)
            writeTemplate.execute { pendingIndexDeletionRepository.deleteAllById(ids) }
            logger.debug { "Drained ${pendingDeletions.size} pending index deletion(s) from OpenSearch" }
        }
    }

    /** Finds every indexed copy of [id] through the shared read alias and deletes each from its own index. */
    private fun deleteEveryCopy(id: String) {
        val query = NativeSearchQueryBuilder()
            .withQuery(QueryBuilders.idsQuery().addIds(id))
            .build()
        operations.search(query, JsonSchemaDocumentOsDocument::class.java, IndexCoordinates.of(OpenSearchIndexNameResolver.READ_ALIAS))
            .searchHits
            .mapNotNull { it.content.definitionId }
            .forEach { definitionId ->
                val definitionName = definitionId.name ?: return@forEach
                val versionTag = definitionId.blueprintId?.blueprintVersionTag ?: return@forEach
                operations.delete(id, IndexCoordinates.of(resolver.writeAliasFor(definitionName, versionTag)))
            }
    }

    private fun advanceWatermark(newWatermark: LocalDateTime) {
        TransactionTemplate(transactionManager).execute {
            val state = stateRepository.findById(OpenSearchReconcileState.SINGLETON_ID)
                .orElseGet { OpenSearchReconcileState(watermark = newWatermark) }
            state.watermark = newWatermark
            stateRepository.save(state)
        }
    }

    /** Runs the empty-version-index prune at most once per [OpenSearchProperties.Reconcile.pruneInterval]. */
    private fun pruneEmptyVersionIndicesIfDue() {
        if (!properties.reconcile.pruneEmptyVersionIndices) return
        val now = System.currentTimeMillis()
        if (now - lastPruneAtMillis < properties.reconcile.pruneInterval.toMillis()) return
        lastPruneAtMillis = now
        indexInitializer.pruneEmptyVersionIndices()
    }

    private data class ReconcilePage(
        val osDocuments: List<JsonSchemaDocumentOsDocument>,
        val convFailed: Int,
        val lastChangedOn: LocalDateTime,
        val lastId: UUID,
    )

    companion object {
        private val logger = KotlinLogging.logger {}

        const val LOCK_NAME = "document-opensearch-reconcile"

        /** Lock lease per cycle; [CYCLE_BUDGET] keeps a cycle well within it. */
        val LOCK_AT_MOST_FOR: Duration = Duration.ofMinutes(10)

        private val CYCLE_BUDGET: Duration = LOCK_AT_MOST_FOR.dividedBy(2)
    }
}
