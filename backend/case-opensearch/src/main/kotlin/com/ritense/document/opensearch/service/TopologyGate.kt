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

/**
 * Tells the [DelegatingDocumentSearchService] whether the OpenSearch topology is legacy or stale — the single
 * legacy index still holds the data, or an active definition has no per-definition index yet. In that window
 * (typically right after an upgrade, before the migrate re-index has run) the per-definition indices OpenSearch
 * reads from do not yet hold the documents, so search must fall back to PostgreSQL to stay complete. Search
 * returns to OpenSearch automatically once the topology is healthy.
 *
 * The result is cached for [CACHE_TTL_MS] to avoid an OpenSearch round-trip on every search; a sub-second delay
 * before switching back is harmless.
 */
open class TopologyGate(
    private val indexInitializer: DocumentOpenSearchIndexInitializer,
    private val clock: () -> Long = System::currentTimeMillis,
) {

    @Volatile
    private var cachedResult = false

    @Volatile
    private var cachedAtMillis = 0L

    @Volatile
    private var initialized = false

    open fun isLegacyOrStale(): Boolean {
        val now = clock()
        if (!initialized || now - cachedAtMillis >= CACHE_TTL_MS) {
            cachedResult = indexInitializer.isLegacyOrStale()
            cachedAtMillis = now
            initialized = true
        }
        return cachedResult
    }

    companion object {
        const val CACHE_TTL_MS = 1000L
    }
}
