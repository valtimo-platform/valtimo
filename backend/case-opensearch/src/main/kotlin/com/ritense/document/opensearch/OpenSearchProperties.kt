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

package com.ritense.document.opensearch

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.NestedConfigurationProperty
import java.time.Duration

@ConfigurationProperties(prefix = "valtimo.opensearch")
data class OpenSearchProperties(
    val enabled: Boolean = false,
    val healthCheckEnabled: Boolean = true,
    val healthCheckIntervalMs: Long = 30000,
    val fallbackWarningIntervalMs: Long = 300000,

    @NestedConfigurationProperty
    val reconcile: Reconcile = Reconcile(),

    @NestedConfigurationProperty
    val reindex: Reindex = Reindex(),
) {
    /**
     * Configuration for the self-healing reconciler that keeps the OpenSearch index in sync with
     * PostgreSQL as a derived read-model.
     *
     * @property enabled            whether the scheduled reconcile job runs at all.
     * @property interval           delay between the end of one reconcile cycle and the start of the next
     *                              (also bound directly by the job's `@Scheduled(fixedDelayString)`).
     * @property overlap            δ subtracted from the watermark each cycle to safely cover the
     *                              flush→commit boundary; re-indexes a small trailing window (idempotent).
     * @property pageSize             DB keyset page size for the incremental upsert scan.
     * @property pendingDeletionBatchSize number of pending index deletions drained per batch.
     */
    data class Reconcile(
        val enabled: Boolean = true,
        // Keep in sync with the @Scheduled(fixedDelayString) default in DocumentOpenSearchReconcileJob (PT2M).
        val interval: Duration = Duration.ofMinutes(2),
        val overlap: Duration = Duration.ofSeconds(10),
        val pageSize: Int = 5000,
        val pendingDeletionBatchSize: Int = 500,
    )

    /**
     * Behaviour while an admin (re)index run is filling the index.
     *
     * @property fallbackToPostgresWhileRunning while a reindex run is in progress, route document search
     *        to PostgreSQL so users never query a partially-filled index; search returns to OpenSearch
     *        automatically once all runs finish. Does not affect the reconciler (which keeps the index
     *        complete) — only the admin reindex.
     * @property runningHeartbeatTimeout a RUNNING run is only treated as in-progress while its heartbeat
     *        is fresher than this. Guards against a run left behind by a crashed instance pinning search
     *        to PostgreSQL indefinitely. Must exceed the longest expected gap between reindex batches.
     */
    data class Reindex(
        val fallbackToPostgresWhileRunning: Boolean = true,
        val runningHeartbeatTimeout: Duration = Duration.ofMinutes(5),
    )
}
