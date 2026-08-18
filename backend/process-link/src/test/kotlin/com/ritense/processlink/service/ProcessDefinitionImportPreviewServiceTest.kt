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

import com.ritense.importer.exception.ImportServiceException
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.importer.ProcessLinkImporterTest.TestProcessLinkDeployDto
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.web.rest.dto.MissingReferenceDto
import com.ritense.processlink.web.rest.dto.MissingReferenceType
import com.ritense.processlink.web.rest.dto.ReplacedElementDto
import com.ritense.processlink.web.rest.dto.ReplacedElementType
import com.ritense.valtimo.contract.importer.ImportPreviewContribution
import com.ritense.valtimo.contract.importer.ImportPreviewContributor
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.domain.processdefinition.ProcessDefinitionProperties
import com.ritense.valtimo.operaton.domain.OperatonDecisionDefinition
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.service.ProcessPropertyService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.data.jpa.domain.Specification
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

@ExtendWith(MockitoExtension::class)
class ProcessDefinitionImportPreviewServiceTest {

    @Mock
    lateinit var processLinkService: ProcessLinkService

    @Mock
    lateinit var repositoryService: OperatonRepositoryService

    @Mock
    lateinit var processPropertyService: ProcessPropertyService

    private val objectMapper = MapperSingleton.get().also {
        it.registerSubtypes(TestProcessLinkDeployDto::class.java)
    }

    private lateinit var service: ProcessDefinitionImportPreviewService

    @BeforeEach
    fun before() {
        service = ProcessDefinitionImportPreviewService(
            objectMapper,
            emptyList(),
            processLinkService,
            repositoryService,
            processPropertyService,
        )
    }

    @Test
    fun `should report the process definition keys in the package`() {
        val preview = service.preview(zipOf(BPMN_PATH to bpmn()))

        assertThat(preview.processDefinitionKeys).containsExactly(PROCESS_DEFINITION_KEY)
        assertThat(preview.canImport).isTrue()
    }

    @Test
    fun `should report a process of the package that already exists here`() {
        whenever(repositoryService.findLatestProcessDefinition(PROCESS_DEFINITION_KEY))
            .thenReturn(mock<OperatonProcessDefinition>())

        val preview = service.preview(zipOf(BPMN_PATH to bpmn()))

        assertThat(preview.existingProcessDefinitionKeys).containsExactly(PROCESS_DEFINITION_KEY)
    }

    @Test
    fun `should not report a process of the package that does not exist here`() {
        val preview = service.preview(zipOf(BPMN_PATH to bpmn()))

        assertThat(preview.existingProcessDefinitionKeys).isEmpty()
    }

    @Test
    fun `should fail when the package contains no process definition`() {
        assertThatThrownBy { service.preview(zipOf("config/global/role/global.role.json" to "[]")) }
            .isInstanceOf(ImportServiceException::class.java)
            .hasMessageContaining("No process definition found")
    }

    @Test
    fun `should fail when the file is not a zip`() {
        assertThatThrownBy { service.preview(ByteArrayInputStream("not a zip".toByteArray())) }
            .isInstanceOf(ImportServiceException::class.java)
    }

    @Test
    fun `should report a plugin configuration contributed by a preview contributor`() {
        val pluginConfigurationId = UUID.randomUUID()
        service = ProcessDefinitionImportPreviewService(
            objectMapper,
            listOf(contributorReturning(pluginConfigurationId)),
            processLinkService,
            repositoryService,
            processPropertyService,
        )

        val preview = service.preview(zipOf(BPMN_PATH to bpmn()))

        val pluginConfiguration = preview.pluginConfigurations.single()
        assertThat(pluginConfiguration.pluginConfigurationId).isEqualTo(pluginConfigurationId)
        assertThat(pluginConfiguration.existsInTargetEnvironment).isFalse()
    }

    @Test
    fun `should report a called sub-process that is not deployed`() {
        val preview = service.preview(zipOf(BPMN_PATH to bpmn(callActivityCalling = "other-process")))

        assertThat(preview.missingReferences).containsExactly(
            MissingReferenceDto(
                type = MissingReferenceType.SUB_PROCESS,
                reference = "other-process",
                activityId = "CallActivity_1",
                processDefinitionKey = PROCESS_DEFINITION_KEY,
            )
        )
        // A missing sub-process does not stop the import
        assertThat(preview.canImport).isTrue()
    }

    @Test
    fun `should not report a called sub-process that is deployed`() {
        whenever(repositoryService.findLatestProcessDefinition(PROCESS_DEFINITION_KEY)).thenReturn(null)
        whenever(repositoryService.findLatestProcessDefinition("other-process"))
            .thenReturn(mock<OperatonProcessDefinition>())

        val preview = service.preview(zipOf(BPMN_PATH to bpmn(callActivityCalling = "other-process")))

        assertThat(preview.missingReferences).isEmpty()
    }

