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

package com.ritense.processlink.importer

/**
 * The window in which [ProcessLinkImporter] writes the links of one case definition and its `afterImport`
 * rechecks that case definition once. Narrower than "an import is running" on purpose: a global import, a
 * building block import or a redeployment has nothing taking over, so those events must keep their effect.
 */
internal object ProcessLinkImportScope {

    private val deferringRecheck = ThreadLocal.withInitial { false }

    fun isDeferringRecheck(): Boolean = deferringRecheck.get()

    fun <T> runDeferringRecheck(defer: Boolean, block: () -> T): T {
        if (!defer || isDeferringRecheck()) {
            return block()
        }
        return try {
            deferringRecheck.set(true)
            block()
        } finally {
            deferringRecheck.remove()
        }
    }
}
