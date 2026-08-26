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

import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.TestProcessLinkCreateRequestDto
import com.ritense.processlink.validation.ProcessDefinitionValidationException
import com.ritense.processlink.validation.ProcessDefinitionValidationResult
import com.ritense.processlink.validation.ProcessDefinitionValidator
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.service.OperatonProcessService
import java.io.ByteArrayInputStream
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argThat
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.DeploymentWithDefinitions
import org.operaton.bpm.engine.repository.ProcessDefinition
import org.springframework.mock.web.MockMultipartFile

class ProcessDeploymentServiceTest {

    private lateinit var operatonProcessService: OperatonProcessService
    private lateinit var processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService
    private lateinit var processLinkService: ProcessLinkService
    private lateinit var processDefinitionValidator: ProcessDefinitionValidator
    private lateinit var repositoryService: RepositoryService
    private lateinit var processDeploymentService: ProcessDeploymentService

    @BeforeEach
    fun setUp() {
        operatonProcessService = mock()
        processDefinitionCaseDefinitionService = mock()
        processLinkService = mock()
        processDefinitionValidator = mock()
        repositoryService = mock()
        processDeploymentService = ProcessDeploymentService(
            operatonProcessService,
            processDefinitionCaseDefinitionService,
            processLinkService,
            processDefinitionValidator,
            repositoryService
        )

        whenever(processDefinitionValidator.validate(any(), any(), any()))
            .thenReturn(ProcessDefinitionValidationResult(isExecutable = true, errors = emptyList()))

        val deployment: DeploymentWithDefinitions = mock()
        whenever(deployment.id).thenReturn(DEPLOYMENT_ID)
        doReturn(deployment).whenever(operatonProcessService)
            .deploy(anyOrNull<BlueprintId>(), any<String>(), any<ByteArrayInputStream>(), any<Boolean>(), any<Boolean>())

        val deployedDefinition: ProcessDefinition = mock()
        whenever(deployedDefinition.id).thenReturn(PROCESS_DEFINITION_ID)
        doReturn(deployedDefinition).whenever(operatonProcessService)
            .getProcessDefinitionByDeploymentId(DEPLOYMENT_ID)
    }

    @Test
    fun `should report an invalid process link configuration as a validation error on the activity`() {
        doThrow(IllegalStateException("Call activity 'callActivity' must define a business key"))
            .whenever(processLinkService).createProcessLink(any(), anyOrNull())

        assertThatThrownBy { deploy(processLink("callActivity", ActivityTypeWithEventName.CALL_ACTIVITY_START)) }
            .isInstanceOfSatisfying(ProcessDefinitionValidationException::class.java) { exception ->
                assertThat(exception.errors).singleElement().satisfies({ error ->
                    assertThat(error.elementId).isEqualTo("callActivity")
                    assertThat(error.elementType).isEqualTo("CallActivity")
                    assertThat(error.reason).isEqualTo("Call activity 'callActivity' must define a business key")
                })
            }
    }

    @Test
    fun `should collect validation errors for all invalid process links`() {
        doThrow(IllegalArgumentException("Input mapping targets must be 'doc:' building block fields"))
            .whenever(processLinkService).createProcessLink(argThatActivity("callActivityA"), anyOrNull())
        doThrow(IllegalStateException("Call activity 'callActivityB' must define a business key"))
            .whenever(processLinkService).createProcessLink(argThatActivity("callActivityB"), anyOrNull())

        assertThatThrownBy {
            deploy(
                processLink("callActivityA", ActivityTypeWithEventName.CALL_ACTIVITY_START),
                processLink("callActivityB", ActivityTypeWithEventName.CALL_ACTIVITY_START)
            )
        }
            .isInstanceOfSatisfying(ProcessDefinitionValidationException::class.java) { exception ->
                assertThat(exception.errors).extracting("elementId")
                    .containsExactly("callActivityA", "callActivityB")
            }
    }

    @Test
    fun `should fail the deployment for non-validation exceptions`() {
        doThrow(RuntimeException("Database unavailable"))
            .whenever(processLinkService).createProcessLink(any(), anyOrNull())

        assertThatThrownBy { deploy(processLink("serviceTask", ActivityTypeWithEventName.SERVICE_TASK_START)) }
            .isInstanceOf(RuntimeException::class.java)
            .isNotInstanceOf(ProcessDefinitionValidationException::class.java)
            .hasMessageContaining("Failed to create process links")
    }

    private fun deploy(vararg processLinks: TestProcessLinkCreateRequestDto) {
        processDeploymentService.deployProcessDefinitionAndProcessLinks(
            null,
            MockMultipartFile("file", "process.bpmn", "text/xml", BPMN_XML.toByteArray()),
            processLinks.toList(),
            null
        )
    }

    private fun processLink(activityId: String, activityType: ActivityTypeWithEventName) =
        TestProcessLinkCreateRequestDto(
            processDefinitionId = "-",
            activityId = activityId,
            activityType = activityType
        )

    private fun argThatActivity(expectedActivityId: String) =
        argThat<ProcessLinkCreateRequestDto> { activityId == expectedActivityId }

    companion object {
        private const val DEPLOYMENT_ID = "deployment-id"
        private const val PROCESS_DEFINITION_ID = "process-definition-id"

        private val BPMN_XML = """
            <?xml version="1.0" encoding="UTF-8"?>
            <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                              xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                              targetNamespace="http://valtimo.nl/test">
              <bpmn:process id="test-process" isExecutable="true">
                <bpmn:startEvent id="start" />
              </bpmn:process>
              <bpmndi:BPMNDiagram id="diagram">
                <bpmndi:BPMNPlane id="plane" bpmnElement="test-process" />
              </bpmndi:BPMNDiagram>
            </bpmn:definitions>
        """.trimIndent()
    }
}
