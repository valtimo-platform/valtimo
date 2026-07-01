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
import com.ritense.document.opensearch.domain.OpenSearchReindexRun
import com.ritense.document.opensearch.domain.ReindexRunStatus
import com.ritense.document.opensearch.repository.OpenSearchReindexRunRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.transaction.annotation.Transactional
import java.net.InetAddress
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
) {

    /** Stable-per-process identity, used to claim run rows and reconcile this instance's orphans on boot. */
    val instanceId: String = "${hostName()}-${UUID.randomUUID()}"

    /**
     * On startup, any [ReindexRunStatus.RUNNING] row owned by *this* instance must be orphaned: this
     * instance just booted, so it cannot legitimately still be running an earlier job. Mark them FAILED
     * (resumable from their cursor).
     */
    @EventListener(ApplicationReadyEvent::class)
    open fun reconcileOrphanedRuns() {
        val orphaned = repository.findAllByStatusAndInstanceId(ReindexRunStatus.RUNNING, instanceId)
        if (orphaned.isEmpty()) return
        val now = LocalDateTime.now()
        orphaned.forEach { it.fail(now, "Reconciled on startup: instance restarted while run was RUNNING") }
        repository.saveAll(orphaned)
        logger.warn { "Reconciled ${orphaned.size} orphaned RUNNING re-index run(s) owned by $instanceId to FAILED" }
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
                instanceId = instanceId,
                scope = serializeScope(request),
                pageSize = request.effectivePageSize(),
                startedOn = LocalDateTime.now(),
                heartbeatOn = LocalDateTime.now(),
            )
        )
    }

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

    private fun requireRun(runId: UUID): OpenSearchReindexRun =
        repository.findById(runId).orElseThrow { IllegalArgumentException("No re-index run found for runId=$runId") }

    private fun toMap(run: OpenSearchReindexRun): Map<String, Any?> {
        val elapsedSeconds = Duration.between(run.startedOn, run.finishedOn ?: LocalDateTime.now()).seconds
        return mapOf(
            "runId" to run.id,
            "status" to run.status,
            "running" to (run.status == ReindexRunStatus.RUNNING),
            "instanceId" to run.instanceId,
            "scope" to deserializeScope(run.scope),
            "pageSize" to run.pageSize,
            "lastId" to run.lastId,
            "processedCount" to run.processedCount,
            "skippedCount" to run.skippedCount,
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

    private fun deserializeScope(scope: String?): Any? =
        scope?.let {
            try {
                objectMapper.readValue(it, Map::class.java)
            } catch (e: Exception) {
                it
            }
        }

    private fun hostName(): String =
        try {
            InetAddress.getLocalHost().hostName
        } catch (e: Exception) {
            "unknown-host"
        }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
