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

import com.ritense.document.opensearch.OpenSearchProperties
import com.ritense.document.opensearch.domain.DocumentIndexRejection
import com.ritense.document.opensearch.domain.OpenSearchReconcileState
import com.ritense.document.opensearch.repository.DocumentIndexRejectionRepository
import com.ritense.document.opensearch.repository.OpenSearchReconcileStateRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.persistence.EntityManager
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import java.time.Duration
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * Knows when OpenSearch cannot list every case PostgreSQL holds: a case it rejected (per definition), or a
 * reconciler that has fallen behind the newest change (for example right after OpenSearch is enabled).
 */
@Transactional
open class IndexCompletenessService(
    private val rejectionRepository: DocumentIndexRejectionRepository,
    private val stateRepository: OpenSearchReconcileStateRepository,
    private val entityManager: EntityManager,
    private val properties: OpenSearchProperties,
    transactionManager: PlatformTransactionManager,
) {

    // Writers call this from inside read-only page transactions.
    private val newTransaction = TransactionTemplate(transactionManager).apply {
        propagationBehavior = TransactionDefinition.PROPAGATION_REQUIRES_NEW
    }

    /** Records a failed index attempt per case and schedules its next retry. Returns the updated rows. */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    open fun recordRejected(definitionNameById: Map<UUID, String>): List<DocumentIndexRejection> {
        if (definitionNameById.isEmpty()) return emptyList()
        return try {
            upsertRejections(definitionNameById)
        } catch (e: DataIntegrityViolationException) {
            // Another writer inserted the same case's first rejection concurrently; its row now exists.
            upsertRejections(definitionNameById)
        }
    }

    private fun upsertRejections(definitionNameById: Map<UUID, String>): List<DocumentIndexRejection> =
        newTransaction.execute {
            val now = LocalDateTime.now()
            val existing = rejectionRepository.findAllById(definitionNameById.keys).associateBy { it.documentId }
            val rejections = definitionNameById.map { (id, name) ->
                val rejection = existing[id]?.apply { rejectedAgain(name, now) }
                    ?: DocumentIndexRejection(id, name, firstRejectedOn = now, nextRetryOn = now)
                rejection.apply { nextRetryOn = now.plus(retryDelayAfter(attempts)) }
            }
            rejectionRepository.saveAllAndFlush(rejections)
        }.orEmpty()

    /** Forgets the rejections of cases that were indexed after all. Returns the rows it removed. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    open fun clearIndexed(documentIds: Collection<UUID>): List<DocumentIndexRejection> {
        if (documentIds.isEmpty()) return emptyList()
        val cleared = rejectionRepository.findAllById(documentIds)
        if (cleared.isNotEmpty()) rejectionRepository.deleteAllInBatch(cleared)
        return cleared
    }

    /** Forgets the rejections of cases that no longer exist. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    open fun clearRejected(documentIds: Collection<UUID>) {
        if (documentIds.isEmpty()) return
        rejectionRepository.deleteAllByIdInBatch(documentIds)
    }

    /** Forgets every rejection — a full recreate with no skips has re-indexed every case. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    open fun clearAllRejected() = rejectionRepository.deleteAllInBatch()

    /** Forgets the rejections of one case type — a scoped recreate with no skips has re-indexed each of its cases. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    open fun clearRejectedByDefinition(definitionName: String) {
        rejectionRepository.deleteAllByDefinitionName(definitionName)
    }

    @Transactional(readOnly = true)
    open fun rejectedDefinitionNames(): Set<String> = rejectionRepository.findDistinctDefinitionNames().toSet()

    @Transactional(readOnly = true)
    open fun rejectedCount(): Long = rejectionRepository.count()

    @Transactional(readOnly = true)
    open fun rejections(pageable: Pageable): Page<DocumentIndexRejection> =
        rejectionRepository.findAll(PageRequest.of(pageable.pageNumber, pageable.pageSize, Sort.by("firstRejectedOn", "documentId")))

    @Transactional(readOnly = true)
    open fun stillRejected(documentIds: Collection<UUID>): Set<UUID> =
        rejectionRepository.findAllById(documentIds).map { it.documentId }.toSet()

    /** Makes every rejected case due, so the next reconcile cycle retries them in batches. */
    // Whole seconds: MySQL rounds DATETIME fractions up, which would leave the rows just short of due.
    open fun retryAllNextCycle(): Int = rejectionRepository.retryAllAt(LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS))

    @Transactional(readOnly = true)
    open fun dueForRetry(limit: Int): List<UUID> =
        rejectionRepository.findByNextRetryOnLessThanEqualOrderByNextRetryOnAsc(LocalDateTime.now(), PageRequest.of(0, limit))
            .map { it.documentId }

    /**
     * Whether the oldest case change the reconciler has not yet processed is more than [maxLag] old, so OpenSearch
     * may be missing cases. Measuring the oldest *unprocessed* change — not the newest change against the watermark —
     * keeps a quiet install from flapping: a fresh change after a long pause is near-zero old, so not lagging, while
     * a genuinely stalled reconciler ages its backlog past the threshold. Without a reconciler only the live sync
     * keeps the index current, so never lagging.
     */
    @Transactional(readOnly = true)
    open fun isReconcileLagging(): Boolean {
        if (!properties.reconcile.enabled) return false
        val watermark = stateRepository.findById(OpenSearchReconcileState.SINGLETON_ID).map { it.watermark }.orElse(null)
            ?: return false
        val oldestUnprocessed = entityManager
            .createQuery("SELECT MIN(d.changedOn) FROM JsonSchemaDocument d WHERE d.changedOn > :watermark", LocalDateTime::class.java)
            .setParameter("watermark", watermark)
            .singleResult
            ?: return false
        return Duration.between(oldestUnprocessed, LocalDateTime.now()) > maxLag()
    }

    /**
     * Starts the reconciler at the beginning of time on its first run, so enabling OpenSearch on an install that
     * already has cases backfills them instead of leaving their lists empty until an admin reindex.
     */
    open fun initializeWatermarkIfAbsent(): LocalDateTime =
        stateRepository.findById(OpenSearchReconcileState.SINGLETON_ID).map { it.watermark }.orElseGet {
            stateRepository.save(OpenSearchReconcileState(watermark = INITIAL_WATERMARK))
            logger.info { "Initialised the OpenSearch reconcile watermark; the reconciler backfills every existing case" }
            INITIAL_WATERMARK
        }

    private fun maxLag(): Duration = properties.reconcile.interval.multipliedBy(2).plus(properties.reconcile.overlap)

    companion object {
        private val logger = KotlinLogging.logger {}
        val INITIAL_WATERMARK: LocalDateTime = LocalDateTime.of(1970, 1, 1, 0, 0)

        /** Retrying never stops: a rejected case keeps its case type on PostgreSQL, so giving up would hide it. */
        fun retryDelayAfter(attempts: Int): Duration = when {
            attempts <= 3 -> Duration.ofMinutes(10)
            attempts <= 6 -> Duration.ofHours(1)
            else -> Duration.ofHours(24)
        }
    }
}
