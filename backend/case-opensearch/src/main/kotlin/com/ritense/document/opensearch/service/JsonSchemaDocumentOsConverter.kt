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
import org.springframework.data.elasticsearch.BulkFailureException
import org.springframework.data.elasticsearch.VersionConflictException

/**
 * Single, shared implementation of the [JsonSchemaDocument] → [JsonSchemaDocumentOsDocument] conversion
 * and of the poison-pill-isolated bulk indexing. Reused by the live event listener, the reconciler and
 * the admin re-index service so all three writers produce byte-identical OpenSearch documents and share
 * the same failure isolation.
 */
open class JsonSchemaDocumentOsConverter(
    private val objectMapper: ObjectMapper,
    private val openSearchRepository: JsonSchemaDocumentOpenSearchRepository,
) {

    /**
     * Converts a JPA [JsonSchemaDocument] to its OpenSearch read model. The lazy `internalStatus`
     * association (and the eager `caseTags`) must be initialised before calling this — either by an
     * ambient transaction or by an eager fetch — otherwise serialization sees a null status.
     */
    open fun toOsDocument(document: JsonSchemaDocument): JsonSchemaDocumentOsDocument {
        val tree = objectMapper.valueToTree<JsonNode>(document)
        return objectMapper.treeToValue(tree, JsonSchemaDocumentOsDocument::class.java)
            .copy(
                // Extract content text directly from the document's content, not from the serialized tree
                // (the tree may not include content if the getter isn't JavaBean-named).
                contentText = extractLeafValues(document.content().asJson()),
                // JPA optimistic-lock counter drives the OpenSearch external version; +1 keeps it ≥ 1.
                indexVersion = (document.version() ?: 0).toLong() + 1,
            )
    }

    /**
     * Indexes a single bulk chunk. On an item-level [BulkFailureException] only the documents that actually
     * failed are re-processed one-by-one (never the whole chunk). A version conflict (HTTP 409) is benign —
     * external versioning means the stored document is already at an equal-or-newer version, so it is
     * silently ignored rather than warned/counted (in the steady state the reconciler's re-sends are all
     * conflicts). Any other per-document failure is isolated and counted as a skip so one poison document
     * can never loop a run forever. Transport/connection errors are NOT caught here: they propagate so the
     * caller can react (mark the run FAILED, park the watermark, …).
     *
     * @return the number of documents skipped in this chunk
     */
    open fun indexChunk(chunk: List<JsonSchemaDocumentOsDocument>): Long =
        try {
            openSearchRepository.saveAll(chunk)
            0L
        } catch (e: BulkFailureException) {
            val byId = chunk.associateBy { it.id }
            var skipped = 0L
            e.failedDocuments.forEach { (id, details) ->
                if (isVersionConflict(details)) return@forEach // benign: stored doc already ≥ this version
                val document = byId[id] ?: return@forEach
                try {
                    openSearchRepository.save(document)
                } catch (ex: VersionConflictException) {
                    // benign: a newer/equal version won the race and is already indexed
                } catch (ex: Exception) {
                    skipped++
                    logger.warn(ex) { "Failed to index document $id — skipping" }
                }
            }
            skipped
        }

    companion object {
        private val logger = KotlinLogging.logger {}

        /** OpenSearch bulk payload size, decoupled from any DB page size. */
        const val BULK_CHUNK_SIZE = 500

        /**
         * A bulk item failure that is an OpenSearch external-version conflict: HTTP 409, or the engine's
         * `version_conflict_engine_exception` in the message as a fallback. These are expected under
         * external versioning and must not be warned or counted as skips.
         */
        private fun isVersionConflict(details: BulkFailureException.FailureDetails): Boolean =
            details.status() == 409 ||
                details.errorMessage()?.contains("version_conflict_engine_exception") == true
    }
}
