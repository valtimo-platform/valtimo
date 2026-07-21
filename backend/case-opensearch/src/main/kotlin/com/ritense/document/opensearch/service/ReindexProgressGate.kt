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

import com.ritense.document.opensearch.OpenSearchProperties

/**
 * Tells the [DelegatingDocumentSearchService] whether an admin (re)index run is currently filling the
 * index, in which case search should temporarily fall back to PostgreSQL so users never query a
 * partially-filled index. The decision is derived from the cluster-shared reindex-run state, so every node
 * falls back regardless of which one runs the job, and search returns to OpenSearch automatically once all
 * runs finish.
 *
 * The result is cached for [CACHE_TTL_MS] to avoid a database round-trip on every search — a sub-second
 * delay before switching back to OpenSearch is harmless.
 */
open class ReindexProgressGate(
    private val reindexRunService: OpenSearchReindexRunService,
    private val properties: OpenSearchProperties,
    private val clock: () -> Long = System::currentTimeMillis,
) {

    @Volatile
    private var cachedResult = false

    @Volatile
    private var cachedAtMillis = 0L

    @Volatile
    private var initialized = false

    open fun isReindexInProgress(): Boolean {
        if (!properties.reindex.fallbackToPostgresWhileRunning) return false
        val now = clock()
        if (!initialized || now - cachedAtMillis >= CACHE_TTL_MS) {
            cachedResult = reindexRunService.isReindexRunning(properties.reindex.runningHeartbeatTimeout)
            cachedAtMillis = now
            initialized = true
        }
        return cachedResult
    }

    companion object {
        const val CACHE_TTL_MS = 1000L
    }
}
