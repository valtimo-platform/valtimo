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
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class PluginPackageInspectorTest {

    private val inspector = PluginPackageInspector(ObjectMapper())

    @Test
    fun `reads both compatibility bounds from the root manifest`() {
        val zip = zip("manifest.json" to MANIFEST_BOTH_BOUNDS)

        val range = inspector.readCompatibilityRange(zip)

        assertThat(range).isNotNull
        assertThat(range!!.minGzacVersion).isEqualTo("12.0.0")
        assertThat(range.maxGzacVersion).isEqualTo("13.5.0")
    }

    @Test
    fun `reads a single bound`() {
        val zip = zip("manifest.json" to """{"pluginId":"x","version":"1.0.0","compatibility":{"minGzacVersion":"14.0.0"}}""")

        val range = inspector.readCompatibilityRange(zip)

        assertThat(range!!.minGzacVersion).isEqualTo("14.0.0")
        assertThat(range.maxGzacVersion).isNull()
    }

    @Test
    fun `returns null when there is no compatibility block`() {
        val zip = zip("manifest.json" to """{"pluginId":"x","version":"1.0.0"}""")

        assertThat(inspector.readCompatibilityRange(zip)).isNull()
    }

    @Test
    fun `returns null when the compatibility block has no bounds`() {
        val zip = zip("manifest.json" to """{"pluginId":"x","version":"1.0.0","compatibility":{}}""")

        assertThat(inspector.readCompatibilityRange(zip)).isNull()
    }

    @Test
    fun `returns null when the package has no manifest`() {
        val zip = zip("plugin.wasm" to "binary")

        assertThat(inspector.readCompatibilityRange(zip)).isNull()
    }

    @Test
    fun `returns null for a non-zip payload`() {
        assertThat(inspector.readCompatibilityRange("not a zip".toByteArray())).isNull()
    }

    @Test
    fun `prefers the root manifest over a nested one`() {
        val zip = zip(
            "frontend/manifest.json" to """{"compatibility":{"minGzacVersion":"99.0.0"}}""",
            "manifest.json" to MANIFEST_BOTH_BOUNDS,
        )

        val range = inspector.readCompatibilityRange(zip)

        assertThat(range!!.minGzacVersion).isEqualTo("12.0.0")
    }

    private fun zip(vararg entries: Pair<String, String>): ByteArray {
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { zos ->
            entries.forEach { (name, content) ->
                zos.putNextEntry(ZipEntry(name))
                zos.write(content.toByteArray())
                zos.closeEntry()
            }
        }
        return out.toByteArray()
    }

    private companion object {
        private const val MANIFEST_BOTH_BOUNDS =
            """{"pluginId":"x","version":"1.0.0","compatibility":{"minGzacVersion":"12.0.0","maxGzacVersion":"13.5.0"}}"""
    }
}
