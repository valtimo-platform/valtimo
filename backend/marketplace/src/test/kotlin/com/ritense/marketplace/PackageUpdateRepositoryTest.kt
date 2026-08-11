/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.marketplace

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path

class PackageUpdateRepositoryTest {

    @TempDir
    lateinit var repositoryDir: Path

    @Test
    fun `should read the manifest including the marketplace-specific fields`() {
        writeManifest(
            """
            [
              {
                "id": "freemarker",
                "type": "plugin",
                "name": "Freemarker",
                "description": "Generate templates with FreeMarker",
                "provider": "com.ritense.valtimoplugins",
                "projectUrl": "https://github.com/valtimo-platform/freemarker-plugin",
                "logo": "data:image/svg+xml;base64,AAAA",
                "releases": [
                  {
                    "version": "8.5.1",
                    "url": "freemarker-8.5.1.jar",
                    "date": "2026-07-08T14:22:11Z",
                    "requires": ">=13.34.0",
                    "sha512sum": "abc"
                  }
                ]
              }
            ]
            """.trimIndent()
        )

        val packages = repository().plugins

        assertEquals(1, packages.size)
        val pkg = packages["freemarker"] as PackageInfo
        assertEquals("Freemarker", pkg.name)
        assertEquals("plugin", pkg.type)
        assertEquals("data:image/svg+xml;base64,AAAA", pkg.logo)
        assertEquals("com.ritense.valtimoplugins", pkg.provider)
        assertEquals(">=13.34.0", pkg.releases.single().requires)
        // The release url is resolved against the repository base url.
        assertTrue(pkg.releases.single().url.endsWith("freemarker-8.5.1.jar"))
        assertNotNull(pkg.releases.single().date)
    }

    @Test
    fun `should serve the cached manifest until refreshed`() {
        writeManifest(MANIFEST_WITH_ONE_PACKAGE)
        val repository = repository()
        assertEquals(setOf("first"), repository.plugins.keys)

        writeManifest(MANIFEST_WITH_TWO_PACKAGES)

        // Reading the catalogue again must NOT go back to the repository: listing packages
        // walks every configured repository, so re-fetching per read made opening the
        // marketplace as slow as the slowest store.
        assertEquals(setOf("first"), repository.plugins.keys)

        repository.refresh()

        assertEquals(setOf("first", "second"), repository.plugins.keys)
    }

    @Test
    fun `should drop a package that disappeared from the manifest on refresh`() {
        writeManifest(MANIFEST_WITH_TWO_PACKAGES)
        val repository = repository()
        assertEquals(2, repository.plugins.size)

        writeManifest(MANIFEST_WITH_ONE_PACKAGE)
        repository.refresh()

        assertEquals(setOf("first"), repository.plugins.keys)
    }

    @Test
    fun `should yield no packages for an unreachable repository`() {
        // No packages.json written at all: a misconfigured or not-yet-populated store must
        // not fail the whole catalogue read.
        assertTrue(repository().plugins.isEmpty())
    }

    private fun repository() = PackageUpdateRepository("test", repositoryDir.toUri().toURL())

    private fun writeManifest(json: String) {
        Files.writeString(repositoryDir.resolve("packages.json"), json)
    }

    companion object {
        private val MANIFEST_WITH_ONE_PACKAGE = """
            [
              {"id": "first", "type": "plugin", "name": "First",
               "releases": [{"version": "1.0.0", "url": "first-1.0.0.jar",
                             "date": "2026-01-01T00:00:00Z", "requires": "*"}]}
            ]
        """.trimIndent()

        private val MANIFEST_WITH_TWO_PACKAGES = """
            [
              {"id": "first", "type": "plugin", "name": "First",
               "releases": [{"version": "1.0.0", "url": "first-1.0.0.jar",
                             "date": "2026-01-01T00:00:00Z", "requires": "*"}]},
              {"id": "second", "type": "case", "name": "Second",
               "releases": [{"version": "1.0.0", "url": "second-1.0.0.zip",
                             "date": "2026-01-01T00:00:00Z", "requires": "*"}]}
            ]
        """.trimIndent()
    }
}
