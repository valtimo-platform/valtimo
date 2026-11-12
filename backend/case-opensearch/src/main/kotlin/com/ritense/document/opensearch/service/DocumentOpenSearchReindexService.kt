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
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.persistence.EntityManager
import jakarta.persistence.criteria.JoinType
import jakarta.persistence.criteria.Predicate
import net.javacrumbs.shedlock.core.LockConfiguration
import net.javacrumbs.shedlock.core.LockProvider
import org.springframework.beans.factory.DisposableBean
import org.opensearch.index.query.BoolQueryBuilder
import org.opensearch.index.query.QueryBuilders
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import org.opensearch.data.client.orhlc.NativeSearchQueryBuilder
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Re-runnable, scoped re-index of [JsonSchemaDocument] rows into the per-definition OpenSearch indices.
 *
 * - **Cluster-safe single runner**: a ShedLock named lock ([LOCK_NAME]) guarantees at most one run
 *   cluster-wide; a concurrent [start] returns `null` (→ HTTP 409).
 * - **Persisted, resumable state**: progress (cursor, counts, heartbeat) lives in the database via
 *   [OpenSearchReindexRunService]; a FAILED/STOPPED run can be resumed from its cursor with an
 *   idempotent upsert.
 * - **Scoped**: only documents matching the [ReindexRequest] filters are (re)indexed; the index stays
 *   complete and queryable throughout.
 * - **Recreate**: builds fresh indices and swaps them in only when nothing was skipped (see [prepareRebuild]).
 * - **Crash-safe refresh**: no global `refresh_interval` toggle — a single explicit refresh runs at
 *   successful completion.
 */
