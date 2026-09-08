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
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.semver4j.Semver
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class CaseDefinitionActionExecutorTest {

    private lateinit var caseDefinitionService: CaseDefinitionService
    private lateinit var objectMapper: ObjectMapper
    private lateinit var executor: CaseDefinitionActionExecutor

    @BeforeEach
    fun setUp() {
        caseDefinitionService = mock()
        objectMapper = ObjectMapper()
        executor = CaseDefinitionActionExecutor(caseDefinitionService, objectMapper)
    }

    @Test
    fun `should execute case definition update`() {
        val caseDefId = CaseDefinitionId("loan-case", Semver("1.0.0"))
        val caseDef = createMockCaseDefinition(caseDefId, "Loan Application", "Handles loans")
        whenever(caseDefinitionService.updateCaseDefinition(any(), any(), any())).thenReturn(caseDef)

        val params = """
            {
                "caseDefinitionKey": "loan-case",
                "versionTag": "1.0.0",
                "name": "Loan Application",
                "description": "Handles loans"
            }
        """.trimIndent()

        val result = executor.execute(params, "user123")

        verify(caseDefinitionService).updateCaseDefinition(
            eq(caseDefId),
            eq("Loan Application"),
            eq("Handles loans")
        )
        assertTrue(result is Map<*, *>)
        assertEquals(true, (result as Map<*, *>)["success"])
    }

    @Test
    fun `should execute update with null name and description`() {
        val caseDefId = CaseDefinitionId("loan-case", Semver("1.0.0"))
        val caseDef = createMockCaseDefinition(caseDefId, null, null)
        whenever(caseDefinitionService.updateCaseDefinition(any(), isNull(), isNull())).thenReturn(caseDef)

        val params = """
            {
                "caseDefinitionKey": "loan-case",
                "versionTag": "1.0.0"
            }
        """.trimIndent()

        val result = executor.execute(params, "user123")

        verify(caseDefinitionService).updateCaseDefinition(eq(caseDefId), isNull(), isNull())
        assertTrue(result is Map<*, *>)
    }

    @Test
    fun `should include case definition details in result`() {
        val caseDefId = CaseDefinitionId("loan-case", Semver("1.0.0"))
        val caseDef = createMockCaseDefinition(caseDefId, "Updated Name", "Updated description")
        whenever(caseDefinitionService.updateCaseDefinition(any(), any(), any())).thenReturn(caseDef)

        val params = """
            {
                "caseDefinitionKey": "loan-case",
                "versionTag": "1.0.0",
                "name": "Updated Name",
                "description": "Updated description"
            }
        """.trimIndent()

        val result = executor.execute(params, "user123") as Map<*, *>
        val caseDefinition = result["caseDefinition"] as Map<*, *>

        assertEquals("loan-case", caseDefinition["key"])
        assertEquals("1.0.0", caseDefinition["versionTag"])
        assertEquals("Updated Name", caseDefinition["name"])
        assertEquals("Updated description", caseDefinition["description"])
    }

    @Test
    fun `should propagate service exception`() {
        whenever(caseDefinitionService.updateCaseDefinition(any(), any(), any()))
            .thenThrow(RuntimeException("Case definition not found"))

        val params = """
            {
                "caseDefinitionKey": "nonexistent",
                "versionTag": "1.0.0",
                "name": "Test"
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
    fun `should throw on missing required params`() {
        val params = """{"name": "Test"}"""

        assertThrows<Exception> {
            executor.execute(params, "user123")
        }
    }

    private fun createMockCaseDefinition(
        id: CaseDefinitionId,
        name: String?,
        description: String?
    ): CaseDefinition {
        val caseDef = mock<CaseDefinition>()
        whenever(caseDef.id).thenReturn(id)
        whenever(caseDef.name).thenReturn(name)
        whenever(caseDef.description).thenReturn(description)
        return caseDef
    }
}
