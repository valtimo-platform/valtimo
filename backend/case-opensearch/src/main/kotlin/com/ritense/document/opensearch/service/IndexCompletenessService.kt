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
import org.springframework.data.domain.PageRequest
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.LocalDateTime
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
) {

    // Writers call this from inside read-only page transactions.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    open fun recordRejected(definitionNameById: Map<UUID, String>) {
        if (definitionNameById.isEmpty()) return
        rejectionRepository.saveAll(definitionNameById.map { (id, name) -> DocumentIndexRejection(id, name) })
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    open fun clearRejected(documentIds: Collection<UUID>) {
        if (documentIds.isEmpty()) return
        rejectionRepository.deleteAllByIdInBatch(documentIds)
    }

    @Transactional(readOnly = true)
    open fun rejectedDefinitionNames(): Set<String> = rejectionRepository.findDistinctDefinitionNames().toSet()

    @Transactional(readOnly = true)
    open fun rejectedCount(): Long = rejectionRepository.count()

    @Transactional(readOnly = true)
    open fun oldestRejected(limit: Int): List<UUID> =
        rejectionRepository.findByOrderByRejectedOnAsc(PageRequest.of(0, limit)).map { it.documentId }

    /**
     * Whether the newest case change is more than two reconcile intervals ahead of the reconcile watermark, so
     * OpenSearch may miss cases. Without a reconciler only the live sync keeps the index current, so never lagging.
     */
    @Transactional(readOnly = true)
    open fun isReconcileLagging(): Boolean {
        if (!properties.reconcile.enabled) return false
        val watermark = stateRepository.findById(OpenSearchReconcileState.SINGLETON_ID).map { it.watermark }.orElse(null)
            ?: return false
        val latestChange = entityManager
            .createQuery("SELECT MAX(d.changedOn) FROM JsonSchemaDocument d", LocalDateTime::class.java)
            .singleResult
            ?: return false
        return Duration.between(watermark, latestChange) > maxLag()
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
    }
}
