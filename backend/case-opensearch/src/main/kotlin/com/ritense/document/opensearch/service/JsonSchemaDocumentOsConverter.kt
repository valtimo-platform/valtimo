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
import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.data.client.orhlc.NativeSearchQueryBuilder
import org.opensearch.index.query.QueryBuilders
import org.springframework.data.domain.PageRequest
import org.springframework.data.elasticsearch.BulkFailureException
import org.springframework.data.elasticsearch.VersionConflictException
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import java.util.UUID

/**
 * Single, shared implementation of the [JsonSchemaDocument] → [JsonSchemaDocumentOsDocument] conversion
 * and of the poison-pill-isolated bulk indexing. Reused by the live event listener, the reconciler and
 * the admin re-index service so all three writers produce byte-identical OpenSearch documents and share
 * the same failure isolation.
 *
 * Writes are routed to the index of each document's own definition and version. A case OpenSearch refuses is
 * recorded with [IndexCompletenessService], which sends that definition's case lists to PostgreSQL until the
 * case is indexed.
 */
open class JsonSchemaDocumentOsConverter(
    private val objectMapper: ObjectMapper,
    private val operations: ElasticsearchOperations,
    private val resolver: OpenSearchIndexNameResolver,
    private val indexInitializer: DocumentOpenSearchIndexInitializer,
    private val completeness: IndexCompletenessService,
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

    /** [toOsDocument], recording the case as rejected when it cannot be converted. */
    open fun convertOrReject(document: JsonSchemaDocument): JsonSchemaDocumentOsDocument? =
        try {
            toOsDocument(document)
        } catch (e: Exception) {
            logger.warn(e) { "Failed to convert document ${document.id().id} — skipping" }
            indexInitializer.recordWriteFailure()
            completeness.recordRejected(mapOf(document.id().id to document.definitionId().name()))
            null
        }

    /**
     * Indexes a single bulk chunk. On an item-level [BulkFailureException] only the documents that actually
     * failed are re-processed one-by-one (never the whole chunk). A version conflict (HTTP 409) is benign —
     * external versioning means the stored document is already at an equal-or-newer version, so it is
     * silently ignored rather than warned/counted (in the steady state the reconciler's re-sends are all
     * conflicts). Any other per-document failure is isolated, counted as a skip and recorded as rejected, so one
     * poison document can never loop a run forever. Transport/connection errors are NOT caught here: they
     * propagate so the caller can react (mark the run FAILED, park the watermark, …).
     *
     * When [overrideIndex] is set every document is written to that one index instead of being routed by its
     * own definition — used by a scoped rebuild to fill a fresh concrete index before the alias is swapped
     * onto it.
     *
     * @return the number of documents skipped in this chunk
     */
    open fun indexChunk(chunk: List<JsonSchemaDocumentOsDocument>, overrideIndex: IndexCoordinates? = null): Long {
        if (overrideIndex != null) {
            return store(overrideIndex, chunk, removeOtherCopies = false)
        }
        return chunk.groupBy { it.definitionId?.name to it.definitionId?.blueprintId?.blueprintVersionTag }
            .entries
            .sumOf { (nameAndTag, documents) -> indexGroup(nameAndTag.first, nameAndTag.second, documents) }
    }

    /**
     * Truncates string leaves inside `content` objects. Those leaves are `flat_object` terms, which Lucene rejects
     * above 32 KB together with the whole document; the top-level text fields have no such limit.
     */
    open fun indexable(document: JsonSchemaDocumentOsDocument): JsonSchemaDocumentOsDocument {
        val content = document.content ?: return document
        if (content.values.none { it is Map<*, *> || it is List<*> }) return document
        return document.copy(content = content.mapValues { (_, value) -> if (value is Map<*, *> || value is List<*>) boundLeaves(value) else value })
    }

    private fun indexGroup(
        definitionName: String?,
        versionTag: String?,
        documents: List<JsonSchemaDocumentOsDocument>,
    ): Long {
        if (definitionName == null || versionTag == null) {
            documents.forEach {
                logger.warn { "Document ${it.id} has no definition name/version — skipping (cannot resolve index)" }
            }
            return documents.size.toLong()
        }
        try {
            // Provision first: a write to a missing alias auto-creates a bare, unmapped index (auto_create_index).
            indexInitializer.ensureIndex(definitionName, versionTag)
        } catch (e: Exception) {
            if (isTransportFailure(e)) throw e
            logger.error(e) {
                "Could not create the OpenSearch index for definition '$definitionName' version '$versionTag' — " +
                    "skipping ${documents.size} document(s). If the cluster reports 'maximum shards open', raise " +
                    "cluster.max_shards_per_node or remove unused indices"
            }
            reject(documents)
            return documents.size.toLong()
        }
        return store(IndexCoordinates.of(resolver.writeAliasFor(definitionName, versionTag)), documents, removeOtherCopies = true)
    }

    private fun store(index: IndexCoordinates, chunk: List<JsonSchemaDocumentOsDocument>, removeOtherCopies: Boolean): Long {
        val result = saveIsolated(index, chunk.map(::indexable))
        // A case whose definition or version changed still has a copy in its previous index.
        if (removeOtherCopies) removeCopiesOutside(index.indexName, result.written)
        completeness.clearRejected((result.written + result.alreadyCurrent).mapNotNull(::toUuidOrNull))
        reject(result.rejected)
        return result.rejected.size.toLong()
    }

    private fun saveIsolated(index: IndexCoordinates, documents: List<JsonSchemaDocumentOsDocument>): SaveResult {
        val ids = documents.map { it.id }
        try {
            operations.save(documents, index)
            return SaveResult(written = ids, alreadyCurrent = emptyList(), rejected = emptyList())
        } catch (e: BulkFailureException) {
            val byId = documents.associateBy { it.id }
            val alreadyCurrent = e.failedDocuments.filterValues(::isVersionConflict).keys.toMutableList()
            val written = ids.filter { it !in e.failedDocuments.keys }.toMutableList()
            val rejected = mutableListOf<JsonSchemaDocumentOsDocument>()
            e.failedDocuments.keys.filter { it !in alreadyCurrent }.forEach { id ->
                val document = byId[id] ?: return@forEach
                try {
                    operations.save(document, index)
                    written += id
                } catch (ex: VersionConflictException) {
                    alreadyCurrent += id
                } catch (ex: Exception) {
                    if (isTransportFailure(ex)) throw ex
                    rejected += document
                    logger.warn(ex) { "Failed to index document $id — skipping" }
                }
            }
            return SaveResult(written, alreadyCurrent, rejected)
        }
    }

    private fun removeCopiesOutside(writeAlias: String, ids: List<String>) {
        if (ids.isEmpty()) return
        val query = NativeSearchQueryBuilder()
            .withQuery(QueryBuilders.idsQuery().addIds(*ids.toTypedArray()))
            .withPageable(PageRequest.of(0, ids.size * MAX_COPIES_PER_DOCUMENT))
            .build()
        operations.search(query, JsonSchemaDocumentOsDocument::class.java, IndexCoordinates.of(OpenSearchIndexNameResolver.READ_ALIAS))
            .searchHits
            .mapNotNull { hit ->
                val definitionId = hit.content.definitionId
                val name = definitionId?.name ?: return@mapNotNull null
                val tag = definitionId.blueprintId?.blueprintVersionTag ?: return@mapNotNull null
                (hit.content.id to resolver.writeAliasFor(name, tag)).takeIf { it.second != writeAlias }
            }
            .forEach { (id, staleAlias) ->
                operations.delete(id, IndexCoordinates.of(staleAlias))
                logger.debug { "Removed the copy of document $id from '$staleAlias' after it moved to '$writeAlias'" }
            }
    }

    private fun reject(documents: List<JsonSchemaDocumentOsDocument>) {
        if (documents.isEmpty()) return
        indexInitializer.recordWriteFailure()
        completeness.recordRejected(
            documents.mapNotNull { document ->
                val id = toUuidOrNull(document.id) ?: return@mapNotNull null
                val name = document.definitionId?.name ?: return@mapNotNull null
                id to name
            }.toMap()
        )
    }

    private fun boundLeaves(value: Any?): Any? = when (value) {
        is String -> truncateUtf8(value, MAX_OBJECT_LEAF_BYTES)
        is Map<*, *> -> value.mapValues { boundLeaves(it.value) }
        is List<*> -> value.map { boundLeaves(it) }
        else -> value
    }

    private fun truncateUtf8(value: String, maxBytes: Int): String {
        if (value.length * MAX_UTF8_BYTES_PER_CHAR <= maxBytes) return value
        val bytes = value.toByteArray(Charsets.UTF_8)
        if (bytes.size <= maxBytes) return value
        var end = maxBytes
        while (end > 0 && (bytes[end].toInt() and UTF8_CONTINUATION_MASK) == UTF8_CONTINUATION_BYTE) end--
        return String(bytes, 0, end, Charsets.UTF_8)
    }

    private fun toUuidOrNull(id: String): UUID? = runCatching { UUID.fromString(id) }.getOrNull()

    private data class SaveResult(
        val written: List<String>,
        val alreadyCurrent: List<String>,
        val rejected: List<JsonSchemaDocumentOsDocument>,
    )

    companion object {
        private val logger = KotlinLogging.logger {}

        /** OpenSearch bulk payload size, decoupled from any DB page size. */
        const val BULK_CHUNK_SIZE = 500

        // Half of Lucene's 32766-byte term limit; the flat_object term also carries the leaf's path.
        private const val MAX_OBJECT_LEAF_BYTES = 16_384
        private const val MAX_UTF8_BYTES_PER_CHAR = 3
        private const val UTF8_CONTINUATION_MASK = 0xC0
        private const val UTF8_CONTINUATION_BYTE = 0x80

        // Current copy plus copies left behind by earlier definition or version changes.
        private const val MAX_COPIES_PER_DOCUMENT = 4

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
