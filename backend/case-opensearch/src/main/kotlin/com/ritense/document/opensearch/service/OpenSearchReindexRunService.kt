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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.document.opensearch.OpenSearchProperties
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.opensearch.domain.OpenSearchReindexRun
import com.ritense.document.opensearch.domain.ReindexRunStatus
import com.ritense.document.opensearch.repository.OpenSearchReindexRunRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.persistence.EntityManager
import jakarta.persistence.criteria.Predicate
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.LocalDateTime
import java.util.UUID

/**
 * Thin transactional wrapper around [OpenSearchReindexRunRepository] for managing re-index run state.
 *
 * Each mutation runs in its own (short-lived) transaction, independent of the read-only document-fetch
 * transactions in [DocumentOpenSearchReindexService], so progress and status are committed and visible
 * across instances as the run proceeds.
 */
@Transactional
open class OpenSearchReindexRunService(
    private val repository: OpenSearchReindexRunRepository,
    private val objectMapper: ObjectMapper,
    private val properties: OpenSearchProperties,
    private val entityManager: EntityManager,
) {

    /**
     * On startup, reconcile any [ReindexRunStatus.RUNNING] row whose heartbeat has gone stale (older than
     * [OpenSearchProperties.Reindex.runningHeartbeatTimeout]): the instance that owned it has crashed or
     * restarted and can no longer be advancing it. Mark them FAILED (resumable from their cursor). Runs still
     * being advanced by a live instance keep a fresh heartbeat and are left untouched, so this is cluster-safe.
     */
    @EventListener(ApplicationReadyEvent::class)
    open fun reconcileOrphanedRuns() {
        val staleBefore = LocalDateTime.now().minus(properties.reindex.runningHeartbeatTimeout)
        val orphaned = repository.findAllByStatusAndHeartbeatOnBefore(ReindexRunStatus.RUNNING, staleBefore)
        if (orphaned.isEmpty()) return
        val now = LocalDateTime.now()
        orphaned.forEach { it.fail(now, "Reconciled on startup: RUNNING run with a stale heartbeat") }
        repository.saveAll(orphaned)
        logger.warn { "Reconciled ${orphaned.size} orphaned RUNNING re-index run(s) with a stale heartbeat to FAILED" }
    }

    /**
     * Creates a fresh RUNNING run for [request], or — when [ReindexRequest.resumeRunId] is set —
     * re-arms that existing run so it continues from its persisted [OpenSearchReindexRun.lastId].
     */
    open fun startOrResume(request: ReindexRequest): OpenSearchReindexRun {
        request.resumeRunId?.let { resumeRunId ->
            val existing = repository.findById(resumeRunId).orElseThrow {
                IllegalArgumentException("No re-index run found for resumeRunId=$resumeRunId")
            }
            existing.resume(LocalDateTime.now())
            return repository.save(existing)
        }
        return repository.save(
            OpenSearchReindexRun(
                id = UUID.randomUUID(),
                status = ReindexRunStatus.RUNNING,
                scope = serializeScope(request),
                pageSize = request.effectivePageSize(),
                startedOn = LocalDateTime.now(),
                heartbeatOn = LocalDateTime.now(),
            )
        )
    }

    /**
     * Whether an admin (re)index run is currently in progress anywhere in the cluster. A [ReindexRunStatus.RUNNING]
     * row only counts while its heartbeat is fresher than [heartbeatTimeout], so a run left behind by a crashed
     * instance cannot report "running" forever. Used to temporarily route document search to PostgreSQL while the
     * index is being filled.
     */
    @Transactional(readOnly = true)
    open fun isReindexRunning(heartbeatTimeout: Duration): Boolean =
        repository.existsByStatusAndHeartbeatOnAfter(
            ReindexRunStatus.RUNNING,
            LocalDateTime.now().minus(heartbeatTimeout),
        )

    @Transactional(readOnly = true)
    open fun cursorOf(runId: UUID): UUID? = requireRun(runId).lastId

    @Transactional(readOnly = true)
    open fun processedOf(runId: UUID): Long = requireRun(runId).processedCount

    open fun recordProgress(runId: UUID, lastId: UUID?, processed: Long, skipped: Long) {
        val run = requireRun(runId)
        run.recordProgress(lastId, processed, skipped, LocalDateTime.now())
        repository.save(run)
    }

    open fun complete(runId: UUID) {
        val run = requireRun(runId)
        run.complete(LocalDateTime.now())
        repository.save(run)
    }

    open fun fail(runId: UUID, error: String?) {
        val run = requireRun(runId)
        run.fail(LocalDateTime.now(), error)
        repository.save(run)
    }

    open fun stop(runId: UUID) {
        val run = requireRun(runId)
        run.stop(LocalDateTime.now())
        repository.save(run)
    }

    open fun recordPruned(runId: UUID, pruned: Long) {
        val run = requireRun(runId)
        run.prunedCount = pruned
        repository.save(run)
    }

    /**
     * Status of a specific run (by [runId]) or — when null — of the most recent run. Returns a
     * not-running placeholder when no matching run exists.
     */
    @Transactional(readOnly = true)
    open fun toStatusMap(runId: UUID?): Map<String, Any?> {
        val run = (if (runId != null) repository.findById(runId).orElse(null)
        else repository.findFirstByOrderByStartedOnDesc())
            ?: return mapOf("running" to false, "runId" to null)
        return toMap(run)
    }

    @Transactional(readOnly = true)
    open fun listRuns(pageable: Pageable): Page<Map<String, Any?>> {
        val page = repository.findAllByOrderByStartedOnDesc(pageable)
        return PageImpl(page.content.map { toMap(it) }, pageable, page.totalElements)
    }

    private fun requireRun(runId: UUID): OpenSearchReindexRun =
        repository.findById(runId).orElseThrow { IllegalArgumentException("No re-index run found for runId=$runId") }

    private fun toMap(run: OpenSearchReindexRun): Map<String, Any?> {
        val elapsedSeconds = Duration.between(run.startedOn, run.finishedOn ?: LocalDateTime.now()).seconds
        val scope = deserializeScopeToRequest(run.scope)
        return mapOf(
            "runId" to run.id,
            "status" to run.status,
            "running" to (run.status == ReindexRunStatus.RUNNING),
            "scope" to scope?.let { objectMapper.convertValue(it, Map::class.java) },
            "pageSize" to run.pageSize,
            "lastId" to run.lastId,
            "processedCount" to run.processedCount,
            "skippedCount" to run.skippedCount,
            "prunedCount" to run.prunedCount,
            "totalCount" to countDocuments(scope),
            "startedOn" to run.startedOn,
            "heartbeatOn" to run.heartbeatOn,
            "finishedOn" to run.finishedOn,
            "elapsedSeconds" to elapsedSeconds,
            "error" to run.error,
        )
    }

    private fun serializeScope(request: ReindexRequest): String? =
        try {
            objectMapper.writeValueAsString(request)
        } catch (e: Exception) {
            logger.warn(e) { "Failed to serialize re-index scope — storing null" }
            null
        }

    private fun deserializeScopeToRequest(scope: String?): ReindexRequest? =
        scope?.let {
            try {
                objectMapper.readValue(it, ReindexRequest::class.java)
            } catch (e: Exception) {
                logger.warn(e) { "Failed to deserialize scope to ReindexRequest" }
                null
            }
        }

    private fun countDocuments(scope: ReindexRequest?): Long {
        val cb = entityManager.criteriaBuilder
        val query = cb.createQuery(Long::class.java)
        val root = query.from(JsonSchemaDocument::class.java)
        query.select(cb.count(root))

        val predicates = mutableListOf<Predicate>()
        scope?.modifiedAfter?.let { predicates += cb.greaterThan(root.get("modifiedOn"), it) }
        scope?.modifiedBefore?.let { predicates += cb.lessThan(root.get("modifiedOn"), it) }
        scope?.documentDefinitionName?.let {
            predicates += cb.equal(root.get<Any>("documentDefinitionId").get<String>("name"), it)
        }
        scope?.documentIds?.takeIf { it.isNotEmpty() }?.let {
            predicates += root.get<Any>("id").get<UUID>("id").`in`(it)
        }

        if (predicates.isNotEmpty()) {
            query.where(*predicates.toTypedArray())
        }
        return entityManager.createQuery(query).singleResult
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
