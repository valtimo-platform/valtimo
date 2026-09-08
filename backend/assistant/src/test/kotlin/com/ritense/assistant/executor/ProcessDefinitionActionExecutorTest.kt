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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.semver4j.Semver
import org.springframework.web.multipart.MultipartFile
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ProcessDefinitionActionExecutorTest {

    private lateinit var processDeploymentService: ProcessDeploymentService
    private lateinit var objectMapper: ObjectMapper
    private lateinit var executor: ProcessDefinitionActionExecutor

    @BeforeEach
    fun setUp() {
        processDeploymentService = mock()
        objectMapper = ObjectMapper()
        executor = ProcessDefinitionActionExecutor(processDeploymentService, objectMapper)
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
