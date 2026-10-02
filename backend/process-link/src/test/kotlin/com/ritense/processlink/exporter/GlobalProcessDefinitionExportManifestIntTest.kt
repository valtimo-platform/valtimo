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

package com.ritense.processlink.exporter

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.exporter.ExportService
import com.ritense.exporter.manifest.ExportManifest
import com.ritense.exporter.request.GlobalProcessDefinitionExportRequest
import com.ritense.processlink.BaseIntegrationTest
import com.ritense.processlink.domain.TestProcessLinkMapper.Companion.TEST_DEPENDENCY_KEY
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.io.ByteArrayInputStream
import java.util.zip.ZipInputStream

/**
 * The export of the autodeployed `test-system-process` describes itself in a manifest, so the target
 * environment of the export knows what it receives and what that needs.
 */
@Transactional
class GlobalProcessDefinitionExportManifestIntTest @Autowired constructor(
    private val objectMapper: ObjectMapper,
    private val operatonRepositoryService: OperatonRepositoryService,
    private val exportService: ExportService,
) : BaseIntegrationTest() {

    @Test
    fun `should describe the exported process as the artifact of the export`(): Unit = runWithoutAuthorization {
        val artifact = exportManifest().path("artifacts").single()

        assertThat(artifact.path("type").asText()).isEqualTo("PROCESS_DEFINITION")
        assertThat(artifact.path("title").asText()).isEqualTo("Test Process")
        // The bpmn has no version tag of its own, so the version of the deployment is used
        assertThat(artifact.path("artifactVersionTag").asText()).isEqualTo("1")
        assertThat(artifact.has("valtimoVersion")).isTrue()
    }

    /**
     * The process links of the process are exported by a second exporter of the same export request.
     * What those links need has to end up in the manifest of the process.
     */
    @Test
    fun `should describe what the process links of the exported process need`(): Unit = runWithoutAuthorization {
        val dependencies = exportManifest().path("artifacts").single().path("dependencies")

        assertThat(dependencies).hasSize(1)
        assertThat(dependencies.single().path("type").asText()).isEqualTo("PLUGIN")
        assertThat(dependencies.single().path("key").asText()).isEqualTo(TEST_DEPENDENCY_KEY)
        assertThat(dependencies.single().path("title").asText()).isEqualTo("Test Plugin")
    }

    private fun exportManifest(): JsonNode {
        val processDefinitionId =
            requireNotNull(operatonRepositoryService.findLatestProcessDefinition(PROCESS_DEFINITION_KEY)).id
        val zip = exportService.export(GlobalProcessDefinitionExportRequest(processDefinitionId)).toByteArray()

        val manifestContent = ZipInputStream(ByteArrayInputStream(zip)).use { zipInputStream ->
            generateSequence { zipInputStream.nextEntry }
                .firstOrNull { it.name == ExportManifest.MANIFEST_FILE_NAME }
                ?.let { zipInputStream.readBytes() }
        }
        requireNotNull(manifestContent) { "Expected ${ExportManifest.MANIFEST_FILE_NAME} in the export" }

        return objectMapper.readTree(manifestContent)
    }

    private companion object {
        const val PROCESS_DEFINITION_KEY = "test-system-process"
    }
}
