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

package com.ritense.processlink.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.exporter.ExportService
import com.ritense.exporter.request.GlobalProcessDefinitionExportRequest
import com.ritense.processlink.BaseIntegrationTest
import com.ritense.processlink.web.rest.dto.MissingReferenceType
import com.ritense.processlink.web.rest.dto.ReplacedElementDto
import com.ritense.processlink.web.rest.dto.ReplacedElementType
import com.ritense.valtimo.contract.config.ValtimoProperties
import com.ritense.valtimo.domain.processdefinition.ProcessDefinitionProperties
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.processdefinition.repository.ProcessDefinitionPropertiesRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.io.ByteArrayInputStream

/**
 * Previews the package produced by exporting the autodeployed `test-system-process`.
 */
@Transactional
class ProcessDefinitionImportPreviewServiceIntTest @Autowired constructor(
    private val exportService: ExportService,
    private val processDefinitionImportPreviewService: ProcessDefinitionImportPreviewService,
    private val processDefinitionPropertiesRepository: ProcessDefinitionPropertiesRepository,
    private val operatonRepositoryService: OperatonRepositoryService,
    private val valtimoProperties: ValtimoProperties,
) : BaseIntegrationTest() {

    @Test
    fun `should report the process of the package`(): Unit = runWithoutAuthorization {
        val preview = processDefinitionImportPreviewService.preview(exportedPackage())

        assertThat(preview.processDefinitionKeys).containsExactly(PROCESS_DEFINITION_KEY)
        assertThat(preview.missingReferences).isEmpty()
        assertThat(preview.canImport).isTrue()
    }

    @Test
    fun `should report that the process of the package already exists here`(): Unit = runWithoutAuthorization {
        val preview = processDefinitionImportPreviewService.preview(exportedPackage())

        assertThat(preview.existingProcessDefinitionKeys).containsExactly(PROCESS_DEFINITION_KEY)
    }

    @Test
    fun `should list the process of the package as an element to replace`(): Unit = runWithoutAuthorization {
        val preview = processDefinitionImportPreviewService.preview(exportedPackage())

        assertThat(preview.elementsToReplace).contains(
            ReplacedElementDto(ReplacedElementType.PROCESS_DEFINITION, PROCESS_DEFINITION_KEY)
        )
        // Replacing an existing element is informational, not a block
        assertThat(preview.canImport).isTrue()
    }

    @Test
    fun `should report nothing to replace for a process that does not exist here yet`(): Unit = runWithoutAuthorization {
        val preview = processDefinitionImportPreviewService.preview(
            zipOf("config/global/bpmn/does-not-exist-here.bpmn" to bpmnWithCallActivity("does-not-exist-here", null))
        )

        assertThat(preview.elementsToReplace).isEmpty()
    }

    @Test
    fun `should refuse a package for a process that is a read only system process here`(): Unit =
        runWithoutAuthorization {
            givenSystemProcess()

            val preview = processDefinitionImportPreviewService.preview(exportedPackage())

            assertThat(preview.missingReferences).hasSize(1)
            assertThat(preview.missingReferences.single().type)
                .isEqualTo(MissingReferenceType.READ_ONLY_SYSTEM_PROCESS)
            assertThat(preview.missingReferences.single().reference).isEqualTo(PROCESS_DEFINITION_KEY)
            assertThat(preview.canImport).isFalse()
        }

    @Test
    fun `should allow a package for a system process that may be updated`(): Unit = runWithoutAuthorization {
        givenSystemProcess()
        valtimoProperties.process.isSystemProcessUpdatable = true

        try {
            val preview = processDefinitionImportPreviewService.preview(exportedPackage())

            assertThat(preview.missingReferences).isEmpty()
            assertThat(preview.canImport).isTrue()
        } finally {
            valtimoProperties.process.isSystemProcessUpdatable = false
        }
    }

    @Test
    fun `should allow a package for a process that does not exist here yet`(): Unit = runWithoutAuthorization {
        // There are no process definition properties for an unknown process, which isReadOnly cannot handle
        val preview = processDefinitionImportPreviewService.preview(
            zipOf("config/global/bpmn/does-not-exist-here.bpmn" to bpmnWithCallActivity("does-not-exist-here", null))
        )

        assertThat(preview.processDefinitionKeys).containsExactly("does-not-exist-here")
        assertThat(preview.existingProcessDefinitionKeys).isEmpty()
        assertThat(preview.missingReferences).isEmpty()
        assertThat(preview.canImport).isTrue()
    }

    @Test
    fun `should report a called sub-process that is not deployed here`(): Unit = runWithoutAuthorization {
        val preview = processDefinitionImportPreviewService.preview(
            zipOf(
                "config/global/bpmn/calling-process.bpmn" to
                    bpmnWithCallActivity("calling-process", "not-deployed-process")
            )
        )

        assertThat(preview.missingReferences).hasSize(1)
        assertThat(preview.missingReferences.single().type).isEqualTo(MissingReferenceType.SUB_PROCESS)
        assertThat(preview.missingReferences.single().reference).isEqualTo("not-deployed-process")
        // A missing sub-process does not stop the import
        assertThat(preview.canImport).isTrue()
    }

    @Test
    fun `should not report a called sub-process that is deployed here`(): Unit = runWithoutAuthorization {
        val preview = processDefinitionImportPreviewService.preview(
            zipOf(
                "config/global/bpmn/calling-process.bpmn" to
                    bpmnWithCallActivity("calling-process", PROCESS_DEFINITION_KEY)
            )
        )

        assertThat(preview.missingReferences).isEmpty()
    }

    private fun givenSystemProcess() {
        processDefinitionPropertiesRepository.save(
            ProcessDefinitionProperties(PROCESS_DEFINITION_KEY, true)
        )
    }

    private fun exportedPackage(): ByteArrayInputStream {
        val processDefinitionId =
            requireNotNull(operatonRepositoryService.findLatestProcessDefinition(PROCESS_DEFINITION_KEY)).id
        val outputStream = exportService.export(GlobalProcessDefinitionExportRequest(processDefinitionId))
        return ByteArrayInputStream(outputStream.toByteArray())
    }

    private fun bpmnWithCallActivity(processDefinitionKey: String, calledElement: String?): String {
        val callActivity = calledElement?.let {
            """<bpmn:callActivity id="CallActivity_1" calledElement="$it" />"""
        } ?: ""

        return """
            <?xml version="1.0" encoding="UTF-8"?>
            <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                              id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
              <bpmn:process id="$processDefinitionKey" isExecutable="true">
                <bpmn:startEvent id="StartEvent_1" />
                $callActivity
              </bpmn:process>
            </bpmn:definitions>
        """.trimIndent()
    }

    private fun zipOf(vararg entries: Pair<String, String>): ByteArrayInputStream {
        val outputStream = java.io.ByteArrayOutputStream()
        java.util.zip.ZipOutputStream(outputStream).use { zos ->
            entries.forEach { (path, content) ->
                zos.putNextEntry(java.util.zip.ZipEntry(path))
                zos.write(content.toByteArray())
                zos.closeEntry()
            }
        }
        return ByteArrayInputStream(outputStream.toByteArray())
    }

    private companion object {
        const val PROCESS_DEFINITION_KEY = "test-system-process"
    }
}
