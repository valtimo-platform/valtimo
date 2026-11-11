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
 * Tells the [DelegatingDocumentSearchService] when OpenSearch cannot list every case PostgreSQL holds, so search
 * falls back to PostgreSQL until it can:
 * - the topology is legacy or stale — the single legacy index still holds the data, or an active definition has
 *   no per-definition index yet (typically right after an upgrade, before the migrate reindex);
 * - the reconciler lags behind the newest change — for example while it backfills after OpenSearch is enabled;
 * - a definition has cases OpenSearch rejected — only that definition (and "All cases") falls back.
 *
 * The state is derived from OpenSearch and the database, so it is the same on every node and survives restarts.
 * It is cached for [CACHE_TTL_MS]; a sub-second delay before switching back is harmless.
 */
open class TopologyGate(
    private val indexInitializer: DocumentOpenSearchIndexInitializer,
    private val completeness: IndexCompletenessService,
    private val clock: () -> Long = System::currentTimeMillis,
) {

    @Volatile
    private var cached: Snapshot? = null

    @Volatile
    private var cachedAtMillis = 0L

    open fun isLegacyOrStale(): Boolean = snapshot().legacyOrStale

    open fun snapshot(): Snapshot {
        val now = clock()
        val current = cached
        if (current != null && now - cachedAtMillis < CACHE_TTL_MS) {
            return current
        }
        return Snapshot(
            legacyOrStale = indexInitializer.isLegacyOrStale(),
            catchingUp = completeness.isReconcileLagging(),
            rejectedDefinitions = completeness.rejectedDefinitionNames(),
        ).also {
            cached = it
            cachedAtMillis = now
        }
    }

    /** Whether a search over [definitionNames] (empty means every definition) must be answered by PostgreSQL. */
    open fun mustUseDatabase(definitionNames: Collection<String>): Boolean {
        val snapshot = snapshot()
        if (snapshot.legacyOrStale || snapshot.catchingUp) return true
        return if (definitionNames.isEmpty()) {
            snapshot.rejectedDefinitions.isNotEmpty()
        } else {
            definitionNames.any { it in snapshot.rejectedDefinitions }
        }
    }

    data class Snapshot(
        val legacyOrStale: Boolean,
        val catchingUp: Boolean,
        val rejectedDefinitions: Set<String>,
    )

    companion object {
        const val CACHE_TTL_MS = 1000L
    }
}
