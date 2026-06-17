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

/**
 * Compares an external plugin's declared `compatibility` range (`minGzacVersion` / `maxGzacVersion`,
 * both optional and inclusive) against the running GZAC version from [GzacVersionProvider].
 *
 * The range is lenient by design: an absent or unparseable bound is simply not enforced, and an
 * undeterminable current version yields a compatible result. This matches the platform's
 * warn-don't-block policy — the goal is to surface a likely mismatch, never to hard-fail on noisy
 * version metadata.
 */
class GzacCompatibilityChecker(
    private val versionProvider: GzacVersionProvider,
) {

    fun check(minGzacVersion: String?, maxGzacVersion: String?): CompatibilityResult {
        val currentRaw = versionProvider.getCurrentVersion()
        val current = currentRaw?.let { parseOrNull(it) }

        if (current == null) {
            return CompatibilityResult(
                compatible = true,
                currentGzacVersion = currentRaw,
                minGzacVersion = minGzacVersion,
                maxGzacVersion = maxGzacVersion,
                status = CompatibilityStatus.CURRENT_VERSION_UNKNOWN,
            )
        }

        val min = minGzacVersion?.let { parseOrNull(it) }
        if (min != null && current.compareTo(min) < 0) {
            return result(currentRaw, minGzacVersion, maxGzacVersion, false, CompatibilityStatus.BELOW_MINIMUM)
        }

        val max = maxGzacVersion?.let { parseOrNull(it) }
        if (max != null && current.compareTo(max) > 0) {
            return result(currentRaw, minGzacVersion, maxGzacVersion, false, CompatibilityStatus.ABOVE_MAXIMUM)
        }

        return result(currentRaw, minGzacVersion, maxGzacVersion, true, CompatibilityStatus.COMPATIBLE)
    }

    private fun result(
        current: String?,
        min: String?,
        max: String?,
        compatible: Boolean,
        status: CompatibilityStatus,
    ) = CompatibilityResult(compatible, current, min, max, status)

    private fun parseOrNull(version: String): Semver? {
        return Semver.parse(version) ?: run {
            logger.debug { "Ignoring unparseable version '$version' in external plugin compatibility check" }
            null
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
