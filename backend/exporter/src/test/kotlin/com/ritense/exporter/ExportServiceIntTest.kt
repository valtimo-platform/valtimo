package com.ritense.exporter

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.exporter.manifest.ExportManifest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.io.ByteArrayInputStream
import java.util.zip.ZipInputStream

class ExportServiceIntTest @Autowired constructor(
    private val exportService: ExportService,
    private val objectMapper: ObjectMapper,
): BaseIntegrationTest() {

    @Test
    fun `should export a zip`() {
        val bytes = exportService.export(TestExportRequest()).toByteArray()
        val entries = ZipInputStream(ByteArrayInputStream(bytes)).use {
            generateSequence { it.nextEntry }
                .toList()
        }

        assertThat(entries.singleOrNull { it.name == "test.txt" }).isNotNull
        assertThat(entries.singleOrNull { it.name == "nested.txt" }).isNotNull
    }

    @Test
    fun `should export an empty zip`() {
        val bytes = exportService.export(TestExportRequest(required = false)).toByteArray()
        val entries = ZipInputStream(ByteArrayInputStream(bytes)).use {
            generateSequence { it.nextEntry }
                .toList()
        }

        assertThat(entries.isEmpty())
    }

    @Test
    fun `should add an export manifest describing the artifact and its dependencies`() {
        val bytes = exportService.export(TestArtifactExportRequest()).toByteArray()

        val manifestContent = ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            generateSequence { zip.nextEntry }
                .first { it.name == ExportManifest.MANIFEST_FILE_NAME }
                .let { zip.readBytes() }
        }
        val manifest = objectMapper.readTree(manifestContent)

        val artifact = manifest.path("artifacts").single()
        assertThat(artifact.path("type").asText()).isEqualTo("CASE_DEFINITION")
        assertThat(artifact.path("artifactVersionTag").path("\$ref").asText())
            .isEqualTo("$TEST_ARTIFACT_FILE_PATH#/versionTag")
        val dependency = artifact.path("dependencies").single()
        assertThat(dependency.path("type").asText()).isEqualTo("PLUGIN")
        assertThat(dependency.path("key").asText()).isEqualTo("test-plugin")
        assertThat(dependency.path("title").asText()).isEqualTo("Test Plugin")
    }

    @Test
    fun `should not result in a stackoverflow`() {
        val bytes = exportService.export(TestStackOverflowExportRequest()).toByteArray()
        val entries = ZipInputStream(ByteArrayInputStream(bytes)).use {
            generateSequence { it.nextEntry }
                .toList()
        }
        assertThat(entries).isEmpty()
    }
}