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
    private val operations: ElasticsearchOperations,
    private val resolver: OpenSearchIndexNameResolver,
    private val stateRepository: OpenSearchReconcileStateRepository,
    private val pendingIndexDeletionRepository: PendingIndexDeletionRepository,
    private val transactionManager: PlatformTransactionManager,
    private val lockProvider: LockProvider,
    private val properties: OpenSearchProperties,
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
            val watermark = currentWatermark()
            val from = watermark.minus(properties.reconcile.overlap)
            val maxSeen = processUpserts(from)
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
     * each page. Returns the highest `changed_on` seen (or [from] when nothing changed).
     */
    private fun processUpserts(from: LocalDateTime): LocalDateTime {
        // Advance the watermark only across fully-indexed pages. Once a page rejects/skips a document, stop
        // advancing so that document stays within the next cycle's scan window and is retried, instead of being
        // dropped silently behind the watermark.
        var cleanThrough = from
        var skippedTotal = 0L
        var sawSkip = false
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
                    ReconcilePage(osDocuments, batch.size - osDocuments.size, last.changedOn(), last.id().id)
                        .also { entityManager.clear() }
                }
            } ?: break

            val pageSkipped = page.convFailed + page.osDocuments.chunked(JsonSchemaDocumentOsConverter.BULK_CHUNK_SIZE)
                .sumOf { converter.indexChunk(it) }

            if (!sawSkip && pageSkipped == 0L) {
                if (page.lastChangedOn.isAfter(cleanThrough)) cleanThrough = page.lastChangedOn
            } else {
                sawSkip = true
                skippedTotal += pageSkipped
            }
            lastChangedOn = page.lastChangedOn
            lastId = page.lastId
        }
        if (sawSkip) {
            logger.warn {
                "Reconcile skipped $skippedTotal document(s) this cycle — holding the watermark at $cleanThrough " +
                    "so the rejected document(s) are retried next cycle"
            }
        }
        return cleanThrough
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
        // The id-resolution search below is near-real-time; refresh so a just-indexed document is visible and
        // cannot be orphaned when we drop its pending row. A post-refresh miss then truly means it is already gone.
        operations.indexOps(IndexCoordinates.of(OpenSearchIndexNameResolver.READ_ALIAS)).refresh()
        while (true) {
            val pendingDeletions = readTemplate.execute {
                pendingIndexDeletionRepository.findByOrderByDeletedOnAsc(PageRequest.of(0, batchSize))
            }.orEmpty()
            if (pendingDeletions.isEmpty()) break

            pendingDeletions.forEach { deleteFromConcreteIndex(it.documentId.toString()) }
            writeTemplate.execute { pendingIndexDeletionRepository.deleteAllById(pendingDeletions.map { it.documentId }) }
            logger.debug { "Drained ${pendingDeletions.size} pending index deletion(s) from OpenSearch" }
        }
    }

    /**
     * Resolves the concrete per-definition index for [id] by reading the indexed document through the shared
     * read alias, then deletes it there. A document that is already gone is a no-op.
     */
    private fun deleteFromConcreteIndex(id: String) {
        val query = NativeSearchQueryBuilder()
            .withQuery(QueryBuilders.idsQuery().addIds(id))
            .build()
        val hits = operations.search(
            query,
            JsonSchemaDocumentOsDocument::class.java,
            IndexCoordinates.of(OpenSearchIndexNameResolver.READ_ALIAS)
        )
        val definitionId = hits.searchHits.firstOrNull()?.content?.definitionId ?: return
        val definitionName = definitionId.name ?: return
        val versionTag = definitionId.blueprintId?.blueprintVersionTag ?: return
        // Delete from the version write alias (a single concrete); the per-definition read alias spans versions.
        operations.delete(id, IndexCoordinates.of(resolver.writeAliasFor(definitionName, versionTag)))
        // A scoped rebuild in flight holds a copy in its fresh (not-yet-published) index — delete it there too,
        // or draining this pending deletion before the swap leaves the copy to survive it.
        resolver.rebuildIndexFor(definitionName, versionTag)?.let { rebuildIndex ->
            operations.delete(id, IndexCoordinates.of(rebuildIndex))
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

    /** Runs the empty-version-index prune at most once per [OpenSearchProperties.Reconcile.pruneInterval]. */
    private fun pruneEmptyVersionIndicesIfDue() {
        if (!properties.reconcile.pruneEmptyVersionIndices) return
        val now = System.currentTimeMillis()
        if (now - lastPruneAtMillis < properties.reconcile.pruneInterval.toMillis()) return
        lastPruneAtMillis = now
        pruneEmptyVersionIndices()
    }

    /**
     * Drops per-(definition, version) concrete indices that hold no documents, grouping concretes by their per-key
     * read alias (read via get-alias, never parsing names). Never drops the last concrete of a key — so its read
     * alias and the global read alias survive, avoiding legacy/stale flapping — nor an in-flight rebuild target. A
     * later write of a pruned version re-creates its index lazily.
     */
    private fun pruneEmptyVersionIndices() {
        val readAlias = OpenSearchIndexNameResolver.READ_ALIAS
        val globalOps = operations.indexOps(IndexCoordinates.of(readAlias))
        if (!globalOps.exists()) return
        val concretes = globalOps.getAliasesForIndex(readAlias).keys
        if (concretes.isEmpty()) return

        // Group concretes by their per-key read alias: of each concrete's aliases, drop the global one and take the
        // shortest remaining (the version write alias is "<readAlias>_v<tag>", so it is always longer).
        val byKey = concretes.groupBy { concrete ->
            operations.indexOps(IndexCoordinates.of(concrete)).getAliasesForIndex(concrete)
                .values.flatten().map { it.alias }
                .filter { it != readAlias }
                .minByOrNull { it.length }
                ?: concrete
        }

        byKey.values.forEach { group ->
            val keep = group.filter { isNonEmptyOrRebuild(it) }
            val empty = group.filter { it !in keep }
            // Keep at least one concrete per key so the read aliases never disappear.
            val toDrop = if (keep.isNotEmpty()) empty else empty.drop(1)
            toDrop.forEach { concrete ->
                runCatching { operations.indexOps(IndexCoordinates.of(concrete)).delete() }
                    .onSuccess { logger.info { "Pruned empty OpenSearch version index '$concrete'" } }
                    .onFailure { logger.warn(it) { "Failed to prune empty OpenSearch version index '$concrete'" } }
            }
        }
    }

    private fun isNonEmptyOrRebuild(concrete: String): Boolean {
        if (resolver.isRebuildConcrete(concrete)) return true
        val query = NativeSearchQueryBuilder().withQuery(QueryBuilders.matchAllQuery()).build()
        return operations.count(query, JsonSchemaDocumentOsDocument::class.java, IndexCoordinates.of(concrete)) > 0
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

        /** Lock lease per cycle; a cycle should complete well within this. */
        val LOCK_AT_MOST_FOR: Duration = Duration.ofMinutes(10)
    }
}
