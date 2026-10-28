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

package com.ritense.formflow.service

import com.ritense.form.domain.FormDefinitionBlueprintId
import com.ritense.form.domain.FormIoFormDefinition
import com.ritense.form.service.impl.FormIoFormDefinitionService
import com.ritense.formflow.domain.definition.FormFlowDefinitionBlueprintId
import com.ritense.formflow.domain.definition.configuration.step.FormStepTypeProperties
import com.ritense.formflow.domain.instance.FormFlowInstance
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import org.junit.jupiter.api.Test
import org.mockito.Answers.RETURNS_DEEP_STUBS
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals

internal class FormFlowValtimoServiceTest {

    private val caseDefinitionId = CaseDefinitionId.of("profile", "1.0.0")
    private val formDefinitionService: FormIoFormDefinitionService = mock()
    private val formFlowValtimoService = FormFlowValtimoService(
        formDefinitionService,
        MapperSingleton.get(),
        mock(),
        mock()
    )

    @Test
    fun `should filter display-only components from submissionData`() {
        val formFlowInstance = mock<FormFlowInstance>(defaultAnswer = RETURNS_DEEP_STUBS)
        whenever(formFlowInstance.getCurrentStep().definition.type.properties)
            .thenReturn(FormStepTypeProperties("my-form"))
        whenever(formFlowInstance.formFlowDefinition.id.blueprintId)
            .thenReturn(FormFlowDefinitionBlueprintId.of(caseDefinitionId))
        whenever(formDefinitionService.getFormDefinitionByName(eq("my-form"), any<BlueprintId>()))
            .thenReturn(Optional.of(formDefinition()))
        val submissionData = MapperSingleton.get().readTree(
            """
                {
                  "person": { "firstName": "Henk" },
                  "mailPreview": "<img src=x onerror=alert(1)>"
                }
            """
        )

        val filteredSubmissionData = formFlowValtimoService.getVerifiedSubmissionData(submissionData, formFlowInstance)

        assertEquals("""{"person":{"firstName":"Henk"}}""", filteredSubmissionData.toString())
    }

    @Test
    fun `should filter nested display-only components from submissionData`() {
        assertEquals(
            """{"person":{"firstName":"Henk","children":[{"name":"a"}]},"address":{"street":"b"}}""",
            verifiedNested(formFlowValtimoService).toString()
        )
    }

    @Test
    fun `should filter nested display-only components when submission data filtering is disabled`() {
        val service = FormFlowValtimoService(formDefinitionService, MapperSingleton.get(), mock(), mock(), false)
        val result = verifiedNested(service)
        assertEquals(false, result.toString().contains("Preview"))
        assertEquals("b", result.at("/address/street").asText())
    }

    private fun verifiedNested(service: FormFlowValtimoService): com.fasterxml.jackson.databind.JsonNode {
        val formFlowInstance = mock<FormFlowInstance>(defaultAnswer = RETURNS_DEEP_STUBS)
        whenever(formFlowInstance.getCurrentStep().definition.type.properties)
            .thenReturn(FormStepTypeProperties("my-form"))
        whenever(formFlowInstance.formFlowDefinition.id.blueprintId)
            .thenReturn(FormFlowDefinitionBlueprintId.of(caseDefinitionId))
        whenever(formDefinitionService.getFormDefinitionByName(eq("my-form"), any<BlueprintId>()))
            .thenReturn(Optional.of(nestedFormDefinition()))
        val submissionData = MapperSingleton.get().readTree(
            """
                {
                  "person": { "firstName": "Henk", "children": [ { "name": "a", "childPreview": "<img src=x>" } ] },
                  "address": { "street": "b", "addressPreview": "<img src=x>" }
                }
            """
        )
        return requireNotNull(service.getVerifiedSubmissionData(submissionData, formFlowInstance))
    }

    private fun nestedFormDefinition() = FormIoFormDefinition(
        UUID.randomUUID(),
        "my-form",
        """
            {
              "display": "form",
              "components": [
                { "key": "person.firstName", "type": "textfield", "input": true },
                { "key": "person.children", "type": "datagrid", "input": true, "components": [
                  { "key": "name", "type": "textfield", "input": true },
                  { "key": "childPreview", "type": "valtimo-mail-preview", "input": true }
                ]},
                { "key": "address", "type": "container", "input": true, "components": [
                  { "key": "street", "type": "textfield", "input": true },
                  { "key": "addressPreview", "type": "valtimo-mail-preview", "input": true }
                ]}
              ]
            }
        """,
        FormDefinitionBlueprintId.forCase(caseDefinitionId),
        false
    )

    private fun formDefinition() = FormIoFormDefinition(
        UUID.randomUUID(),
        "my-form",
        """
            {
              "display": "form",
              "components": [
                { "key": "person.firstName", "type": "textfield", "input": true },
                { "key": "mailPreview", "type": "valtimo-mail-preview", "input": true }
              ]
            }
        """,
        FormDefinitionBlueprintId.forCase(caseDefinitionId),
        false
    )
}
