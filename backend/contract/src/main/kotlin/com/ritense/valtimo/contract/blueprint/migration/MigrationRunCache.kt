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

package com.ritense.valtimo.contract.blueprint.migration

/** Memoizes values constant for a whole run — a migration, or the composition of a plan — that were being recomputed per instance or per entry. Thread-confined, and safe because everything memoized is deployment-time configuration. */
class MigrationRunCache {

    private class Scope {
        val values = HashMap<Any, Any>()

        /** Open scopes on this thread, so a nested caller cannot close a scope it did not open. */
        var depth = 0
    }

    companion object {
        private val scopeThreadLocal = ThreadLocal<Scope?>()

        /** Run [block] with a cache open for its duration, always removing the thread-local on the way out — runs execute on pooled request threads. */
        @JvmStatic
        fun <T> inRun(block: () -> T): T {
            val scope = scopeThreadLocal.get() ?: Scope().also { scopeThreadLocal.set(it) }
            scope.depth++
            try {
                return block()
            } finally {
                scope.depth--
                if (scope.depth == 0) {
                    scopeThreadLocal.remove()
                }
            }
        }

        /** The memoized value for [key], computed on first ask. Outside a run this computes every time. [key] must be unique to the caller's question. */
        @JvmStatic
        @Suppress("UNCHECKED_CAST")
        fun <T : Any> computeIfAbsent(key: Any, compute: () -> T): T {
            val scope = scopeThreadLocal.get() ?: return compute()
            return scope.values.getOrPut(key) { compute() } as T
        }

        /** Whether a run scope is open on this thread. For tests. */
        @JvmStatic
        fun isInRun(): Boolean = scopeThreadLocal.get() != null
    }
}
