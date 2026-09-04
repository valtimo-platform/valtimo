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

/** Warnings raised while migrating one instance — things an executor decided not to do, which are not failures but which an operator reading "47 cases migrated" wants to know. Thread-local, and survives a rollback so a dry run reports them too. */
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

        /** Everything collected since the last [clear], newline-separated, or null. Clears the collection, so a warning is reported once. */
        @JvmStatic
        fun drain(): String? {
            val warnings = warningsThreadLocal.get().toList()
            warningsThreadLocal.remove()
            return warnings.takeIf { it.isNotEmpty() }?.joinToString("\n")
        }
    }
}
