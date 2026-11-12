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

package com.ritense.assistant.executor

import com.fasterxml.jackson.annotation.JsonTypeName
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.jsontype.NamedType
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinitionId
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.processlink.web.rest.dto.ProcessLinkExportResponseDto
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.semver4j.Semver
import org.springframework.data.domain.Sort
import org.springframework.web.multipart.MultipartFile
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ProcessDefinitionActionExecutorTest {

    private lateinit var processDeploymentService: ProcessDeploymentService
    private lateinit var operatonRepositoryService: OperatonRepositoryService
    private lateinit var processLinkService: ProcessLinkService
    private lateinit var caseLinkService: ProcessDefinitionCaseDefinitionService
    private lateinit var linkMapper: ProcessLinkMapper
    private lateinit var objectMapper: ObjectMapper
    private lateinit var executor: ProcessDefinitionActionExecutor

    @BeforeEach
    fun setUp() {
        processDeploymentService = mock()
        operatonRepositoryService = mock()
        processLinkService = mock()
        caseLinkService = mock()
        linkMapper = mock()
        objectMapper = ObjectMapper().registerKotlinModule()
        objectMapper.registerSubtypes(NamedType(TestDeployDto::class.java, "test"))
        whenever(operatonRepositoryService.findProcessDefinitions(any(), any<Sort>())).thenReturn(emptyList())
        whenever(processLinkService.getProcessLinkMapper("test")).thenReturn(linkMapper)
        executor = ProcessDefinitionActionExecutor(
            processDeploymentService,
            operatonRepositoryService,
            processLinkService,
            caseLinkService,
            objectMapper
        )
    }

    @JsonTypeName("test")
    data class TestDeployDto(
        override val processDefinitionId: String,
        override val activityId: String,
        override val activityType: ActivityTypeWithEventName,
        override val processLinkType: String = "test"
    ) : ProcessLinkDeployDto

    data class TestExportDto(
        override val activityId: String,
        override val activityType: ActivityTypeWithEventName,
        override val processLinkType: String = "test"
    ) : ProcessLinkExportResponseDto

    private fun processDefinition(id: String, version: Int): OperatonProcessDefinition {
        val definition = mock<OperatonProcessDefinition>()
        whenever(definition.id).thenReturn(id)
        whenever(definition.version).thenReturn(version)
        return definition
    }

    private fun caseLink(processDefinitionId: String, caseId: CaseDefinitionId, canInit: Boolean, startable: Boolean) =
        ProcessDefinitionCaseDefinition(
            ProcessDefinitionCaseDefinitionId(ProcessDefinitionId(processDefinitionId), caseId),
            canInit,
            startable
        )

    private fun processLink(activityId: String): ProcessLink {
        val link = mock<ProcessLink>()
        whenever(link.activityId).thenReturn(activityId)
        whenever(link.processLinkType).thenReturn("test")
        whenever(linkMapper.toProcessLinkExportResponseDto(link))
            .thenReturn(TestExportDto(activityId, ActivityTypeWithEventName.USER_TASK_CREATE))
        return link
    }

    private fun bpmnWithTask(taskId: String) = """<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="case-messaging" isExecutable="true"><bpmn:userTask id="$taskId"/></bpmn:process>
</bpmn:definitions>"""

    private fun executeParams(bpmnXml: String, caseDefinitionKey: String? = null) = objectMapper.writeValueAsString(
        listOfNotNull(
            "processDefinitionKey" to "case-messaging",
            "bpmnXml" to bpmnXml,
            caseDefinitionKey?.let { "caseDefinitionKey" to it }
        ).toMap()
    )

    @Test
    fun `should use case id and flags from the existing case link`() {
        val caseId = CaseDefinitionId("case-messaging", "2.3.0")
        val v1 = processDefinition("pd:1", 1)
        val link = caseLink("pd:1", caseId, true, true)
        whenever(operatonRepositoryService.findProcessDefinitions(any(), any<Sort>())).thenReturn(listOf(v1))
        whenever(operatonRepositoryService.findProcessDefinition(any())).thenReturn(v1)
        whenever(caseLinkService.findByProcessDefinitionIdOrNull(ProcessDefinitionId("pd:1"))).thenReturn(link)

        executor.execute(executeParams(bpmnWithTask("Task_1"), "other-case"), "user123")

        verify(processDeploymentService).deployProcessDefinitionAndProcessLinksForCaseDefinition(
            eq(caseId), any(), eq(emptyList()), isNull(), eq(true), eq(true)
        )
    }

    @Test
    fun `should fall back to the case link of an older version`() {
        val caseId = CaseDefinitionId("case-messaging", "1.0.0")
        val versions = listOf(processDefinition("pd:3", 3), processDefinition("pd:2", 2), processDefinition("pd:1", 1))
        val link = caseLink("pd:1", caseId, true, true)
        whenever(operatonRepositoryService.findProcessDefinitions(any(), any<Sort>())).thenReturn(versions)
        whenever(operatonRepositoryService.findProcessDefinition(any())).thenReturn(versions.first())
        whenever(caseLinkService.findByProcessDefinitionIdOrNull(any())).thenReturn(null)
        whenever(caseLinkService.findByProcessDefinitionIdOrNull(ProcessDefinitionId("pd:1"))).thenReturn(link)

        executor.execute(executeParams(bpmnWithTask("Task_1")), "user123")

        verify(processDeploymentService).deployProcessDefinitionAndProcessLinksForCaseDefinition(
            eq(caseId), any(), any(), isNull(), eq(true), eq(true)
        )
    }

    @Test
    fun `should carry over existing links and drop links of removed activities`() {
        val current = processDefinition("pd:2", 2)
        whenever(operatonRepositoryService.findProcessDefinitions(any(), any<Sort>())).thenReturn(listOf(current))
        whenever(operatonRepositoryService.findProcessDefinition(any())).thenReturn(current)
        val kept = processLink("Task_1")
        val removed = processLink("Task_gone")
        whenever(processLinkService.getProcessLinks("pd:2")).thenReturn(listOf(kept, removed))
        val createDto = mock<ProcessLinkCreateRequestDto>()
        val deployCaptor = argumentCaptor<ProcessLinkDeployDto>()
        whenever(linkMapper.toProcessLinkCreateRequestDto(deployCaptor.capture(), anyOrNull())).thenReturn(createDto)

        executor.execute(executeParams(bpmnWithTask("Task_1")), "user123")

        assertEquals(1, deployCaptor.allValues.size)
        assertEquals("pd:2", deployCaptor.firstValue.processDefinitionId)
        assertEquals("Task_1", deployCaptor.firstValue.activityId)
        verify(processDeploymentService).deployProcessDefinitionAndProcessLinks(
            isNull(), any(), eq(listOf(createDto)), isNull(), any()
        )
    }

    @Test
    fun `should keep current behaviour for a new process with only a case definition key`() {
        executor.execute(executeParams(bpmnWithTask("Task_1"), "loan-case"), "user123")

        verify(processDeploymentService).deployProcessDefinitionAndProcessLinksForCaseDefinition(
            eq(CaseDefinitionId("loan-case", Semver("1.0.0"))), any(), eq(emptyList()), isNull(), eq(false), eq(false)
        )
    }

    @Test
    fun `should deploy process definition without case link`() {
        val bpmnXml = "<bpmn/>"
        val params = objectMapper.writeValueAsString(
            mapOf("processDefinitionKey" to "loan-process", "bpmnXml" to bpmnXml)
        )
        val captor = argumentCaptor<MultipartFile>()

        val result = executor.execute(params, "user123")

        verify(processDeploymentService).deployProcessDefinitionAndProcessLinks(
            isNull(),
            captor.capture(),
            eq(emptyList()),
            isNull(),
            any()
        )
        assertEquals("loan-process.bpmn", captor.firstValue.originalFilename)
        assertTrue(result is Map<*, *>)
        assertEquals(true, (result as Map<*, *>)["success"])
        assertEquals("loan-process", result["processDefinitionKey"])
    }

    @Test
    fun `should deploy process definition with case link`() {
        val bpmnXml = "<bpmn/>"
        val params = objectMapper.writeValueAsString(
            mapOf(
                "processDefinitionKey" to "loan-process",
                "bpmnXml" to bpmnXml,
                "caseDefinitionKey" to "loan-case"
            )
        )
        val captor = argumentCaptor<MultipartFile>()
        val expectedCaseDefId = CaseDefinitionId("loan-case", Semver("1.0.0"))

        val result = executor.execute(params, "user123")

        verify(processDeploymentService).deployProcessDefinitionAndProcessLinksForCaseDefinition(
            eq(expectedCaseDefId),
            captor.capture(),
            eq(emptyList()),
            isNull(),
            eq(false),
            eq(false)
        )
        assertEquals("loan-process.bpmn", captor.firstValue.originalFilename)
        assertTrue(result is Map<*, *>)
        assertEquals(true, (result as Map<*, *>)["success"])
    }

    @Test
    fun `should include success message in result`() {
        val params = objectMapper.writeValueAsString(
            mapOf("processDefinitionKey" to "support-process", "bpmnXml" to "<bpmn/>")
        )

        val result = executor.execute(params, "user123") as Map<*, *>

        assertEquals("Process definition deployed successfully", result["message"])
        assertEquals("support-process", result["processDefinitionKey"])
    }

    @Test
    fun `should propagate deployment service exception`() {
        whenever(processDeploymentService.deployProcessDefinitionAndProcessLinks(
            isNull(), any<MultipartFile>(), any(), isNull(), any()
        )).thenThrow(RuntimeException("Invalid BPMN"))

        val params = objectMapper.writeValueAsString(
            mapOf("processDefinitionKey" to "bad-process", "bpmnXml" to "invalid xml")
        )

        assertThrows<RuntimeException> {
            executor.execute(params, "user123")
        }
    }

    @Test
    fun `should throw on invalid JSON params`() {
        assertThrows<Exception> {
            executor.execute("not json", "user123")
        }
    }

    @Test
    fun `should throw on missing processDefinitionKey`() {
        val params = objectMapper.writeValueAsString(mapOf("bpmnXml" to "<bpmn/>"))

        assertThrows<Exception> {
            executor.execute(params, "user123")
        }
    }

    @Test
    fun `should throw on missing bpmnXml`() {
        val params = objectMapper.writeValueAsString(mapOf("processDefinitionKey" to "test"))

        assertThrows<Exception> {
            executor.execute(params, "user123")
        }
    }

    @Test
    fun `should create bpmn file with correct content`() {
        val bpmnXml = "<definitions/>"
        val params = objectMapper.writeValueAsString(
            mapOf("processDefinitionKey" to "my-process", "bpmnXml" to bpmnXml)
        )
        val captor = argumentCaptor<MultipartFile>()

        executor.execute(params, "user123")

        verify(processDeploymentService).deployProcessDefinitionAndProcessLinks(
            isNull(),
            captor.capture(),
            eq(emptyList()),
            isNull(),
            any()
        )
        assertEquals(bpmnXml, String(captor.firstValue.bytes))
        assertEquals("application/xml", captor.firstValue.contentType)
    }
}
