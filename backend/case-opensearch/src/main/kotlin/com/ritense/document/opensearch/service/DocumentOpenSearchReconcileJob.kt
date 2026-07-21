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

import org.springframework.scheduling.annotation.Scheduled
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Fires the reconcile cycle on a fixed delay. The [running] guard makes overlapping scheduled invocations
 * on this node a no-op; cross-node exclusivity is handled by the ShedLock inside the service. `fixedDelay`
 * (not `fixedRate`) so a slow cycle never queues up back-to-back runs.
 */
class DocumentOpenSearchReconcileJob(
    private val reconcileService: DocumentOpenSearchReconcileService,
    private val toggle: SearchEngineToggle,
) {
    private val running = AtomicBoolean(false)

    // The PT2M default must match OpenSearchProperties.Reconcile.interval; the live path owns freshness,
    // so this safety-net reconciler runs on a relaxed interval.
    @Scheduled(fixedDelayString = "\${valtimo.opensearch.reconcile.interval:PT2M}")
    fun reconcile() {
        // Engine off: skip this cycle without touching OpenSearch. The tick keeps firing cheaply and
        // resumes reconciling from the persisted watermark on the first cycle after the engine is re-enabled.
        if (!toggle.isOpenSearchActive()) return
        if (running.compareAndSet(false, true)) {
            try {
                reconcileService.reconcile()
            } finally {
                running.set(false)
            }
        }
    }
}
