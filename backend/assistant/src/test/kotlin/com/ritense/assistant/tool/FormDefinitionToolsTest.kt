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
import com.ritense.form.domain.FormIoFormDefinition
import com.ritense.form.service.FormDefinitionService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
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

class FormDefinitionToolsTest {

    private lateinit var formDefinitionService: FormDefinitionService
    private lateinit var pendingActionService: PendingActionService
    private lateinit var objectMapper: ObjectMapper
    private lateinit var tools: FormDefinitionTools

    private val sessionId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        formDefinitionService = mock()
        pendingActionService = mock()
        objectMapper = ObjectMapper()

        tools = FormDefinitionTools(
            formDefinitionService,
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
    fun `should list forms for case definition`() {
        setAdminAuthentication()
        val forms = listOf(
            createFormDefinition("contact-form", """{"components":[]}"""),
            createFormDefinition("application-form", """{"components":[{"type":"textfield","key":"name"}]}""")
        )
        whenever(formDefinitionService.getFormDefinitions(any<CaseDefinitionId>())).thenReturn(forms)

        val result = tools.listForms("loan-application", "1.0.0", null)

        assertContains(result, "contact-form")
        assertContains(result, "application-form")
    }

    @Test
    fun `should filter forms by search term`() {
        setAdminAuthentication()
        val forms = listOf(
            createFormDefinition("contact-form", """{"components":[]}"""),
            createFormDefinition("application-form", """{"components":[]}""")
        )
        whenever(formDefinitionService.getFormDefinitions(any<CaseDefinitionId>())).thenReturn(forms)

        val result = tools.listForms("loan-application", "1.0.0", "contact")

        assertContains(result, "contact-form")
        assert(!result.contains("application-form"))
    }

    @Test
    fun `should return message when no forms found`() {
        setAdminAuthentication()
        whenever(formDefinitionService.getFormDefinitions(any<CaseDefinitionId>())).thenReturn(emptyList())

        val result = tools.listForms("loan-application", "1.0.0", null)

        assertContains(result, "No forms found")
    }

    @Test
    fun `should get form definition by name`() {
        setAdminAuthentication()
        val formDefinition = """{"components":[{"type":"textfield","key":"email","label":"Email"}]}"""
        val form = createFormDefinition("contact-form", formDefinition)
        whenever(formDefinitionService.getFormDefinitionByName(eq("contact-form"), any<CaseDefinitionId>()))
            .thenReturn(Optional.of(form))

        val result = tools.getFormDefinition("loan-application", "1.0.0", "contact-form")

        assertContains(result, "contact-form")
        assertContains(result, "email")
    }

    @Test
    fun `should get form definition by UUID`() {
        setAdminAuthentication()
        val formDefinition = """{"components":[{"type":"textfield","key":"name"}]}"""
        val formId = UUID.randomUUID()
        val form = createFormDefinition("my-form", formDefinition, formId = formId)
        whenever(formDefinitionService.getFormDefinitionById(any<CaseDefinitionId>(), any<UUID>()))
            .thenReturn(Optional.of(form))

        val result = tools.getFormDefinition("loan-application", "1.0.0", formId.toString())

        assertContains(result, "my-form")
        assertContains(result, "name")
    }

    @Test
    fun `should return not found when form does not exist`() {
        setAdminAuthentication()
        whenever(formDefinitionService.getFormDefinitionByName(any(), any<CaseDefinitionId>()))
            .thenReturn(Optional.empty())

        val result = tools.getFormDefinition("loan-application", "1.0.0", "nonexistent")

        assertContains(result, "not found")
    }

    @Test
    fun `should preview create form`() {
        setAdminAuthentication()
        whenever(formDefinitionService.getFormDefinitionByName(any(), any<CaseDefinitionId>()))
            .thenReturn(Optional.empty())
        val pendingAction = createPendingAction()
        whenever(pendingActionService.createPendingAction(
            sessionId = eq(sessionId),
            userId = eq("user123"),
            tool = eq("apply_form_definition_change"),
            params = any(),
            resourceType = eq("FormDefinition"),
            resourceId = any(),
            previewDescription = any(),
            diffBefore = any(),
            diffAfter = any(),
            affectedResources = any(),
            ttl = any()
        )).thenReturn(pendingAction)

        val formJson = """{"components":[{"type":"textfield","key":"email"}]}"""
        val result = tools.previewCreateForm("loan-application", "1.0.0", "new-form", formJson, false)

        assertContains(result, "Preview")
        assertContains(result, "new-form")
        assertContains(result, "confirmation dialog")
    }

    @Test
    fun `should reject create when form name exists`() {
        setAdminAuthentication()
        val existingForm = createFormDefinition("existing-form", """{"components":[]}""")
        whenever(formDefinitionService.getFormDefinitionByName(eq("existing-form"), any<CaseDefinitionId>()))
            .thenReturn(Optional.of(existingForm))

        val formJson = """{"components":[]}"""
        val result = tools.previewCreateForm("loan-application", "1.0.0", "existing-form", formJson, null)

        assertContains(result, "already exists")
    }

    @Test
    fun `should reject create with invalid JSON`() {
        setAdminAuthentication()
        whenever(formDefinitionService.getFormDefinitionByName(any(), any<CaseDefinitionId>()))
            .thenReturn(Optional.empty())

        val result = tools.previewCreateForm("loan-application", "1.0.0", "new-form", "not-json", null)

        assertContains(result, "Invalid FormIO JSON")
    }

    @Test
    fun `should preview modify form`() {
        setAdminAuthentication()
        val form = createFormDefinition("old-name", """{"components":[{"type":"textfield","key":"field1"}]}""")
        whenever(formDefinitionService.getFormDefinitionByName(eq("old-name"), any<CaseDefinitionId>()))
            .thenReturn(Optional.of(form))
        val pendingAction = createPendingAction()
        whenever(pendingActionService.createPendingAction(
            sessionId = eq(sessionId),
            userId = eq("user123"),
            tool = eq("apply_form_definition_change"),
            params = any(),
            resourceType = eq("FormDefinition"),
            resourceId = any(),
            previewDescription = any(),
            diffBefore = any(),
            diffAfter = any(),
            affectedResources = any(),
            ttl = any()
        )).thenReturn(pendingAction)

        val newFormJson = """{"components":[{"type":"textfield","key":"field2"}]}"""
        val result = tools.previewModifyForm("loan-application", "1.0.0", "old-name", "new-name", newFormJson)

        assertContains(result, "Preview")
        assertContains(result, "old-name")
        assertContains(result, "new-name")
        assertContains(result, "confirmation dialog")
    }

    @Test
    fun `should reject modify when no changes specified`() {
        setAdminAuthentication()
        val form = createFormDefinition("my-form", """{"components":[]}""")
        whenever(formDefinitionService.getFormDefinitionByName(eq("my-form"), any<CaseDefinitionId>()))
            .thenReturn(Optional.of(form))

        val result = tools.previewModifyForm("loan-application", "1.0.0", "my-form", null, null)

        assertContains(result, "No changes specified")
    }

    @Test
    fun `should reject modify read-only form`() {
        setAdminAuthentication()
        val form = createFormDefinition("readonly-form", """{"components":[]}""", readOnly = true)
        whenever(formDefinitionService.getFormDefinitionByName(eq("readonly-form"), any<CaseDefinitionId>()))
            .thenReturn(Optional.of(form))

        val result = tools.previewModifyForm("loan-application", "1.0.0", "readonly-form", "new-name", null)

        assertContains(result, "read-only")
    }

    @Test
    fun `should preview delete form`() {
        setAdminAuthentication()
        val form = createFormDefinition("to-delete", """{"components":[{"type":"textfield","key":"name"}]}""")
        whenever(formDefinitionService.getFormDefinitionByName(eq("to-delete"), any<CaseDefinitionId>()))
            .thenReturn(Optional.of(form))
        val pendingAction = createPendingAction()
        whenever(pendingActionService.createPendingAction(
            sessionId = eq(sessionId),
            userId = eq("user123"),
            tool = eq("apply_form_definition_change"),
            params = any(),
            resourceType = eq("FormDefinition"),
            resourceId = any(),
            previewDescription = any(),
            diffBefore = any(),
            diffAfter = any(),
            affectedResources = any(),
            ttl = any()
        )).thenReturn(pendingAction)

        val result = tools.previewDeleteForm("loan-application", "1.0.0", "to-delete")

        assertContains(result, "Preview")
        assertContains(result, "to-delete")
        assertContains(result, "confirmation dialog")
    }

    @Test
    fun `should reject delete read-only form`() {
        setAdminAuthentication()
        val form = createFormDefinition("readonly-form", """{"components":[]}""", readOnly = true)
        whenever(formDefinitionService.getFormDefinitionByName(eq("readonly-form"), any<CaseDefinitionId>()))
            .thenReturn(Optional.of(form))

        val result = tools.previewDeleteForm("loan-application", "1.0.0", "readonly-form")

        assertContains(result, "read-only")
    }

    @Test
    fun `should reject non-admin user for listForms`() {
        setUserAuthentication()

        assertThrows<AccessDeniedException> {
            tools.listForms("loan-application", "1.0.0", null)
        }
    }

    @Test
    fun `should reject non-admin user for getFormDefinition`() {
        setUserAuthentication()

        assertThrows<AccessDeniedException> {
            tools.getFormDefinition("loan-application", "1.0.0", "form")
        }
    }

    @Test
    fun `should reject non-admin user for previewCreateForm`() {
        setUserAuthentication()

        assertThrows<AccessDeniedException> {
            tools.previewCreateForm("loan-application", "1.0.0", "form", "{}", null)
        }
    }

    @Test
    fun `should reject unauthenticated user`() {
        assertThrows<AccessDeniedException> {
            tools.listForms("loan-application", "1.0.0", null)
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

    private fun createFormDefinition(
        name: String,
        formDefinitionJson: String,
        readOnly: Boolean = false,
        formId: UUID = UUID.randomUUID()
    ): FormIoFormDefinition {
        return FormIoFormDefinition(
            formId,
            name,
            formDefinitionJson,
            null,
            readOnly
        )
    }

    private fun createPendingAction(): PendingAssistantAction {
        return PendingAssistantAction(
            id = UUID.randomUUID(),
            sessionId = sessionId,
            userId = "user123",
            tool = "apply_form_definition_change",
            params = "{}",
            resourceType = "FormDefinition",
            resourceId = "form",
            createdAt = Instant.now(),
            expiresAt = Instant.now().plusSeconds(300)
        )
    }
}
