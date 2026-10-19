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
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.data.client.orhlc.NativeSearchQueryBuilder
import org.opensearch.index.query.QueryBuilders
import org.springframework.data.elasticsearch.VersionConflictException
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
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
    private val operations: ElasticsearchOperations,
    private val documentRepository: JsonSchemaDocumentRepository,
    private val converter: JsonSchemaDocumentOsConverter,
    private val resolver: OpenSearchIndexNameResolver,
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
        val definitionName = osDocument.definitionId?.name
        if (definitionName == null) {
            logger.warn { "Document $documentId has no definition name — skipping upsert (cannot resolve index)" }
            return
        }
        try {
            operations.save(osDocument, IndexCoordinates.of(resolver.indexNameFor(definitionName)))
            logger.debug { "Upserted document $documentId in OpenSearch" }
        } catch (e: VersionConflictException) {
            // A newer/equal version is already indexed (the reconciler or a later event won the race).
            logger.debug { "Document $documentId already at newer version in OpenSearch — skipping live upsert" }
        }
    }

    /**
     * A delete only carries the document id. The indexed document itself carries its `definitionId.name`, so
     * we read it by id through the shared read alias, resolve its concrete per-definition index and delete
     * there — no delete-by-query fan-out. A document that is already gone is a no-op.
     */
    open fun delete(documentId: UUID) {
        val id = documentId.toString()
        val definitionName = findIndexedDefinitionName(id)
        if (definitionName == null) {
            logger.debug { "Document $documentId not found in OpenSearch — nothing to delete" }
            return
        }
        operations.delete(id, IndexCoordinates.of(resolver.indexNameFor(definitionName)))
        logger.debug { "Deleted document $documentId from OpenSearch" }
    }

    private fun findIndexedDefinitionName(id: String): String? {
        val query = NativeSearchQueryBuilder()
            .withQuery(QueryBuilders.idsQuery().addIds(id))
            .build()
        val hits = operations.search(
            query,
            JsonSchemaDocumentOsDocument::class.java,
            IndexCoordinates.of(OpenSearchIndexNameResolver.READ_ALIAS)
        )
        return hits.searchHits.firstOrNull()?.content?.definitionId?.name
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
