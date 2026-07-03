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

import com.ritense.authorization.AuthorizationContext
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.opensearch.repository.JsonSchemaDocumentOpenSearchRepository
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.elasticsearch.VersionConflictException
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID

/**
 * Reloads the current state of a document from PostgreSQL (the source of truth) and mirrors it into
 * OpenSearch. Callers pass only the document id; the document is (re)read here so a coalesced/late write
 * always reflects the latest committed state rather than a stale event payload.
 *
 * This service does not swallow OpenSearch failures — the caller (the best-effort live listener) is
 * responsible for isolating them. Any missed or failed write is repaired by the reconciler.
 */
open class DocumentOpenSearchSyncService(
    private val repository: JsonSchemaDocumentOpenSearchRepository,
    private val documentRepository: JsonSchemaDocumentRepository,
    private val converter: JsonSchemaDocumentOsConverter,
    transactionManager: PlatformTransactionManager,
) {

    // Read-only transaction so the lazy associations touched during conversion can be initialised.
    private val readOnlyTransactionTemplate = TransactionTemplate(transactionManager).apply { isReadOnly = true }

    /**
     * Reloads [documentId] and upserts it into OpenSearch. A document that no longer exists (already
     * deleted) is skipped — its removal is handled by [delete] / the pending-index-deletion drain.
     */
    open fun upsertById(documentId: UUID) {
        val osDocument = readOnlyTransactionTemplate.execute {
            AuthorizationContext.runWithoutAuthorization {
                documentRepository.findById(JsonSchemaDocumentId.existingId(documentId)).orElse(null)
            }?.let { converter.toOsDocument(it) }
        }
        if (osDocument == null) {
            logger.debug { "Document $documentId not found on reload — skipping upsert (likely deleted)" }
            return
        }
        try {
            repository.save(osDocument)
            logger.debug { "Upserted document $documentId in OpenSearch" }
        } catch (e: VersionConflictException) {
            // A newer/equal version is already indexed (the reconciler or a later event won the race).
            logger.debug { "Document $documentId already at newer version in OpenSearch — skipping live upsert" }
        }
    }

    open fun delete(documentId: UUID) {
        repository.deleteById(documentId.toString())
        logger.debug { "Deleted document $documentId from OpenSearch" }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
