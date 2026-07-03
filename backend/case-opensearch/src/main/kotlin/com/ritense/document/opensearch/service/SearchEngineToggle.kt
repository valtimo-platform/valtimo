/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference

class SearchEngineToggle(default: Engine = Engine.OPENSEARCH) {

    enum class Engine { OPENSEARCH, POSTGRES }

    private val active = AtomicReference(default)
    private val fallbackActive = AtomicBoolean(false)
    private val lastWarningTime = AtomicLong(0)

    fun get(): Engine = active.get()

    fun set(engine: Engine) {
        active.set(engine)
    }

    /**
     * Master switch for every active OpenSearch call (reads, live-sync writes, reconcile, index creation).
     * Read live on each call site so flipping the engine at runtime — via
     * [com.ritense.document.opensearch.web.SearchEngineResource] — immediately (re)enables or disables all
     * OpenSearch traffic without a restart. Startup forces this to [Engine.POSTGRES] when OpenSearch is
     * disabled by configuration, so this single check also honours `valtimo.opensearch.enabled`.
     */
    fun isOpenSearchActive(): Boolean = active.get() == Engine.OPENSEARCH

    fun isFallbackActive(): Boolean = fallbackActive.get()

    fun activateFallback() {
        fallbackActive.set(true)
    }

    fun deactivateFallback() {
        fallbackActive.set(false)
        lastWarningTime.set(0)
    }

    fun shouldUsePostgres(): Boolean =
        get() == Engine.POSTGRES || (get() == Engine.OPENSEARCH && fallbackActive.get())

    fun shouldLogWarning(intervalMs: Long): Boolean {
        val now = System.currentTimeMillis()
        val last = lastWarningTime.get()
        if (now - last >= intervalMs) {
            return lastWarningTime.compareAndSet(last, now)
        }
        return false
    }
}
