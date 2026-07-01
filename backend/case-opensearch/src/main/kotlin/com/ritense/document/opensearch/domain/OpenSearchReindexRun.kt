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

package com.ritense.document.opensearch.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime
import java.util.UUID

/**
 * Persisted record of a single OpenSearch re-index run.
 *
 * The state lives in the database (rather than in JVM memory) so that:
 * - status is consistent regardless of which clustered instance answers a query,
 * - progress survives a crash/redeploy ([lastId] is the resume cursor),
 * - an orphaned [ReindexRunStatus.RUNNING] row can be reconciled on startup.
 *
 * [scope] holds the serialized [com.ritense.document.opensearch.service.ReindexRequest] (JSON string)
 * for auditing/display only — it is never queried as JSON in the database.
 */
@Entity
@Table(name = "document_opensearch_reindex_run")
class OpenSearchReindexRun(

    @Id
    @Column(name = "id")
    val id: UUID = UUID.randomUUID(),

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    var status: ReindexRunStatus = ReindexRunStatus.RUNNING,

    @Column(name = "instance_id", nullable = false)
    val instanceId: String = "",

    @Column(name = "scope")
    val scope: String? = null,

    @Column(name = "page_size", nullable = false)
    val pageSize: Int = 0,

    @Column(name = "last_id")
    var lastId: UUID? = null,

    @Column(name = "processed_count", nullable = false)
    var processedCount: Long = 0,

    @Column(name = "skipped_count", nullable = false)
    var skippedCount: Long = 0,

    @Column(name = "started_on", nullable = false)
    val startedOn: LocalDateTime = LocalDateTime.now(),

    @Column(name = "heartbeat_on", nullable = false)
    var heartbeatOn: LocalDateTime = LocalDateTime.now(),

    @Column(name = "finished_on")
    var finishedOn: LocalDateTime? = null,

    @Column(name = "error")
    var error: String? = null,
) {

    /** Records progress after a committed batch: the keyset cursor, counts and a fresh heartbeat. */
    fun recordProgress(lastId: UUID?, processed: Long, skipped: Long, heartbeat: LocalDateTime) {
        this.lastId = lastId
        this.processedCount = processed
        this.skippedCount = skipped
        this.heartbeatOn = heartbeat
    }

    fun complete(now: LocalDateTime) {
        this.status = ReindexRunStatus.COMPLETED
        this.finishedOn = now
        this.heartbeatOn = now
    }

    fun fail(now: LocalDateTime, error: String?) {
        this.status = ReindexRunStatus.FAILED
        this.finishedOn = now
        this.heartbeatOn = now
        this.error = error
    }

    fun stop(now: LocalDateTime) {
        this.status = ReindexRunStatus.STOPPED
        this.finishedOn = now
        this.heartbeatOn = now
    }

    /** Re-arms a previously-finished (FAILED/STOPPED) run so it can be resumed from its cursor. */
    fun resume(now: LocalDateTime) {
        this.status = ReindexRunStatus.RUNNING
        this.finishedOn = null
        this.error = null
        this.heartbeatOn = now
    }
}
