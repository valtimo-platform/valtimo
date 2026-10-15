/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.importer

import java.util.concurrent.Callable

class ImportContext {

    companion object {
        private val importingThreadLocal = ThreadLocal.withInitial { false }

        private val claimedThreadLocal = ThreadLocal.withInitial { mutableSetOf<Any>() }

        private val caseDefinitionFilesThreadLocal = ThreadLocal.withInitial { emptyList<ZipFileEntry>() }

        @JvmStatic
        fun isImporting(): Boolean = importingThreadLocal.get()

        /**
         * True the first time [key] is claimed in this run. Lets a per-file hook do its wider work once.
         * Outside a run there is nothing to claim, so every call gets true.
         */
        @JvmStatic
        fun claimOncePerRun(key: Any): Boolean {
            return !isImporting() || claimedThreadLocal.get().add(key)
        }

        /** Every file of the case definition package this run is importing. Empty outside a run. */
        @JvmStatic
        fun caseDefinitionFiles(): List<ZipFileEntry> {
            return if (isImporting()) caseDefinitionFilesThreadLocal.get() else emptyList()
        }

        internal fun setCaseDefinitionFiles(files: List<ZipFileEntry>) {
            if (isImporting()) {
                caseDefinitionFilesThreadLocal.set(files.toList())
            }
        }

        @JvmStatic
        fun <T> runImporter(callable: Callable<T>): T {
            return if (isImporting()) {
                return callable.call()
            } else {
                try {
                    // No claim outlives its run, not even on a pooled thread
                    claimedThreadLocal.remove()
                    caseDefinitionFilesThreadLocal.remove()
                    importingThreadLocal.set(true)
                    callable.call()
                } finally {
                    importingThreadLocal.set(false)
                    claimedThreadLocal.remove()
                    caseDefinitionFilesThreadLocal.remove()
                }
            }
        }
    }
}