    @Test
    fun `should not report a called sub-process that is part of the same package`() {
        val preview = service.preview(
            zipOf(
                BPMN_PATH to bpmn(callActivityCalling = "other-process"),
                "config/global/bpmn/other-process.bpmn" to bpmn(key = "other-process"),
            )
        )

        assertThat(preview.missingReferences).isEmpty()
    }

    @Test
    fun `should report a referenced decision definition that is not deployed`() {
        val preview = service.preview(zipOf(BPMN_PATH to bpmn(decisionRef = "my-decision")))

        assertThat(preview.missingReferences.single().type)
            .isEqualTo(MissingReferenceType.DECISION_DEFINITION)
        assertThat(preview.missingReferences.single().reference).isEqualTo("my-decision")
    }

    @Test
    fun `should not report a referenced decision definition that is deployed`() {
        whenever(repositoryService.findDecisionDefinition(any<Specification<OperatonDecisionDefinition>>()))
            .thenReturn(mock<OperatonDecisionDefinition>())

        val preview = service.preview(zipOf(BPMN_PATH to bpmn(decisionRef = "my-decision")))

        assertThat(preview.missingReferences).isEmpty()
    }

    @Test
    fun `should report a missing reference of a process link and block the import`() {
        val mapper = mock<ProcessLinkMapper>()
        whenever(mapper.getMissingReference(any(), anyOrNull())).thenReturn(
            MissingReferenceDto(type = MissingReferenceType.FORM, reference = "my-form")
        )
        whenever(processLinkService.getProcessLinkMapper("test-type")).thenReturn(mapper)

        val preview = service.preview(
            zipOf(
                BPMN_PATH to bpmn(),
                PROCESS_LINK_PATH to processLinkJson(),
            )
        )

        assertThat(preview.missingReferences).containsExactly(
            MissingReferenceDto(
                type = MissingReferenceType.FORM,
                reference = "my-form",
                processDefinitionKey = PROCESS_DEFINITION_KEY,
            )
        )
        assertThat(preview.canImport).isFalse()
    }

    @Test
    fun `should block the import when the process is a read only system process here`() {
        mockDeployedSystemProcess(readOnly = true)

        val preview = service.preview(zipOf(BPMN_PATH to bpmn()))

        assertThat(preview.missingReferences.single().type)
            .isEqualTo(MissingReferenceType.READ_ONLY_SYSTEM_PROCESS)
        assertThat(preview.canImport).isFalse()
    }

    @Test
    fun `should allow the import when a system process here may be updated`() {
        mockDeployedSystemProcess(readOnly = false)

        val preview = service.preview(zipOf(BPMN_PATH to bpmn()))

        assertThat(preview.missingReferences).isEmpty()
        assertThat(preview.canImport).isTrue()
    }

    @Test
    fun `should allow the import when the process does not exist here yet`() {
        // No properties exist for an unknown process, which isReadOnly cannot handle
        whenever(repositoryService.findLatestProcessDefinition(PROCESS_DEFINITION_KEY)).thenReturn(null)

        val preview = service.preview(zipOf(BPMN_PATH to bpmn()))

        assertThat(preview.missingReferences).isEmpty()
        assertThat(preview.canImport).isTrue()
    }

    @Test
    fun `should report a bundled process that already exists as an element to replace`() {
        whenever(repositoryService.findLatestProcessDefinition(PROCESS_DEFINITION_KEY))
            .thenReturn(mock<OperatonProcessDefinition>())

        val preview = service.preview(zipOf(BPMN_PATH to bpmn()))

        assertThat(preview.elementsToReplace).containsExactly(
            ReplacedElementDto(ReplacedElementType.PROCESS_DEFINITION, PROCESS_DEFINITION_KEY)
        )
        // Replacing an existing element is informational, not a block
        assertThat(preview.canImport).isTrue()
    }

    @Test
    fun `should report a bundled decision definition that already exists as an element to replace`() {
        whenever(repositoryService.findDecisionDefinition(any<Specification<OperatonDecisionDefinition>>()))
            .thenReturn(mock<OperatonDecisionDefinition>())

        val preview = service.preview(
            zipOf(
                BPMN_PATH to bpmn(),
                "config/global/dmn/my-decision.dmn" to "<definitions/>",
            )
        )

        assertThat(preview.elementsToReplace).contains(
            ReplacedElementDto(ReplacedElementType.DECISION_DEFINITION, "my-decision")
        )
    }

