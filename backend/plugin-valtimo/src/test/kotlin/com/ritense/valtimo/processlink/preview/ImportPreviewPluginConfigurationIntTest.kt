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

package com.ritense.valtimo.processlink.preview

import com.ritense.case.service.CaseDefinitionImportPreviewService
import com.ritense.processlink.service.ProcessDefinitionImportPreviewService
import com.ritense.valtimo.BaseIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class ImportPreviewPluginConfigurationIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var caseDefinitionImportPreviewService: CaseDefinitionImportPreviewService

    @Autowired
    lateinit var processDefinitionImportPreviewService: ProcessDefinitionImportPreviewService

    @Test
    fun `should report the plugin configurations of the case process links when previewing a case import`() {
        val pluginConfigurationId = UUID.randomUUID()

        val preview = caseDefinitionImportPreviewService.preview(
            zipOf(
                CASE_DEFINITION_PATH to CASE_DEFINITION_JSON,
                CASE_PROCESS_LINK_PATH to pluginProcessLinkJson(pluginConfigurationId),
            )
        )

        val pluginConfiguration = preview.pluginConfigurations.single()
        assertThat(pluginConfiguration.pluginConfigurationId).isEqualTo(pluginConfigurationId)
        assertThat(pluginConfiguration.pluginActionDefinitionKey).isEqualTo("my-action")
        assertThat(pluginConfiguration.existsInTargetEnvironment).isFalse()
    }

    @Test
    fun `should only report the plugin configurations of the global process links when previewing a process import`() {
        val globalPluginConfigurationId = UUID.randomUUID()

        val preview = processDefinitionImportPreviewService.preview(
            zipOf(
                GLOBAL_BPMN_PATH to BPMN,
                GLOBAL_PROCESS_LINK_PATH to pluginProcessLinkJson(globalPluginConfigurationId),
                CASE_PROCESS_LINK_PATH to pluginProcessLinkJson(UUID.randomUUID()),
            )
        )

        assertThat(preview.pluginConfigurations.map { it.pluginConfigurationId })
            .containsExactly(globalPluginConfigurationId)
    }

    private fun pluginProcessLinkJson(pluginConfigurationId: UUID) = """
        [
          {
            "activityId": "Task_1",
            "activityType": "bpmn:ServiceTask:start",
            "processLinkType": "plugin",
            "pluginConfigurationId": "$pluginConfigurationId",
            "pluginDefinitionKey": "test-plugin",
            "pluginActionDefinitionKey": "my-action"
          }
        ]
    """.trimIndent()

    private fun zipOf(vararg entries: Pair<String, String>): ByteArrayInputStream {
        val outputStream = ByteArrayOutputStream()
        ZipOutputStream(outputStream).use { zos ->
            entries.forEach { (path, content) ->
                zos.putNextEntry(ZipEntry(path))
                zos.write(content.toByteArray())
                zos.closeEntry()
            }
        }
        return ByteArrayInputStream(outputStream.toByteArray())
    }

    private companion object {
        const val PROCESS_DEFINITION_KEY = "import-preview-process"
        const val CASE_DEFINITION_PATH =
            "config/case/import-preview-case/1-0-0/case/definition/import-preview-case.case-definition.json"
        const val CASE_PROCESS_LINK_PATH =
            "config/case/import-preview-case/1-0-0/process-link/$PROCESS_DEFINITION_KEY.process-link.json"
        const val GLOBAL_BPMN_PATH = "config/global/bpmn/$PROCESS_DEFINITION_KEY.bpmn"
        const val GLOBAL_PROCESS_LINK_PATH =
            "config/global/process-link/$PROCESS_DEFINITION_KEY.process-link.json"
        val CASE_DEFINITION_JSON = """
            {
                "key": "import-preview-case",
                "name": "Import preview case",
                "versionTag": "1.0.0",
                "final": false
            }
        """.trimIndent()
        val BPMN = """
            <?xml version="1.0" encoding="UTF-8"?>
            <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                              id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
              <bpmn:process id="$PROCESS_DEFINITION_KEY" isExecutable="true">
                <bpmn:startEvent id="StartEvent_1" />
              </bpmn:process>
            </bpmn:definitions>
        """.trimIndent()
    }
}
