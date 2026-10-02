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

package com.ritense.exporter

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.exporter.manifest.ArtifactDependency
import com.ritense.exporter.manifest.ArtifactManifestEntry
import com.ritense.exporter.manifest.ArtifactType
import com.ritense.exporter.manifest.DependencyType
import com.ritense.exporter.manifest.ExportManifest
import com.ritense.exporter.manifest.ResolvableValue
import com.ritense.exporter.manifest.ValtimoVersionResolver
import com.ritense.exporter.request.ExportRequest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.io.ByteArrayInputStream
import java.util.zip.ZipInputStream

class ValtimoExportServiceTest {

    private val objectMapper = jacksonObjectMapper()
    private val versionResolver = ValtimoVersionResolver { "13.1.3" }

    private val caseDefinitionPath = "config/case/bezwaar/1-0-0/case/definition/bezwaar.case-definition.json"
    private val buildingBlockPath =
        "config/building-block/address-lookup/1-0-0/building-block/definition/address-lookup.building-block-definition.json"

    @Test
    fun `should write an export manifest describing the root artifact and its dependencies`() {
        val service = service(
            ArtifactExporter(),
            PluginDependencyExporter(),
            BuildingBlockDependencyExporter(),
        )

        val manifest = service.export(RootArtifactRequest()).manifest()

        val artifacts = manifest.path("artifacts")
        assertThat(artifacts).hasSize(1)
        val artifact = artifacts.first()
        assertThat(artifact.path("type").asText()).isEqualTo("CASE_DEFINITION")
        assertThat(artifact.path("valtimoVersion").asText()).isEqualTo("13.1.3")
        assertThat(artifact.path("artifactVersionTag").path("\$ref").asText())
            .isEqualTo("$caseDefinitionPath#/versionTag")
        assertThat(artifact.path("title").path("\$ref").asText())
            .isEqualTo("$caseDefinitionPath#/name")

        val dependencies = artifact.path("dependencies")
        // Sorted by type (PLUGIN before BUILDING_BLOCK), then key.
        assertThat(dependencies.map { it.path("type").asText() })
            .containsExactly("PLUGIN", "BUILDING_BLOCK")
        assertThat(dependencies[0].path("key").asText()).isEqualTo("openzaak")
        assertThat(dependencies[0].path("title").asText()).isEqualTo("OpenZaak Plugin")
        assertThat(dependencies[0].has("versionTag")).isFalse()
        assertThat(dependencies[1].path("key").path("\$ref").asText()).isEqualTo("$buildingBlockPath#/key")
        assertThat(dependencies[1].path("versionTag").path("\$ref").asText())
            .isEqualTo("$buildingBlockPath#/versionTag")
    }

    @Test
    fun `should ignore manifest dependencies contributed by the root request`() {
        val service = service(ArtifactExporter(), PluginDependencyExporter())

        val manifest = service.export(RootArtifactRequest()).manifest()

        val dependencyKeys = manifest.path("artifacts").first().path("dependencies")
            .map { if (it.path("key").isTextual) it.path("key").asText() else it.path("key").path("\$ref").asText() }
        assertThat(dependencyKeys).doesNotContain("ignored-root-dependency")
    }

    /**
     * A root request can be answered by more than one exporter: a process definition and its process
     * links are exported by two exporters that support the same request. Only one of them contributes
     * the artifact, the dependencies of the other belong to that artifact.
     */
    @Test
    fun `should collect manifest dependencies of a root exporter that does not contribute the artifact`() {
        val service = service(ArtifactExporter(), CoRootDependencyExporter())

        val manifest = service.export(RootArtifactRequest()).manifest()

        val dependencyKeys = manifest.path("artifacts").single().path("dependencies")
            .map { it.path("key").asText() }
        assertThat(dependencyKeys).contains("co-root-plugin")
        assertThat(dependencyKeys).doesNotContain("ignored-root-dependency")
    }

    @Test
    fun `should deduplicate dependencies contributed by multiple exporters`() {
        val service = service(ArtifactExporter(), PluginDependencyExporter(), DuplicatePluginDependencyExporter())

        val manifest = service.export(RootArtifactRequest()).manifest()

        val openzaakCount = manifest.path("artifacts").first().path("dependencies")
            .count { it.path("type").asText() == "PLUGIN" && it.path("key").asText() == "openzaak" }
        assertThat(openzaakCount).isEqualTo(1)
    }

    @Test
    fun `should not write a manifest when no artifact is identified`() {
        val service = service(PluginDependencyExporter())

        val bytes = service.export(NoArtifactRequest()).toByteArray()

        assertThat(zipEntryNames(bytes)).doesNotContain(ExportManifest.MANIFEST_FILE_NAME)
    }

