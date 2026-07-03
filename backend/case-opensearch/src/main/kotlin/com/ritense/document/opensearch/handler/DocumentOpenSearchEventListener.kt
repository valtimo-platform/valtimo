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

package com.ritense.document.opensearch.handler

import com.ritense.document.domain.impl.event.JsonSchemaDocumentCreatedEvent
import com.ritense.document.domain.impl.event.JsonSchemaDocumentModifiedEvent
import com.ritense.document.event.DocumentAssigneeChangedEvent
import com.ritense.document.event.DocumentRetentionPeriodSetEvent
import com.ritense.document.event.DocumentRetentionPeriodUnsetEvent
import com.ritense.document.event.DocumentUnassignedEvent
import com.ritense.document.opensearch.service.DocumentOpenSearchSyncService
import com.ritense.valtimo.contract.document.event.DocumentRelatedFileAddedEvent
import com.ritense.valtimo.contract.document.event.DocumentRelatedFileRemovedEvent
import com.ritense.valtimo.contract.event.DocumentDeletedEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.DisposableBean
import org.springframework.transaction.event.TransactionPhase.AFTER_COMMIT
import org.springframework.transaction.event.TransactionalEventListener
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit

/**
 * Best-effort, low-latency live sync of single-document mutations into OpenSearch.
 *
 * Listens to the real Spring application events emitted inside each document-mutation transaction and,
 * **after commit**, reloads the document by id and upserts it (or deletes it) in OpenSearch on a managed
 * single-thread daemon executor. Every task is fully isolated: a failure (e.g. OpenSearch unreachable) is
 * logged and swallowed so it can never fail or roll back the originating business transaction. Missed
 * writes are repaired by [com.ritense.document.opensearch.service.DocumentOpenSearchReconcileService];
 * this listener is only about freshness.
 *
 * Status/tags changes and bulk deletes have no dedicated live event and are handled by the reconciler
 * (upserts) and the pending-index-deletion drain (deletes) respectively.
 */
class DocumentOpenSearchEventListener(
    private val syncService: DocumentOpenSearchSyncService,
) : DisposableBean {

    private val executor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "opensearch-live-sync").apply { isDaemon = true }
    }

    @TransactionalEventListener(phase = AFTER_COMMIT)
    fun onCreated(event: JsonSchemaDocumentCreatedEvent) = enqueueUpsert(event.documentId().id)

    @TransactionalEventListener(phase = AFTER_COMMIT)
    fun onModified(event: JsonSchemaDocumentModifiedEvent) = enqueueUpsert(event.documentId().id)

    @TransactionalEventListener(phase = AFTER_COMMIT)
    fun onAssigneeChanged(event: DocumentAssigneeChangedEvent) = enqueueUpsert(event.documentId)

    @TransactionalEventListener(phase = AFTER_COMMIT)
    fun onUnassigned(event: DocumentUnassignedEvent) = enqueueUpsert(event.documentId)

    @TransactionalEventListener(phase = AFTER_COMMIT)
    fun onRetentionSet(event: DocumentRetentionPeriodSetEvent) = enqueueUpsert(event.getDocumentId())

    @TransactionalEventListener(phase = AFTER_COMMIT)
    fun onRetentionUnset(event: DocumentRetentionPeriodUnsetEvent) = enqueueUpsert(event.getDocumentId())

    @TransactionalEventListener(phase = AFTER_COMMIT)
    fun onRelatedFileAdded(event: DocumentRelatedFileAddedEvent) = enqueueUpsert(event.documentId)

    @TransactionalEventListener(phase = AFTER_COMMIT)
    fun onRelatedFileRemoved(event: DocumentRelatedFileRemovedEvent) = enqueueUpsert(event.documentId)

    @TransactionalEventListener(phase = AFTER_COMMIT)
    fun onDeleted(event: DocumentDeletedEvent) = enqueueDelete(event.caseDocumentId)

    private fun enqueueUpsert(documentId: UUID) = submit { syncService.upsertById(documentId) }

    private fun enqueueDelete(documentId: UUID) = submit { syncService.delete(documentId) }

    private fun submit(task: () -> Unit) {
        try {
            executor.execute {
                try {
                    task()
                } catch (e: Exception) {
                    logger.warn(e) { "Live OpenSearch sync failed — the reconciler will repair the index on its next cycle" }
                }
            }
        } catch (e: RejectedExecutionException) {
            logger.warn(e) { "Live OpenSearch sync rejected (executor shutting down) — the reconciler will repair the index" }
        }
    }

    override fun destroy() {
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
        private const val SHUTDOWN_TIMEOUT_SECONDS = 30L
    }
}
