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
import com.ritense.form.domain.FormIoFormDefinition
import com.ritense.form.domain.request.CreateFormDefinitionRequest
import com.ritense.form.domain.request.ModifyFormDefinitionRequest
import com.ritense.form.service.FormDefinitionService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argThat
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FormDefinitionActionExecutorTest {

    private lateinit var formDefinitionService: FormDefinitionService
    private lateinit var objectMapper: ObjectMapper
    private lateinit var executor: FormDefinitionActionExecutor

    @BeforeEach
    fun setUp() {
        formDefinitionService = mock()
        objectMapper = ObjectMapper()
        executor = FormDefinitionActionExecutor(formDefinitionService, objectMapper)
    }

    @Test
    fun `should execute form creation`() {
        val formId = UUID.randomUUID()
        val form = FormIoFormDefinition(formId, "new-form", """{"components":[]}""", null, false)
        whenever(formDefinitionService.createFormDefinition(any<CaseDefinitionId>(), any<CreateFormDefinitionRequest>()))
            .thenReturn(form)

        val params = """
            {
                "action": "create",
                "caseDefinitionKey": "loan-case",
                "versionTag": "1.0.0",
                "name": "new-form",
                "formDefinition": "{\"components\":[]}",
                "readOnly": false
            }
        """.trimIndent()

        val result = executor.execute(params, "user123")

        verify(formDefinitionService).createFormDefinition(
            eq(CaseDefinitionId("loan-case", "1.0.0")),
            argThat<CreateFormDefinitionRequest> { name == "new-form" }
        )
        assertTrue(result is Map<*, *>)
        assertEquals(true, (result as Map<*, *>)["success"])
        assertEquals("Form created successfully", result["message"])
    }

    @Test
    fun `should execute form modification`() {
        val formId = UUID.randomUUID()
        val form = FormIoFormDefinition(formId, "updated-form", """{"components":[]}""", null, false)
        whenever(formDefinitionService.modifyFormDefinition(any<CaseDefinitionId>(), any<ModifyFormDefinitionRequest>()))
            .thenReturn(form)

        val params = """
            {
                "action": "modify",
                "caseDefinitionKey": "loan-case",
                "versionTag": "1.0.0",
                "formId": "$formId",
                "name": "updated-form",
                "formDefinition": "{\"components\":[]}"
            }
        """.trimIndent()

        val result = executor.execute(params, "user123")

        verify(formDefinitionService).modifyFormDefinition(
            eq(CaseDefinitionId("loan-case", "1.0.0")),
            argThat<ModifyFormDefinitionRequest> { id == formId && name == "updated-form" }
        )
        assertTrue(result is Map<*, *>)
        assertEquals(true, (result as Map<*, *>)["success"])
        assertEquals("Form updated successfully", result["message"])
    }

    @Test
    fun `should execute form deletion`() {
        val formId = UUID.randomUUID()

        val params = """
            {
                "action": "delete",
                "caseDefinitionKey": "loan-case",
                "versionTag": "1.0.0",
                "formId": "$formId"
            }
        """.trimIndent()

        val result = executor.execute(params, "user123")

        verify(formDefinitionService).deleteFormDefinition(
            eq(CaseDefinitionId("loan-case", "1.0.0")),
            eq(formId)
        )
        assertTrue(result is Map<*, *>)
        assertEquals(true, (result as Map<*, *>)["success"])
        assertEquals("Form deleted successfully", result["message"])
    }

    @Test
    fun `should include form details in create result`() {
        val formId = UUID.randomUUID()
        val form = FormIoFormDefinition(formId, "my-form", """{"components":[]}""", null, false)
        whenever(formDefinitionService.createFormDefinition(any<CaseDefinitionId>(), any<CreateFormDefinitionRequest>()))
            .thenReturn(form)

        val params = """
            {
                "action": "create",
                "caseDefinitionKey": "loan-case",
                "versionTag": "1.0.0",
                "name": "my-form",
                "formDefinition": "{\"components\":[]}",
                "readOnly": false
            }
        """.trimIndent()

        val result = executor.execute(params, "user123") as Map<*, *>
        val formResult = result["form"] as Map<*, *>

        assertEquals(formId.toString(), formResult["id"])
        assertEquals("my-form", formResult["name"])
    }

    @Test
    fun `should propagate service exception`() {
        whenever(formDefinitionService.createFormDefinition(any<CaseDefinitionId>(), any<CreateFormDefinitionRequest>()))
            .thenThrow(RuntimeException("Form creation failed"))

        val params = """
            {
                "action": "create",
                "caseDefinitionKey": "loan-case",
                "versionTag": "1.0.0",
                "name": "test-form",
                "formDefinition": "{\"components\":[]}",
                "readOnly": false
            }
        """.trimIndent()

        assertThrows<RuntimeException> {
            executor.execute(params, "user123")
        }
    }

    @Test
    fun `should throw on invalid JSON params`() {
        assertThrows<Exception> {
            executor.execute("invalid json", "user123")
        }
    }

    @Test
    fun `should throw on unknown action type`() {
        val params = """
            {
                "action": "unknown",
                "caseDefinitionKey": "loan-case",
                "versionTag": "1.0.0"
            }
        """.trimIndent()

        val exception = assertThrows<IllegalArgumentException> {
            executor.execute(params, "user123")
        }
        assertTrue(exception.message?.contains("Unknown form action") == true)
    }

    @Test
    fun `should throw on missing action field`() {
        val params = """
            {
                "caseDefinitionKey": "loan-case",
                "versionTag": "1.0.0"
            }
        """.trimIndent()

        assertThrows<Exception> {
            executor.execute(params, "user123")
        }
    }
}