    private fun service(vararg exporters: Exporter<out ExportRequest>): ValtimoExportService {
        @Suppress("UNCHECKED_CAST")
        return ValtimoExportService(
            exporters.toList() as List<Exporter<ExportRequest>>,
            objectMapper,
            versionResolver,
        )
    }

    private fun java.io.ByteArrayOutputStream.manifest(): JsonNode {
        val bytes = toByteArray()
        val manifestEntry = ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            generateSequence { zip.nextEntry }
                .first { it.name == ExportManifest.MANIFEST_FILE_NAME }
                .let { zip.readBytes() }
        }
        return objectMapper.readTree(manifestEntry)
    }

    private fun zipEntryNames(bytes: ByteArray): List<String> =
        ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            generateSequence { zip.nextEntry }.map { it.name }.toList()
        }

    private data class RootArtifactRequest(val id: String = "root") : ExportRequest()

    private data class NoArtifactRequest(val id: String = "no-artifact") : ExportRequest()

    private data class PluginDependencyRequest(val id: String = "plugin-dep") : ExportRequest()

    private data class BuildingBlockDependencyRequest(val id: String = "bb-dep") : ExportRequest()

    private data class DuplicatePluginDependencyRequest(val id: String = "duplicate-plugin-dep") : ExportRequest()

    private inner class ArtifactExporter : Exporter<RootArtifactRequest> {
        override fun supports() = RootArtifactRequest::class.java
        override fun export(request: RootArtifactRequest) = ExportResult(
            exportFiles = setOf(ExportFile(caseDefinitionPath, "{}".toByteArray())),
            relatedRequests = setOf(
                PluginDependencyRequest(),
                BuildingBlockDependencyRequest(),
                DuplicatePluginDependencyRequest(),
            ),
            manifestArtifact = ArtifactManifestEntry(
                artifactVersionTag = ResolvableValue.ref(caseDefinitionPath, "/versionTag"),
                title = ResolvableValue.ref(caseDefinitionPath, "/name"),
                type = ArtifactType.CASE_DEFINITION,
                valtimoVersion = "",
                dependencies = emptyList(),
            ),
            // Contributed by the root request; must be ignored.
            manifestDependencies = setOf(
                ArtifactDependency(
                    DependencyType.PLUGIN,
                    ResolvableValue.of("ignored-root-dependency"),
                    ResolvableValue.of("ignored"),
                )
            ),
        )
    }

    private inner class PluginDependencyExporter : Exporter<PluginDependencyRequest> {
        override fun supports() = PluginDependencyRequest::class.java
        override fun export(request: PluginDependencyRequest) = ExportResult(
            manifestArtifact = null,
            manifestDependencies = setOf(
                ArtifactDependency(
                    DependencyType.PLUGIN,
                    ResolvableValue.of("openzaak"),
                    ResolvableValue.of("OpenZaak Plugin"),
                )
            ),
        )
    }

    private inner class DuplicatePluginDependencyExporter : Exporter<DuplicatePluginDependencyRequest> {
        override fun supports() = DuplicatePluginDependencyRequest::class.java
        override fun export(request: DuplicatePluginDependencyRequest) = ExportResult(
            manifestArtifact = null,
            manifestDependencies = setOf(
                ArtifactDependency(
                    DependencyType.PLUGIN,
                    ResolvableValue.of("openzaak"),
                    ResolvableValue.of("OpenZaak Plugin"),
                )
            ),
        )
    }

    private inner class CoRootDependencyExporter : Exporter<RootArtifactRequest> {
        override fun supports() = RootArtifactRequest::class.java
        override fun export(request: RootArtifactRequest) = ExportResult(
            exportFiles = setOf(ExportFile("config/case/bezwaar/1-0-0/process-link/bezwaar.process-link.json", "[]".toByteArray())),
            manifestArtifact = null,
            manifestDependencies = setOf(
                ArtifactDependency(
                    DependencyType.PLUGIN,
                    ResolvableValue.of("co-root-plugin"),
                    ResolvableValue.of("Co Root Plugin"),
                )
            ),
        )
    }

    private inner class BuildingBlockDependencyExporter : Exporter<BuildingBlockDependencyRequest> {
        override fun supports() = BuildingBlockDependencyRequest::class.java
        override fun export(request: BuildingBlockDependencyRequest) = ExportResult(
            manifestArtifact = null,
            manifestDependencies = setOf(
                ArtifactDependency(
                    DependencyType.BUILDING_BLOCK,
                    ResolvableValue.ref(buildingBlockPath, "/key"),
                    ResolvableValue.ref(buildingBlockPath, "/name"),
                    ResolvableValue.ref(buildingBlockPath, "/versionTag"),
                )
            ),
        )
    }
}
