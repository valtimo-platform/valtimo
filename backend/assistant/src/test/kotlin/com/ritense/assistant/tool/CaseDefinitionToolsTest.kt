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
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.service.DocumentDefinitionService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.TestingAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import java.time.Instant
import java.util.Optional
import java.util.UUID
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class CaseDefinitionToolsTest {

    private lateinit var caseDefinitionService: CaseDefinitionService
    private lateinit var documentDefinitionService: DocumentDefinitionService
    private lateinit var pendingActionService: PendingActionService
    private lateinit var objectMapper: ObjectMapper
    private lateinit var tools: CaseDefinitionTools

    private val sessionId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        caseDefinitionService = mock()
        documentDefinitionService = mock()
        pendingActionService = mock()
        objectMapper = ObjectMapper()

        tools = CaseDefinitionTools(
            caseDefinitionService,
            documentDefinitionService,
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
    fun `should list case definitions`() {
        setAdminAuthentication()
        val caseDefinitions = listOf(
            createCaseDefinition("loan-application", "1.0.0", "Loan Application", active = true, final = false),
            createCaseDefinition("support-ticket", "2.0.0", "Support Ticket", active = true, final = true)
        )
        whenever(caseDefinitionService.getCaseDefinitions(active = true)).thenReturn(caseDefinitions)

        val result = tools.listCaseDefinitions(activeOnly = true)

        assertContains(result, "loan-application")
        assertContains(result, "support-ticket")
        assertContains(result, "1.0.0")
        assertContains(result, "2.0.0")
    }

    @Test
    fun `should list all case definitions when activeOnly is false`() {
        setAdminAuthentication()
        val caseDefinitions = listOf(
            createCaseDefinition("loan-application", "1.0.0", "Loan", active = false, final = false)
        )
        whenever(caseDefinitionService.getCaseDefinitions()).thenReturn(caseDefinitions)

        val result = tools.listCaseDefinitions(activeOnly = false)

        assertContains(result, "loan-application")
        verify(caseDefinitionService).getCaseDefinitions()
    }

    @Test
    fun `should return message when no case definitions found`() {
        setAdminAuthentication()
        whenever(caseDefinitionService.getCaseDefinitions(active = true)).thenReturn(emptyList())

        val result = tools.listCaseDefinitions(activeOnly = true)

        assertEquals("No case definitions found.", result)
    }

    @Test
    fun `should get case definition by key`() {
        setAdminAuthentication()
        val caseDefinition = createCaseDefinition(
            key = "loan-application",
            version = "1.0.0",
            name = "Loan Application",
            active = true,
            final = false,
            description = "Process loan applications"
        )
        whenever(caseDefinitionService.getActiveCaseDefinition("loan-application")).thenReturn(caseDefinition)
        whenever(documentDefinitionService.findByNameAndCaseDefinitionId(any(), any())).thenReturn(Optional.empty())

        val result = tools.getCaseDefinition("loan-application", null)

        assertContains(result, "Loan Application")
        assertContains(result, "loan-application")
        assertContains(result, "1.0.0")
        assertContains(result, "Process loan applications")
    }

    @Test
    fun `should get case definition by key and version`() {
        setAdminAuthentication()
        val caseDefId = CaseDefinitionId("loan-application", "2.0.0")
        val caseDefinition = createCaseDefinition(
            key = "loan-application",
            version = "2.0.0",
            name = "Loan Application v2",
            active = true,
            final = false
        )
        whenever(caseDefinitionService.getCaseDefinition(caseDefId)).thenReturn(caseDefinition)
        whenever(documentDefinitionService.findByNameAndCaseDefinitionId(any(), any())).thenReturn(Optional.empty())

        val result = tools.getCaseDefinition("loan-application", "2.0.0")

        assertContains(result, "Loan Application v2")
        assertContains(result, "2.0.0")
    }

    @Test
    fun `should return not found message when case definition does not exist`() {
        setAdminAuthentication()
        whenever(caseDefinitionService.getActiveCaseDefinition("nonexistent")).thenReturn(null)

        val result = tools.getCaseDefinition("nonexistent", null)

        assertContains(result, "not found")
    }

    @Test
    fun `should preview case definition change`() {
        setAdminAuthentication()
        val caseDefinition = createCaseDefinition(
            key = "loan-application",
            version = "1.0.0",
            name = "Loan Application",
            active = true,
            final = false,
            description = "Old description"
        )
        val pendingAction = PendingAssistantAction(
            id = UUID.randomUUID(),
            sessionId = sessionId,
            userId = "user123",
            tool = "apply_case_definition_change",
            params = "{}",
            resourceType = "CaseDefinition",
            resourceId = "loan-application:1.0.0",
            createdAt = Instant.now(),
            expiresAt = Instant.now().plusSeconds(300)
        )

        whenever(caseDefinitionService.getCaseDefinition(any<CaseDefinitionId>())).thenReturn(caseDefinition)
        whenever(pendingActionService.createPendingAction(
            sessionId = eq(sessionId),
            userId = eq("user123"),
            tool = eq("apply_case_definition_change"),
            params = any(),
            resourceType = eq("CaseDefinition"),
            resourceId = eq("loan-application:1.0.0"),
            previewDescription = any(),
            diffBefore = any(),
            diffAfter = any(),
            affectedResources = any(),
            ttl = any()
        )).thenReturn(pendingAction)

        val changesJson = """{"name": "New Name", "description": "New description"}"""
        val result = tools.previewCaseDefinitionChange("loan-application", "1.0.0", changesJson)

        assertContains(result, "Preview")
        assertContains(result, "Loan Application")
        assertContains(result, "New Name")
        assertContains(result, "confirmation dialog")
    }

    @Test
    fun `should not create pending action when no changes detected`() {
        setAdminAuthentication()
        val caseDefinition = createCaseDefinition(
            key = "loan-application",
            version = "1.0.0",
            name = "Loan Application",
            active = true,
            final = false,
            description = "Description"
        )

        whenever(caseDefinitionService.getCaseDefinition(any<CaseDefinitionId>())).thenReturn(caseDefinition)

        val changesJson = """{"name": "Loan Application", "description": "Description"}"""
        val result = tools.previewCaseDefinitionChange("loan-application", "1.0.0", changesJson)

        assertContains(result, "No changes detected")
        verify(pendingActionService, never()).createPendingAction(
            any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()
        )
    }

    @Test
    fun `should reject modification of finalized case definition`() {
        setAdminAuthentication()
        val caseDefinition = createCaseDefinition(
            key = "loan-application",
            version = "1.0.0",
            name = "Loan Application",
            active = true,
            final = true
        )

        whenever(caseDefinitionService.getCaseDefinition(any<CaseDefinitionId>())).thenReturn(caseDefinition)

        val changesJson = """{"name": "New Name"}"""
        val result = tools.previewCaseDefinitionChange("loan-application", "1.0.0", changesJson)

        assertContains(result, "finalized")
        assertContains(result, "Cannot modify")
    }

    @Test
    fun `should reject non-admin user for listCaseDefinitions`() {
        setUserAuthentication()

        assertThrows<AccessDeniedException> {
            tools.listCaseDefinitions(activeOnly = true)
        }
    }

    @Test
    fun `should allow non-admin user for getCaseDefinition with authorization`() {
        setUserAuthentication()
        val caseDefinition = createCaseDefinition(
            key = "loan-application",
            version = "1.0.0",
            name = "Loan Application",
            active = true,
            final = false
        )
        whenever(caseDefinitionService.getActiveCaseDefinition("loan-application")).thenReturn(caseDefinition)
        whenever(documentDefinitionService.findByNameAndCaseDefinitionId(any(), any())).thenReturn(Optional.empty())

        val result = tools.getCaseDefinition("loan-application", null)

        assertContains(result, "Loan Application")
    }

    @Test
    fun `should reject non-admin user for previewCaseDefinitionChange`() {
        setUserAuthentication()

        assertThrows<AccessDeniedException> {
            tools.previewCaseDefinitionChange("loan-application", "1.0.0", "{}")
        }
    }

    @Test
    fun `should reject unauthenticated user`() {
        assertThrows<AccessDeniedException> {
            tools.listCaseDefinitions(activeOnly = true)
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

    private fun createCaseDefinition(
        key: String,
        version: String,
        name: String,
        active: Boolean,
        final: Boolean,
        description: String? = null
    ): CaseDefinition {
        return CaseDefinition(
            id = CaseDefinitionId(key, version),
            name = name,
            description = description,
            final = final,
            active = active,
            createdDate = null
        )
    }
}