    @Test
    fun `should report a bundled form that already exists as an element to replace`() {
        val mapper = mock<ProcessLinkMapper>()
        whenever(mapper.getReplacedReference(any(), anyOrNull())).thenReturn(
            ReplacedElementDto(ReplacedElementType.FORM, "my-form")
        )
        whenever(processLinkService.getProcessLinkMapper("test-type")).thenReturn(mapper)

        val preview = service.preview(
            zipOf(
                BPMN_PATH to bpmn(),
                PROCESS_LINK_PATH to processLinkJson(),
                "config/global/form/my-form.form.json" to "{}",
            )
        )

        assertThat(preview.elementsToReplace).contains(
            ReplacedElementDto(ReplacedElementType.FORM, "my-form")
        )
    }

    @Test
    fun `should not report a bundled form as missing`() {
        val mapper = mock<ProcessLinkMapper>()
        whenever(mapper.getMissingReference(any(), anyOrNull())).thenReturn(
            MissingReferenceDto(type = MissingReferenceType.FORM, reference = "my-form")
        )
        whenever(processLinkService.getProcessLinkMapper("test-type")).thenReturn(mapper)

        val preview = service.preview(
            zipOf(
                BPMN_PATH to bpmn(),
                PROCESS_LINK_PATH to processLinkJson(),
                "config/global/form/my-form.form.json" to "{}",
            )
        )

        assertThat(preview.missingReferences).isEmpty()
        assertThat(preview.canImport).isTrue()
    }

    @Test
    fun `should report a called sub-process that could not be included as a missing reference`() {
        // A deployment-bound (or expression) call activity cannot be bundled and is not on the target
        val preview = service.preview(
            zipOf(BPMN_PATH to bpmn(callActivityCalling = "other-process", callActivityBinding = "deployment"))
        )

        assertThat(preview.missingReferences).containsExactly(
            MissingReferenceDto(
                type = MissingReferenceType.SUB_PROCESS,
                reference = "other-process",
                activityId = "CallActivity_1",
                processDefinitionKey = PROCESS_DEFINITION_KEY,
            )
        )
    }

    @Test
    fun `should report no elements to replace when nothing is bundled that exists here`() {
        val preview = service.preview(zipOf(BPMN_PATH to bpmn()))

        assertThat(preview.elementsToReplace).isEmpty()
    }

    private fun mockDeployedSystemProcess(readOnly: Boolean) {
        whenever(repositoryService.findLatestProcessDefinition(PROCESS_DEFINITION_KEY))
            .thenReturn(mock<OperatonProcessDefinition>())
        whenever(processPropertyService.findByProcessDefinitionKey(PROCESS_DEFINITION_KEY))
            .thenReturn(mock<ProcessDefinitionProperties>())
        whenever(processPropertyService.isReadOnly(PROCESS_DEFINITION_KEY)).thenReturn(readOnly)
    }

    private fun contributorReturning(pluginConfigurationId: UUID) = ImportPreviewContributor {
        listOf(
            ImportPreviewContribution(
                pluginConfigurationId = pluginConfigurationId,
                pluginDefinitionKey = "my-plugin",
                pluginActionDefinitionKey = "my-action",
                processDefinitionKey = PROCESS_DEFINITION_KEY,
                activityId = "Task_1",
                existsInTargetEnvironment = false,
            )
        )
    }

    private fun processLinkJson() = """
        [
          {
            "activityId": "Task_1",
            "activityType": "${ActivityTypeWithEventName.SERVICE_TASK_START.value}",
            "processLinkType": "test-type"
          }
        ]
    """.trimIndent()

    private fun bpmn(
        key: String = PROCESS_DEFINITION_KEY,
        callActivityCalling: String? = null,
        callActivityBinding: String? = null,
        decisionRef: String? = null,
    ): String {
        val callActivity = callActivityCalling?.let {
            val binding = callActivityBinding?.let { b -> """ camunda:calledElementBinding="$b"""" } ?: ""
            """<bpmn:callActivity id="CallActivity_1" calledElement="$it"$binding />"""
        } ?: ""
        val businessRuleTask = decisionRef?.let {
            """<bpmn:businessRuleTask id="BusinessRuleTask_1" camunda:decisionRef="$it" />"""
        } ?: ""

        return """
            <?xml version="1.0" encoding="UTF-8"?>
            <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                              xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                              id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
              <bpmn:process id="$key" isExecutable="true">
                <bpmn:startEvent id="StartEvent_1" />
                $callActivity
                $businessRuleTask
              </bpmn:process>
            </bpmn:definitions>
        """.trimIndent()
    }

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
        const val PROCESS_DEFINITION_KEY = "my-process"
        const val BPMN_PATH = "config/global/bpmn/$PROCESS_DEFINITION_KEY.bpmn"
        const val PROCESS_LINK_PATH = "config/global/process-link/$PROCESS_DEFINITION_KEY.process-link.json"
    }
}
