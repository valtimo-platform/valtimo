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

/**
 * Warnings raised while migrating a single instance: things a [MigrationComponentExecutor] decided
 * not to do, which are not failures but which an operator reading "47 cases migrated" would want to
 * know about.
 *
 * The motivating case is `addBuildingBlock` skipping an entry because the owner has no process to
 * hijack. That is a legitimate runtime outcome (a closed case has nothing to take over), so it
 * cannot fail the case — but until now it was also completely invisible, and a plan that skipped
 * every one of its cases reported the same `COMPLETED` as one that did all its work.
 *
 * Collected on a thread-local rather than passed down through every executor signature, in the same
 * spirit as `AuthorizationContext`: a migration applies one instance at a time, synchronously, on
 * the caller's thread, and the whole nested tree of a case (its building blocks and theirs) runs on
 * that same thread — so everything raised between [clear] and [drain] belongs to exactly one case.
 * The alternative, threading a collector through `MigrationComponentExecutor.execute`, would change
 * a public extension point that implementations outside this repository also implement.
 *
 * Warnings survive a rollback, deliberately: they live in memory, not in the transaction, so a dry
 * run (which always rolls back — D10) reports its warnings just as a real run does. That is the
 * whole point — the dry run is where an author should find out that their plan would do nothing.
 */
class MigrationWarnings {

    companion object {
        private val warningsThreadLocal = ThreadLocal.withInitial { mutableListOf<String>() }

        /** Record [message] against the instance currently being migrated. */
        @JvmStatic
        fun warn(message: String) {
            warningsThreadLocal.get().add(message)
        }

        /** Discard anything collected so far. Called before an instance is migrated. */
        @JvmStatic
        fun clear() {
            warningsThreadLocal.remove()
        }

        /**
         * Everything collected since the last [clear], as one newline-separated block, or null when
         * nothing was raised. Clears the collection, so a warning is reported once.
         */
        @JvmStatic
        fun drain(): String? {
            val warnings = warningsThreadLocal.get().toList()
            warningsThreadLocal.remove()
            return warnings.takeIf { it.isNotEmpty() }?.joinToString("\n")
        }
    }
}
