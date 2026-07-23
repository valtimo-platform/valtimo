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
import com.ritense.document.opensearch.repository.JsonSchemaDocumentOpenSearchRepository
import com.ritense.document.opensearch.repository.OpenSearchReconcileStateRepository
import com.ritense.document.opensearch.repository.PendingIndexDeletionRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.persistence.EntityManager
import net.javacrumbs.shedlock.core.LockConfiguration
import net.javacrumbs.shedlock.core.LockProvider
import org.springframework.data.domain.PageRequest
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
 * 1. reads the persisted watermark (initialised to the current `MAX(changed_on)` on first ever run, so a
 *    fresh deploy does not re-index the whole corpus — initial population stays with the admin re-index);
 * 2. keyset-scans every document with `changed_on > (watermark − overlap)` and idempotently upserts it —
 *    covering status/tags/anything the live path missed or that happened during an OpenSearch outage;
 * 3. drains the pending-index-deletion table (O(deletes), never an O(index) scan);
 * 4. advances the watermark to the highest `changed_on` processed — **only** after a fully successful
 *    cycle. Any failure leaves the watermark parked, so the next cycle simply retries from the same point.
 *
 * All writes are idempotent, so re-processing the overlap window (or a whole failed cycle) is safe.
 */
open class DocumentOpenSearchReconcileService(
    private val entityManager: EntityManager,
    private val converter: JsonSchemaDocumentOsConverter,
    private val openSearchRepository: JsonSchemaDocumentOpenSearchRepository,
    private val stateRepository: OpenSearchReconcileStateRepository,
    private val pendingIndexDeletionRepository: PendingIndexDeletionRepository,
    private val transactionManager: PlatformTransactionManager,
    private val lockProvider: LockProvider,
    private val properties: OpenSearchProperties,
) {

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
            val watermark = currentWatermark()
            val from = watermark.minus(properties.reconcile.overlap)
            val maxSeen = processUpserts(from)
            drainPendingDeletions()
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
     * each page. Returns the highest `changed_on` seen (or [from] when nothing changed).
     */
    private fun processUpserts(from: LocalDateTime): LocalDateTime {
        var maxSeen = from
        var lastChangedOn: LocalDateTime? = null
        var lastId: UUID? = null
        val pageSize = properties.reconcile.pageSize
        val txTemplate = TransactionTemplate(transactionManager).apply { isReadOnly = true }

        while (true) {
            val cursorChangedOn = lastChangedOn
            val cursorId = lastId
            val page = txTemplate.execute {
                val batch = fetchPage(from, cursorChangedOn, cursorId, pageSize)
                if (batch.isEmpty()) {
                    null
                } else {
                    val osDocuments = batch.mapNotNull { document ->
                        try {
                            converter.toOsDocument(document)
                        } catch (e: Exception) {
                            logger.warn(e) { "Failed to convert document ${document.id().id} during reconcile — skipping" }
                            null
                        }
                    }
                    val last = batch.last()
                    ReconcilePage(osDocuments, last.changedOn(), last.id().id).also { entityManager.clear() }
                }
            } ?: break

            page.osDocuments.chunked(JsonSchemaDocumentOsConverter.BULK_CHUNK_SIZE)
                .forEach { converter.indexChunk(it) }

            if (page.lastChangedOn.isAfter(maxSeen)) maxSeen = page.lastChangedOn
            lastChangedOn = page.lastChangedOn
            lastId = page.lastId
        }
        return maxSeen
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
     * Removes pending-deletion documents from OpenSearch in batches, then deletes the drained
     * pending-deletion rows.
     */
    private fun drainPendingDeletions() {
        val batchSize = properties.reconcile.pendingDeletionBatchSize
        val readTemplate = TransactionTemplate(transactionManager).apply { isReadOnly = true }
        val writeTemplate = TransactionTemplate(transactionManager)
        while (true) {
            val pendingDeletions = readTemplate.execute {
                pendingIndexDeletionRepository.findByOrderByDeletedOnAsc(PageRequest.of(0, batchSize))
            }.orEmpty()
            if (pendingDeletions.isEmpty()) break

            pendingDeletions.forEach { openSearchRepository.deleteById(it.documentId.toString()) }
            writeTemplate.execute { pendingIndexDeletionRepository.deleteAllById(pendingDeletions.map { it.documentId }) }
            logger.debug { "Drained ${pendingDeletions.size} pending index deletion(s) from OpenSearch" }
        }
    }

    private fun currentWatermark(): LocalDateTime =
        requireNotNull(
            TransactionTemplate(transactionManager).execute {
                stateRepository.findById(OpenSearchReconcileState.SINGLETON_ID)
                    .map { it.watermark }
                    .orElseGet {
                        val initial = initialWatermark()
                        stateRepository.save(OpenSearchReconcileState(watermark = initial))
                        logger.info { "Initialised OpenSearch reconcile watermark to $initial" }
                        initial
                    }
            }
        )

    private fun initialWatermark(): LocalDateTime =
        entityManager
            .createQuery("SELECT MAX(d.changedOn) FROM JsonSchemaDocument d", LocalDateTime::class.java)
            .singleResult ?: LocalDateTime.now()

    private fun advanceWatermark(newWatermark: LocalDateTime) {
        TransactionTemplate(transactionManager).execute {
            val state = stateRepository.findById(OpenSearchReconcileState.SINGLETON_ID)
                .orElseGet { OpenSearchReconcileState(watermark = newWatermark) }
            state.watermark = newWatermark
            stateRepository.save(state)
        }
    }

    private data class ReconcilePage(
        val osDocuments: List<JsonSchemaDocumentOsDocument>,
        val lastChangedOn: LocalDateTime,
        val lastId: UUID,
    )

    companion object {
        private val logger = KotlinLogging.logger {}

        const val LOCK_NAME = "document-opensearch-reconcile"

        /** Lock lease per cycle; a cycle should complete well within this. */
        val LOCK_AT_MOST_FOR: Duration = Duration.ofMinutes(10)
    }
}
