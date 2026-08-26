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

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.exporter.ExportService
import com.ritense.exporter.manifest.ExportManifest
import com.ritense.exporter.request.GlobalProcessDefinitionExportRequest
import com.ritense.processlink.BaseIntegrationTest
import com.ritense.processlink.web.rest.dto.ProcessLinkExportResponseDto
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.io.ByteArrayInputStream
import java.util.zip.ZipInputStream

/**
 * Exports the autodeployed `test-system-process`, which is not part of a case definition.
 */
@Transactional
class GlobalProcessLinkExporterIntTest @Autowired constructor(
    private val objectMapper: ObjectMapper,
    private val operatonRepositoryService: OperatonRepositoryService,
    private val exportService: ExportService,
) : BaseIntegrationTest() {

    @Test
    fun `should export the process and its process links into the global folder structure`(): Unit =
        runWithoutAuthorization {
            val processDefinitionId = getProcessDefinitionId(PROCESS_DEFINITION_KEY)

            val entries = export(processDefinitionId)

            assertThat(entries.keys).containsExactlyInAnyOrder(
                "config/global/bpmn/$PROCESS_DEFINITION_KEY.bpmn",
                "config/global/process-link/$PROCESS_DEFINITION_KEY.process-link.json",
                ExportManifest.MANIFEST_FILE_NAME,
            )
        }

    @Test
    fun `should export the process links of the process`(): Unit = runWithoutAuthorization {
        val processDefinitionId = getProcessDefinitionId(PROCESS_DEFINITION_KEY)

        val entries = export(processDefinitionId)

        val processLinks: List<ProcessLinkExportResponseDto> = objectMapper.readValue(
            entries.getValue("config/global/process-link/$PROCESS_DEFINITION_KEY.process-link.json")
        )
        assertThat(processLinks).hasSize(1)
        assertThat(processLinks.single().activityId).isEqualTo("test-user-task")
        assertThat(processLinks.single().processLinkType).isEqualTo("test")
    }

    @Test
    fun `should export a bpmn that contains the process definition key`(): Unit = runWithoutAuthorization {
        val processDefinitionId = getProcessDefinitionId(PROCESS_DEFINITION_KEY)

        val entries = export(processDefinitionId)

        val bpmn = entries.getValue("config/global/bpmn/$PROCESS_DEFINITION_KEY.bpmn").toString(Charsets.UTF_8)
        assertThat(bpmn).contains("""id="$PROCESS_DEFINITION_KEY"""")
        assertThat(bpmn).contains("test-user-task")
    }

    private fun export(processDefinitionId: String): Map<String, ByteArray> {
        val outputStream = exportService.export(GlobalProcessDefinitionExportRequest(processDefinitionId))
        return readZipEntries(outputStream.toByteArray())
    }

    private fun readZipEntries(zip: ByteArray): Map<String, ByteArray> {
        val entries = mutableMapOf<String, ByteArray>()
        ZipInputStream(ByteArrayInputStream(zip)).use { zipInputStream ->
            var entry = zipInputStream.nextEntry
            while (entry != null) {
                entries[entry.name] = zipInputStream.readBytes()
                entry = zipInputStream.nextEntry
            }
        }
        return entries
    }

    private fun getProcessDefinitionId(processDefinitionKey: String): String {
        return requireNotNull(operatonRepositoryService.findLatestProcessDefinition(processDefinitionKey)).id
    }

    private companion object {
        const val PROCESS_DEFINITION_KEY = "test-system-process"
    }
}
