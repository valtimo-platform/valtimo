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

import io.github.oshai.kotlinlogging.KotlinLogging
import org.semver4j.Semver
import java.util.concurrent.atomic.AtomicBoolean

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

    private val warned = AtomicBoolean(false)

    override fun getCurrentVersion(): String? {
        val resolved = versionOverride?.takeIf { it.isNotBlank() }
            ?: libraryVersion?.takeIf { it.isNotBlank() }

        // An unparseable version turns the compatibility gate off wholesale and every plugin then
        // reports as compatible, so say so. Once, not per check — the gate runs on every listing.
        if ((resolved == null || Semver.parse(resolved) == null) && warned.compareAndSet(false, true)) {
            logger.warn {
                "Could not determine a semver GZAC version (resolved: ${resolved ?: "none"}). External " +
                    "plugin compatibility ranges will not be enforced. Set the " +
                    "'valtimo.external-plugin.gzac-version' property to enable the check."
            }
        }

        return resolved
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
