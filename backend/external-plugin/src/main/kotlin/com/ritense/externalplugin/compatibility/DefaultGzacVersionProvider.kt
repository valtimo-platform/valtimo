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

package com.ritense.externalplugin.compatibility

/**
 * Resolves the running GZAC version from, in order of precedence:
 *
 * 1. The `valtimo.external-plugin.gzac-version` property — an explicit operator override, useful in
 *    tests or when the build metadata is unavailable or wrong.
 * 2. The Valtimo library version (the `Implementation-Version` stamped on every Valtimo module's
 *    jar manifest). A plugin's `compatibility` range targets the Valtimo *platform*, so this is the
 *    canonical source: it is the same value the UI sidebar shows for the backend (read by
 *    `com.ritense.valtimo.web.rest.VersionResource` off a core-module class), and it stays correct
 *    even when Valtimo is embedded in a downstream application whose own build version differs.
 *
 * Returns `null` when neither resolves (e.g. a dev run from class directories with no jar manifest),
 * in which case compatibility cannot be judged.
 */
class DefaultGzacVersionProvider(
    private val versionOverride: String?,
    private val libraryVersion: String?,
) : GzacVersionProvider {

    override fun getCurrentVersion(): String? {
        versionOverride?.takeIf { it.isNotBlank() }?.let { return it }
        return libraryVersion?.takeIf { it.isNotBlank() }
    }
}
