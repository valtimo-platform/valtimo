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

import com.ritense.document.opensearch.domain.PendingIndexDeletion
import com.ritense.document.opensearch.repository.PendingIndexDeletionRepository
import com.ritense.valtimo.contract.event.DocumentDeletedEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.event.EventListener

/**
 * Records a durable pending index deletion for every deleted document.
 *
 * Deliberately a **synchronous, in-transaction** [EventListener] (not `@TransactionalEventListener`): the
 * [DocumentDeletedEvent] is published inside the deleting transaction, so the pending-deletion row commits
 * atomically with the delete. This is what guarantees deletes survive an OpenSearch outage — the
 * reconciler drains the pending deletion once OpenSearch is reachable again. The best-effort AFTER_COMMIT
 * delete in [DocumentOpenSearchEventListener] still runs for freshness; this listener is the durability
 * backstop.
 */
open class PendingIndexDeletionListener(
    private val pendingIndexDeletionRepository: PendingIndexDeletionRepository,
) {

    @EventListener
    open fun onDocumentDeleted(event: DocumentDeletedEvent) {
        pendingIndexDeletionRepository.save(PendingIndexDeletion(documentId = event.caseDocumentId))
        logger.debug { "Recorded pending index deletion for document ${event.caseDocumentId}" }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