open class DocumentOpenSearchReindexService(
    private val entityManager: EntityManager,
    private val converter: JsonSchemaDocumentOsConverter,
    private val elasticsearchOperations: ElasticsearchOperations,
    private val transactionManager: PlatformTransactionManager,
    private val lockProvider: LockProvider,
    private val runService: OpenSearchReindexRunService,
    private val resolver: OpenSearchIndexNameResolver,
    private val indexInitializer: DocumentOpenSearchIndexInitializer,
    private val completeness: IndexCompletenessService,
) : DisposableBean {

    private val executor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "opensearch-reindex").apply { isDaemon = true }
    }

    @Volatile
    private var cancelRequested = false

    /**
     * Acquires the cluster-wide lock, creates (or resumes) a run record and dispatches the re-index on
     * the managed executor. Returns the run id, or `null` if a re-index is already running anywhere in
     * the cluster.
     */
    fun start(request: ReindexRequest): UUID? {
        require(!(request.recreateIndex && request.hasSubsetFilters())) {
            "recreateIndex cannot be combined with modifiedAfter, modifiedBefore or documentIds — " +
                "a filtered rebuild would replace the index with only the matching subset"
        }

        val lock = lockProvider.lock(
            LockConfiguration(Instant.now(), LOCK_NAME, LOCK_AT_MOST_FOR, Duration.ZERO)
        )
        if (lock.isEmpty) return null

        cancelRequested = false
        val run = try {
            runService.startOrResume(request)
        } catch (e: Exception) {
            lock.get().unlock()
            throw e
        }

        executor.execute {
            try {
                reindex(run.id)
            } catch (e: Exception) {
                logger.error(e) { "Re-index run ${run.id} terminated with error" }
            } finally {
                lock.get().unlock()
            }
        }
        return run.id
    }

    /**
     * Runs the chunked, resumable re-index loop for [runId].
     * Each DB page is read in its own short read-only transaction (keeping snapshots short) and the
     * persistence context is cleared after every page. Returns the number of documents processed.
     */
    open fun reindex(runId: UUID): Long {
        val scope = runService.scopeOf(runId)
        var lastId: UUID? = runService.cursorOf(runId)
        var processed: Long = runService.processedOf(runId)
        var skipped = runService.skippedOf(runId)
        val pageSize = runService.pageSizeOf(runId)
        val txTemplate = TransactionTemplate(transactionManager).apply { isReadOnly = true }

        // Lower bound for the post-swap catch-up: any document whose changedOn moved at/after this may have
        // taken a live write into the old index that the swap drops. The overlap absorbs node clock skew.
        val catchUpFrom = LocalDateTime.now().minus(CATCH_UP_OVERLAP)

        // Declared outside the try so the catch/cancel paths can drop an unpublished rebuild index.
        var rebuild: RebuildPlan? = null
        try {
            // Inside the try so a preparation failure (index create, definition query) marks the run FAILED
            // instead of leaving it stuck RUNNING until stale-run reconciliation.
            rebuild = prepareRebuild(scope)

            while (!cancelRequested) {
                val cursor = lastId
                val batch = txTemplate.execute {
                    fetchBatch(scope, cursor, pageSize).also { entityManager.clear() }
                } ?: break
                if (batch.isEmpty()) break

                val docs = batch.mapNotNull { jpaDoc -> converter.convertOrReject(jpaDoc).also { if (it == null) skipped++ } }
                val plan = rebuild
                skipped += if (plan != null) {
                    // Recreate: route each document to the fresh concrete index of its own definition and version.
                    docs.groupBy { it.definitionId?.name to it.definitionId?.blueprintId?.blueprintVersionTag }
                        .entries.sumOf { (nameAndTag, group) ->
                            val concrete = rebuildConcreteFor(plan, nameAndTag.first, nameAndTag.second)
                            group.chunked(JsonSchemaDocumentOsConverter.BULK_CHUNK_SIZE)
                                .sumOf { converter.indexChunk(it, concrete?.let { c -> IndexCoordinates.of(c) }) }
                        }
                } else {
                    docs.chunked(JsonSchemaDocumentOsConverter.BULK_CHUNK_SIZE).sumOf { converter.indexChunk(it) }
                }

                processed += docs.size
                lastId = batch.last().id().id
                runService.recordProgress(runId, lastId, processed, skipped)
            }

            if (cancelRequested) {
                logger.info { "Re-index run $runId cancelled — marking STOPPED (processed=$processed, skipped=$skipped)" }
                // A cancelled rebuild never published its fresh indices — drop them so they do not leak.
                dropUnpublished(rebuild)
                runService.stop(runId)
            } else {
                refreshRebuildTargets(rebuild, scope)
                val notPublished = rebuild?.let { publishOrAbandonRebuild(it, skipped) }
                val published = rebuild != null && notPublished == null

                // The swap dropped the old indices; re-index anything changed during the rebuild so a concurrent
                // write to a dropped old index is not lost.
                val catchUp = if (published) {
                    catchUpConcurrentWrites(scope.documentDefinitionName, catchUpFrom, pageSize)
                } else {
                    CatchUpResult(0, null)
                }
                // A published rebuild may hold a case deleted while it ran (on any node): its copy was written
                // to the fresh index after the delete removed the live one.
                if (scope.pruneOrphans || published) {
                    val pruned = pruneOrphans(runId, scope)
                    logger.info { "Pruned $pruned orphan document(s) from OpenSearch" }
                }

                val totalSkipped = skipped + catchUp.skipped
                logger.info { "Re-index run $runId complete (processed=$processed, skipped=$totalSkipped)" }
                val error = listOfNotNull(notPublished, catchUp.error).joinToString(" ").ifEmpty { null }
                if (error != null) {
                    runService.completeWithErrors(runId, processed + totalSkipped, totalSkipped, error)
                } else {
                    runService.complete(runId, processed + totalSkipped, totalSkipped)
                }
            }
        } catch (e: Exception) {
            // A failed rebuild never published its fresh indices — drop them so they do not leak.
            dropUnpublished(rebuild)
            runService.fail(runId, e.message)
            logger.error(e) { "Re-index failed (run $runId)" }
            throw e
        }
        return processed
    }

    /**
     * Topology plan for a `recreateIndex` run: a fresh concrete index per (definition, version) in scope, filled
     * by the run and swapped in atomically on success. Unscoped, it covers every definition and also migrates off
     * the legacy single index. A non-recreate run returns `null` and writes through the live aliases.
     */
    private fun prepareRebuild(scope: ReindexRequest): RebuildPlan? {
        if (!scope.recreateIndex) return null
        indexInitializer.dropOrphanedIndices()
        val plan = RebuildPlan(scope.documentDefinitionName)
        // More versions may appear mid-run; they are created lazily.
        definitionVersionsFor(scope.documentDefinitionName).forEach { (name, tag) -> rebuildConcreteFor(plan, name, tag) }
        return plan
    }

    private fun rebuildConcreteFor(plan: RebuildPlan, definitionName: String?, versionTag: String?): String? {
        if (definitionName == null || versionTag == null) return null
        return plan.concretes.getOrPut(definitionName to versionTag) {
            indexInitializer.prepareRebuildIndex(definitionName, versionTag)
        }
    }

    /** Every (definition, version) with documents in PostgreSQL, plus the current version of each active definition. */
    private fun definitionVersionsFor(definitionName: String?): Set<Pair<String, String>> {
        val withDocuments = TransactionTemplate(transactionManager).apply { isReadOnly = true }.execute {
            entityManager.createQuery(
                "SELECT DISTINCT d.documentDefinitionId.name, d.documentDefinitionId.blueprintId.blueprintVersionTag " +
                    "FROM JsonSchemaDocument d" + if (definitionName != null) " WHERE d.documentDefinitionId.name = :name" else "",
                Array<Any>::class.java,
            ).apply { definitionName?.let { setParameter("name", it) } }
                .resultList
                .map { row -> row[0].toString() to row[1].toString() }
        }.orEmpty()
        val active = indexInitializer.activeDefinitionVersions().filter { definitionName == null || it.first == definitionName }
        return (withDocuments + active).toSet()
    }

    /**
     * Publishes a completed rebuild, or abandons it when documents were skipped: a skipped document is absent from
     * the fresh indices, so publishing them would hide it. Returns why it was not published, or `null`.
     */
    private fun publishOrAbandonRebuild(plan: RebuildPlan, skipped: Long): String? {
        if (skipped > 0L) {
            plan.concretes.values.forEach { indexInitializer.dropIndex(it) }
            val inUse = if (plan.definitionName == null && indexInitializer.isLegacyOrStale()) {
                "search keeps using PostgreSQL until the migration completes"
            } else {
                "the existing index stays in use"
            }
            logger.warn { "Rebuild skipped $skipped document(s) — not publishing the ${plan.concretes.size} rebuilt index(es); $inUse" }
            return "The rebuilt index was not published because $skipped document(s) could not be indexed; $inUse. " +
                "Resolve the skipped documents (see the application log) and run the reindex again."
        }
        plan.concretes.forEach { (nameAndTag, concrete) ->
            indexInitializer.swapInRebuiltIndex(nameAndTag.first, nameAndTag.second, concrete)
        }
        // The published indices now hold every document of the rebuilt scope (0 skips), so any rejection row within
        // that scope is stale. Rebuild writes leave rejections untouched (see converter), so clear them here.
        if (plan.definitionName == null) {
            indexInitializer.dropLegacyIndex()
            completeness.clearAllRejected()
        } else {
            completeness.clearRejectedByDefinition(plan.definitionName)
        }
        return null
    }

    private fun dropUnpublished(plan: RebuildPlan?) {
        plan?.concretes?.values?.forEach { runCatching { indexInitializer.dropIndex(it) } }
    }

    /** Refreshes the fresh concretes before the swap, or the read target of a non-recreate run. */
    private fun refreshRebuildTargets(plan: RebuildPlan?, scope: ReindexRequest) {
        val targets = plan?.concretes?.values?.map { IndexCoordinates.of(it) } ?: listOf(indexCoordinatesFor(scope))
        targets.forEach { elasticsearchOperations.indexOps(it).takeIf { io -> io.exists() }?.refresh() }
    }

    private class RebuildPlan(
        val definitionName: String?,
        val concretes: MutableMap<Pair<String, String>, String> = mutableMapOf(),
    )

    /**
     * Re-indexes what changed in scope since [from]: a live write during the rebuild went to an old index the swap
     * dropped. External versioning makes this race-free against concurrent live writes. A failure is reported,
     * not fatal — the rebuild is already published and the reconciler is the backstop.
     */
    private fun catchUpConcurrentWrites(definitionName: String?, from: LocalDateTime, pageSize: Int): CatchUpResult {
        val txTemplate = TransactionTemplate(transactionManager).apply { isReadOnly = true }
        var lastChangedOn: LocalDateTime? = null
        var lastId: UUID? = null
        var caughtUp = 0L
        var skipped = 0L
        val scopeLabel = definitionName?.let { "'$it'" } ?: "all definitions"
        try {
            while (!cancelRequested) {
                val cursorChangedOn = lastChangedOn
                val cursorId = lastId
                val page = txTemplate.execute {
                    val batch = fetchChangedSince(definitionName, from, cursorChangedOn, cursorId, pageSize)
                    if (batch.isEmpty()) {
                        null
                    } else {
                        val osDocuments = batch.mapNotNull { converter.convertOrReject(it) }
                        CatchUpPage(osDocuments, batch.size - osDocuments.size, batch.last().changedOn(), batch.last().id().id)
                            .also { entityManager.clear() }
                    }
                } ?: break

                skipped += page.convFailed
                skipped += page.osDocuments.chunked(JsonSchemaDocumentOsConverter.BULK_CHUNK_SIZE)
                    .sumOf { converter.indexChunk(it) }
                caughtUp += page.osDocuments.size
                lastChangedOn = page.lastChangedOn
                lastId = page.lastId
            }
            if (caughtUp > 0) {
                logger.info { "Re-indexed $caughtUp concurrently-changed document(s) into the rebuilt index of $scopeLabel" }
            }
            return CatchUpResult(skipped, null)
        } catch (e: Exception) {
            logger.warn(e) { "Catch-up after rebuilding $scopeLabel failed — the reconciler will repair any missed write" }
            return CatchUpResult(skipped, "Catch-up after rebuilding $scopeLabel failed: ${e.message}")
        }
    }

    private data class CatchUpResult(val skipped: Long, val error: String?)

    /** Keyset scan (by `changedOn`, then id) of the documents in scope changed at/after [from]. */
    private fun fetchChangedSince(
        definitionName: String?,
        from: LocalDateTime,
        lastChangedOn: LocalDateTime?,
        lastId: UUID?,
        pageSize: Int,
    ): List<JsonSchemaDocument> {
        val hasCursor = lastChangedOn != null && lastId != null
        val jpql = buildString {
            append("SELECT d FROM JsonSchemaDocument d LEFT JOIN FETCH d.internalStatus WHERE d.changedOn >= :from")
            if (definitionName != null) {
                append(" AND d.documentDefinitionId.name = :definitionName")
            }
            if (hasCursor) {
                append(" AND (d.changedOn > :lastChangedOn OR (d.changedOn = :lastChangedOn AND d.id.id > :lastId))")
            }
            append(" ORDER BY d.changedOn ASC, d.id.id ASC")
        }
        val query = entityManager.createQuery(jpql, JsonSchemaDocument::class.java)
        query.setParameter("from", from)
        definitionName?.let { query.setParameter("definitionName", it) }
        if (hasCursor) {
            query.setParameter("lastChangedOn", lastChangedOn)
            query.setParameter("lastId", lastId)
        }
        return query.setMaxResults(pageSize).resultList
    }

    private data class CatchUpPage(
        val osDocuments: List<JsonSchemaDocumentOsDocument>,
        val convFailed: Int,
        val lastChangedOn: LocalDateTime,
        val lastId: UUID,
    )

    /** Status of a specific run (by id) or the most recent run when [runId] is null. */
    fun status(runId: UUID? = null): Map<String, Any?> = runService.toStatusMap(runId)

    fun listRuns(pageable: Pageable): Page<Map<String, Any?>> = runService.listRuns(pageable)

    /**
     * Scoped keyset fetch. Applies the optional [scope] filters, eagerly loads the lazy `internalStatus`
     * `@ManyToOne` (C1 — so the detached entity serializes the real status key, not null), and keeps a
     * keyset cursor on the primary key for constant-cost pagination.
     */
    private fun fetchBatch(scope: ReindexRequest, lastId: UUID?, pageSize: Int): List<JsonSchemaDocument> {
        val cb = entityManager.criteriaBuilder
        val query = cb.createQuery(JsonSchemaDocument::class.java)
        val root = query.from(JsonSchemaDocument::class.java)
        root.fetch<Any, Any>("internalStatus", JoinType.LEFT)

        val predicates = mutableListOf<Predicate>()
        scope.modifiedAfter?.let { predicates += cb.greaterThan(root.get<LocalDateTime>("modifiedOn"), it) }
        scope.modifiedBefore?.let { predicates += cb.lessThan(root.get<LocalDateTime>("modifiedOn"), it) }
        scope.documentDefinitionName?.let {
            predicates += cb.equal(root.get<Any>("documentDefinitionId").get<String>("name"), it)
        }
        scope.documentIds?.takeIf { it.isNotEmpty() }?.let {
            predicates += root.get<Any>("id").get<UUID>("id").`in`(it)
        }
        lastId?.let { predicates += cb.greaterThan(root.get<Any>("id").get<UUID>("id"), it) }

        // Only restrict when there is at least one predicate; an empty where(...) matches no rows.
        if (predicates.isNotEmpty()) {
            query.where(*predicates.toTypedArray())
        }
        query.orderBy(cb.asc(root.get<Any>("id").get<UUID>("id")))
        return entityManager.createQuery(query).setMaxResults(pageSize).resultList
    }

    /**
     * Scans OpenSearch for documents matching [scope], checks each batch against PostgreSQL,
     * and deletes orphans (documents in OpenSearch but not in PostgreSQL).
     * Uses scroll API to handle datasets larger than 10k documents.
     */
    private fun pruneOrphans(runId: UUID, scope: ReindexRequest): Long {
        var pruned = 0L
        var checked = 0L
        val txTemplate = TransactionTemplate(transactionManager).apply { isReadOnly = true }

        val totalOsCount = countOpenSearchDocs(scope)
        runService.startPruning(runId, totalOsCount)

        scrollOpenSearchDocs(scope, PRUNE_BATCH_SIZE) { osDocs ->
            if (cancelRequested) return@scrollOpenSearchDocs false

            val existingIds = txTemplate.execute {
                findExistingIds(osDocs.mapNotNull { it.id.toUuidOrNull() })
            }.orEmpty()

            val orphans = osDocs.filter { it.id.toUuidOrNull() !in existingIds }
            orphans.forEach { deleteFromConcreteIndex(it) }
            pruned += orphans.size
            checked += osDocs.size

            runService.recordPruneProgress(runId, checked, pruned)
            true
        }
        return pruned
    }

    /** Deletes an orphan from its own per-(definition, version) index (resolved from the indexed document). */
    private fun deleteFromConcreteIndex(osDocument: JsonSchemaDocumentOsDocument) {
        val definitionName = osDocument.definitionId?.name
        val versionTag = osDocument.definitionId?.blueprintId?.blueprintVersionTag
        if (definitionName == null || versionTag == null) {
            logger.warn { "Orphan document ${osDocument.id} has no definition name/version — cannot resolve index to prune it" }
            return
        }
        elasticsearchOperations.delete(osDocument.id, IndexCoordinates.of(resolver.writeAliasFor(definitionName, versionTag)))
    }

    private fun String.toUuidOrNull(): UUID? = try {
        UUID.fromString(this)
    } catch (e: IllegalArgumentException) {
        null
    }

    /**
     * Resolves the OpenSearch index for a run: a scoped run (single definition) targets that definition's
     * index; an unscoped run targets the shared read alias spanning every per-definition index.
     */
    private fun indexCoordinatesFor(scope: ReindexRequest): IndexCoordinates =
        scope.documentDefinitionName
            ?.let { IndexCoordinates.of(resolver.indexNameFor(it)) }
            ?: IndexCoordinates.of(OpenSearchIndexNameResolver.READ_ALIAS)

    private fun countOpenSearchDocs(scope: ReindexRequest): Long {
        val boolQuery = BoolQueryBuilder()

        scope.documentDefinitionName?.let {
            boolQuery.filter(QueryBuilders.termQuery("definitionId.name", it))
        }
        scope.modifiedAfter?.let {
            boolQuery.filter(QueryBuilders.rangeQuery("modifiedOn").gt(it.format(OS_DATE_FORMAT)))
        }
        scope.modifiedBefore?.let {
            boolQuery.filter(QueryBuilders.rangeQuery("modifiedOn").lt(it.format(OS_DATE_FORMAT)))
        }
        scope.documentIds?.takeIf { it.isNotEmpty() }?.let { ids ->
            boolQuery.filter(QueryBuilders.idsQuery().addIds(*ids.map { it.toString() }.toTypedArray()))
        }

        val query = NativeSearchQueryBuilder()
            .withQuery(boolQuery)
            .build()

        return elasticsearchOperations.count(query, JsonSchemaDocumentOsDocument::class.java, indexCoordinatesFor(scope))
    }

    /**
     * Scrolls through all OpenSearch documents matching [scope], invoking [handler] for each batch.
     * Handler returns `true` to continue, `false` to stop early. The full document (not just its id) is
     * carried so an orphan delete can route to the document's own per-definition index.
     */
    private fun scrollOpenSearchDocs(
        scope: ReindexRequest,
        batchSize: Int,
        handler: (List<JsonSchemaDocumentOsDocument>) -> Boolean
    ) {
        val boolQuery = BoolQueryBuilder()

        scope.documentDefinitionName?.let {
            boolQuery.filter(QueryBuilders.termQuery("definitionId.name", it))
        }
        scope.modifiedAfter?.let {
            boolQuery.filter(QueryBuilders.rangeQuery("modifiedOn").gt(it.format(OS_DATE_FORMAT)))
        }
        scope.modifiedBefore?.let {
            boolQuery.filter(QueryBuilders.rangeQuery("modifiedOn").lt(it.format(OS_DATE_FORMAT)))
        }
        scope.documentIds?.takeIf { it.isNotEmpty() }?.let { ids ->
            boolQuery.filter(QueryBuilders.idsQuery().addIds(*ids.map { it.toString() }.toTypedArray()))
        }

        val query = NativeSearchQueryBuilder()
            .withQuery(boolQuery)
            .withPageable(PageRequest.of(0, batchSize))
            .build()

        elasticsearchOperations.searchForStream(query, JsonSchemaDocumentOsDocument::class.java, indexCoordinatesFor(scope)).use { stream ->
            val iterator = stream.iterator()
            val batch = mutableListOf<JsonSchemaDocumentOsDocument>()

            while (iterator.hasNext()) {
                val content = iterator.next().content ?: continue
                batch.add(content)
                if (batch.size >= batchSize) {
                    if (!handler(batch.toList())) return
                    batch.clear()
                }
            }
            if (batch.isNotEmpty()) {
                handler(batch)
            }
        }
    }

    private fun findExistingIds(ids: List<UUID>): Set<UUID> {
        if (ids.isEmpty()) return emptySet()
        return entityManager.createQuery(
            "SELECT d.id.id FROM JsonSchemaDocument d WHERE d.id.id IN :ids",
            UUID::class.java
        ).setParameter("ids", ids).resultList.toSet()
    }

    /** Signals an in-flight run to stop gracefully and shuts the executor down on context close. */
    override fun destroy() {
        cancelRequested = true
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
        private val OS_DATE_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSS")

        const val LOCK_NAME = "document-opensearch-reindex"

        /**
         * Generous lock lease. The persisted run-state heartbeat is the robust liveness signal; the lock
         * is only the cluster-wide mutex. A run exceeding this could in theory let a second runner start —
         * acceptable because all writes are idempotent upserts.
         */
        val LOCK_AT_MOST_FOR: Duration = Duration.ofHours(6)

        private const val SHUTDOWN_TIMEOUT_SECONDS = 30L
        private const val PRUNE_BATCH_SIZE = 1000

        /** Clock-skew margin on the post-swap catch-up lower bound. Over-inclusion is harmless (idempotent). */
        private val CATCH_UP_OVERLAP: Duration = Duration.ofSeconds(10)
    }
}
