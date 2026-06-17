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

import com.fasterxml.jackson.databind.ObjectMapper
import io.github.oshai.kotlinlogging.KotlinLogging
import java.io.ByteArrayInputStream
import java.util.zip.ZipInputStream

/**
 * The compatibility bounds declared under `compatibility` in a plugin's manifest. Either bound may
 * be absent; an entry with neither bound is reported as `null` by [PluginPackageInspector] since
 * there is then nothing to check.
 */
data class PluginCompatibilityRange(
    val minGzacVersion: String?,
    val maxGzacVersion: String?,
)

/**
 * Peeks at the `manifest.json` carried at the root of an uploaded plugin package (`.zip`) to read
 * its declared compatibility range *before* GZAC forwards the upload to the plugin host. This lets
 * the upload endpoint warn an operator that a plugin does not target this GZAC version while the
 * host stays the sole authority on full manifest validity.
 *
 * Resilient by intent: a missing manifest, a missing `compatibility` block, or any read/parse
 * failure yields `null` (no compatibility gate) rather than blocking the upload.
 */
class PluginPackageInspector(
    private val objectMapper: ObjectMapper,
) {

    fun readCompatibilityRange(zipBytes: ByteArray): PluginCompatibilityRange? {
        val manifestBytes = readManifestBytes(zipBytes) ?: return null
        return try {
            val manifest = objectMapper.readTree(manifestBytes)
            val compatibility = manifest.path("compatibility")
            if (!compatibility.isObject) return null
            val min = compatibility.get("minGzacVersion")?.asText()?.takeIf { it.isNotBlank() }
            val max = compatibility.get("maxGzacVersion")?.asText()?.takeIf { it.isNotBlank() }
            if (min == null && max == null) null else PluginCompatibilityRange(min, max)
        } catch (e: Exception) {
            logger.warn(e) { "Failed to parse manifest.json from uploaded plugin package" }
            null
        }
    }

    /**
     * Returns the bytes of the package's `manifest.json`. The pack tool and host both place it at
     * the zip root, so a root entry wins; a nested `manifest.json` is accepted as a fallback for
     * resilience. Reads are capped at [MAX_MANIFEST_BYTES] to bound memory on a hostile package.
     */
    private fun readManifestBytes(zipBytes: ByteArray): ByteArray? {
        return try {
            ZipInputStream(ByteArrayInputStream(zipBytes)).use { zip ->
                var fallback: ByteArray? = null
                var entry = zip.nextEntry
                while (entry != null) {
                    if (!entry.isDirectory && entry.name.substringAfterLast('/') == MANIFEST_FILE_NAME) {
                        val bytes = zip.readNBytes(MAX_MANIFEST_BYTES)
                        if (entry.name == MANIFEST_FILE_NAME) return bytes
                        if (fallback == null) fallback = bytes
                    }
                    zip.closeEntry()
                    entry = zip.nextEntry
                }
                fallback
            }
        } catch (e: Exception) {
            logger.warn(e) { "Failed to read uploaded plugin package as a zip" }
            null
        }
    }

    companion object {
        private const val MANIFEST_FILE_NAME = "manifest.json"
        private const val MAX_MANIFEST_BYTES = 1024 * 1024
        private val logger = KotlinLogging.logger {}
    }
}
