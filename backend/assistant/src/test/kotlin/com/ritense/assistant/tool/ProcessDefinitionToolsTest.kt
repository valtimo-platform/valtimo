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

package com.ritense.assistant.tool

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.assistant.domain.PendingAssistantAction
import com.ritense.assistant.service.PendingActionService
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import org.operaton.bpm.engine.RepositoryService
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.TestingAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import java.time.Instant
import java.util.UUID
import kotlin.test.assertContains
import kotlin.test.assertEquals

class ProcessDefinitionToolsTest {

    private lateinit var operatonRepositoryService: OperatonRepositoryService
    private lateinit var repositoryService: RepositoryService
    private lateinit var pendingActionService: PendingActionService
    private lateinit var objectMapper: ObjectMapper
    private lateinit var tools: ProcessDefinitionTools

    private val sessionId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        operatonRepositoryService = mock()
        repositoryService = mock()
        pendingActionService = mock()
        objectMapper = ObjectMapper()

        tools = ProcessDefinitionTools(
            operatonRepositoryService,
            repositoryService,
            pendingActionService,
            objectMapper
        )

        val context = ToolContext(
            userId = "user123",
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_ADMIN"),
            authToken = "token",
            sessionId = sessionId
        )
        ToolContextHolder.set(context)
    }

    @AfterEach
    fun tearDown() {
        ToolContextHolder.clear()
        SecurityContextHolder.clearContext()
    }

    @Test
    fun `should list process definitions`() {
        setAdminAuthentication()
        val procDef1 = createMockProcessDefinition("loan-process", 1, "Loan Process")
        val procDef2 = createMockProcessDefinition("support-process", 2, "Support Process")

        whenever(operatonRepositoryService.findProcessDefinitions(any()))
            .thenReturn(listOf(procDef1, procDef2))

        val result = tools.listProcessDefinitions(latestOnly = true)

        assertContains(result, "loan-process")
        assertContains(result, "support-process")
        assertContains(result, "Loan Process")
    }

    @Test
    fun `should return message when no process definitions found`() {
        setAdminAuthentication()
        whenever(operatonRepositoryService.findProcessDefinitions(any())).thenReturn(emptyList())

        val result = tools.listProcessDefinitions(latestOnly = true)

        assertEquals("No process definitions found.", result)
    }

    @Test
    fun `should return not found when process definition does not exist`() {
        setAdminAuthentication()
        whenever(operatonRepositoryService.findProcessDefinition(any())).thenReturn(null)

        val result = tools.getProcessDefinition("nonexistent", null)

        assertContains(result, "not found")
    }

    @Test
    fun `should preview process definition change`() {
        setAdminAuthentication()
        val procDef = createMockProcessDefinition("loan-process", 1, "Loan Process")
        val pendingAction = PendingAssistantAction(
            id = UUID.randomUUID(),
            sessionId = sessionId,
            userId = "user123",
            tool = "apply_process_definition_change",
            params = "{}",
            resourceType = "ProcessDefinition",
            resourceId = "loan-process",
            createdAt = Instant.now(),
            expiresAt = Instant.now().plusSeconds(300)
        )

        whenever(operatonRepositoryService.findProcessDefinition(any())).thenReturn(procDef)
        whenever(pendingActionService.createPendingAction(
            sessionId = eq(sessionId),
            userId = eq("user123"),
            tool = eq("apply_process_definition_change"),
            params = any(),
            resourceType = eq("ProcessDefinition"),
            resourceId = eq("loan-process"),
            previewDescription = any(),
            diffBefore = any(),
            diffAfter = any(),
            affectedResources = any(),
            ttl = any()
        )).thenReturn(pendingAction)

        val bpmnXml = """<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions></bpmn:definitions>"""
        val result = tools.previewProcessDefinitionChange("loan-process", bpmnXml, null)

        assertContains(result, "Preview")
        assertContains(result, "loan-process")
        assertContains(result, "confirmation dialog")
    }

    @Test
    fun `should preview process definition with case link`() {
        setAdminAuthentication()
        val procDef = createMockProcessDefinition("loan-process", 1, "Loan Process")
        val pendingAction = PendingAssistantAction(
            id = UUID.randomUUID(),
            sessionId = sessionId,
            userId = "user123",
            tool = "apply_process_definition_change",
            params = "{}",
            resourceType = "ProcessDefinition",
            resourceId = "loan-process",
            createdAt = Instant.now(),
            expiresAt = Instant.now().plusSeconds(300)
        )

        whenever(operatonRepositoryService.findProcessDefinition(any())).thenReturn(procDef)
        whenever(pendingActionService.createPendingAction(
            sessionId = any(),
            userId = any(),
            tool = any(),
            params = any(),
            resourceType = any(),
            resourceId = any(),
            previewDescription = any(),
            diffBefore = any(),
            diffAfter = any(),
            affectedResources = any(),
            ttl = any()
        )).thenReturn(pendingAction)

        val bpmnXml = """<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions></bpmn:definitions>"""
        val result = tools.previewProcessDefinitionChange("loan-process", bpmnXml, "loan-case")

        assertContains(result, "loan-case")
    }

    @Test
    fun `should suggest BPMN patterns`() {
        setAdminAuthentication()

        val result = tools.suggestBpmnPattern("I need to add approval workflow")

        assertContains(result, "BPMN Pattern Suggestions")
        assertContains(result, "approval workflow")
    }

    @Test
    fun `should reject non-admin user for listProcessDefinitions`() {
        setUserAuthentication()

        assertThrows<AccessDeniedException> {
            tools.listProcessDefinitions(latestOnly = true)
        }
    }

    @Test
    fun `should reject non-admin user for getProcessDefinition`() {
        setUserAuthentication()

        assertThrows<AccessDeniedException> {
            tools.getProcessDefinition("loan-process", null)
        }
    }

    @Test
    fun `should reject non-admin user for previewProcessDefinitionChange`() {
        setUserAuthentication()

        assertThrows<AccessDeniedException> {
            tools.previewProcessDefinitionChange("loan-process", "<bpmn/>", null)
        }
    }

    @Test
    fun `should reject unauthenticated user`() {
        assertThrows<AccessDeniedException> {
            tools.listProcessDefinitions(latestOnly = true)
        }
    }

    private fun setAdminAuthentication() {
        val authorities = listOf(SimpleGrantedAuthority("ROLE_ADMIN"))
        val auth = TestingAuthenticationToken("user", "password", authorities)
        auth.isAuthenticated = true
        SecurityContextHolder.getContext().authentication = auth
    }

    private fun setUserAuthentication() {
        val authorities = listOf(SimpleGrantedAuthority("ROLE_USER"))
        val auth = TestingAuthenticationToken("user", "password", authorities)
        auth.isAuthenticated = true
        SecurityContextHolder.getContext().authentication = auth
    }

    private fun createMockProcessDefinition(
        key: String,
        version: Int,
        name: String?
    ): OperatonProcessDefinition {
        val procDef = mock<OperatonProcessDefinition>()
        whenever(procDef.key).thenReturn(key)
        whenever(procDef.version).thenReturn(version)
        whenever(procDef.name).thenReturn(name)
        whenever(procDef.id).thenReturn("$key:$version:123")
        return procDef
    }
}
