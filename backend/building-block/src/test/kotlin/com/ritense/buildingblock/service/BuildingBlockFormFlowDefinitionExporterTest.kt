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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.exporter.request.BuildingBlockFormDefinitionExportRequest
import com.ritense.exporter.request.BuildingBlockFormFlowDefinitionExportRequest
import com.ritense.formflow.domain.definition.FormFlowDefinition
import com.ritense.formflow.domain.definition.FormFlowDefinitionId
import com.ritense.formflow.domain.definition.FormFlowStep
import com.ritense.formflow.domain.definition.FormFlowStepId
import com.ritense.formflow.domain.definition.configuration.FormFlowStepType
import com.ritense.formflow.domain.definition.configuration.step.FormStepTypeProperties
import com.ritense.formflow.service.FormFlowService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.eq
import org.mockito.kotlin.whenever

@ExtendWith(MockitoExtension::class)
class BuildingBlockFormFlowDefinitionExporterTest(
    @Mock private val formFlowService: FormFlowService,
) {
    private val objectMapper = ObjectMapper()
    private lateinit var exporter: BuildingBlockFormFlowDefinitionExporter

    private val bbId = BuildingBlockDefinitionId("my-bb", "1.0.0")

    @BeforeEach
    fun setUp() {
        exporter = BuildingBlockFormFlowDefinitionExporter(objectMapper, formFlowService)
    }

    @Test
    fun `supports BuildingBlockFormFlowDefinitionExportRequest`() {
        assertThat(exporter.supports()).isEqualTo(BuildingBlockFormFlowDefinitionExportRequest::class.java)
    }

    @Test
    fun `export produces file at correct path`() {
        val definition = buildDefinition("my-flow")
        whenever(formFlowService.findDefinition(eq("my-flow"), eq(bbId))).thenReturn(definition)

        val result = exporter.export(BuildingBlockFormFlowDefinitionExportRequest("my-flow", bbId))

        assertThat(result.exportFiles).hasSize(1)
        assertThat(result.exportFiles.first().path)
            .isEqualTo("config/building-block/my-bb/1-0-0/form-flow/my-flow.form-flow.json")
    }

    @Test
    fun `export with different version tag produces correct path`() {
        val bbId231 = BuildingBlockDefinitionId("test-bb", "2.3.1")
        val definition = buildDefinition("my-flow", bbId231)
        whenever(formFlowService.findDefinition(eq("my-flow"), eq(bbId231))).thenReturn(definition)

        val result = exporter.export(BuildingBlockFormFlowDefinitionExportRequest("my-flow", bbId231))

        assertThat(result.exportFiles.first().path)
            .isEqualTo("config/building-block/test-bb/2-3-1/form-flow/my-flow.form-flow.json")
    }

    @Test
    fun `export with no form steps produces no related form requests`() {
        val definition = buildDefinition("my-flow")
        whenever(formFlowService.findDefinition(eq("my-flow"), eq(bbId))).thenReturn(definition)

        val result = exporter.export(BuildingBlockFormFlowDefinitionExportRequest("my-flow", bbId))

        assertThat(result.relatedRequests).isEmpty()
    }

    @Test
    fun `export with form steps produces related BuildingBlockFormDefinitionExportRequests`() {
        val step = FormFlowStep(
            FormFlowStepId("step-with-form"),
            listOf(),
            listOf(),
            listOf(),
            listOf(),
            type = FormFlowStepType("form", FormStepTypeProperties("my-form"))
        )
        val definition = buildDefinition("my-flow", steps = setOf(step))
        whenever(formFlowService.findDefinition(eq("my-flow"), eq(bbId))).thenReturn(definition)

        val result = exporter.export(BuildingBlockFormFlowDefinitionExportRequest("my-flow", bbId))

        assertThat(result.relatedRequests).containsExactly(
            BuildingBlockFormDefinitionExportRequest("my-form", bbId)
        )
    }

    @Test
    fun `export with multiple form steps produces one related request per form`() {
        val step1 = FormFlowStep(
            FormFlowStepId("step1"),
            listOf(), listOf(), listOf(), listOf(),
            type = FormFlowStepType("form", FormStepTypeProperties("form-a"))
        )
        val step2 = FormFlowStep(
            FormFlowStepId("step2"),
            listOf(), listOf(), listOf(), listOf(),
            type = FormFlowStepType("form", FormStepTypeProperties("form-b"))
        )
        val definition = buildDefinition("multi-step", steps = setOf(step1, step2))
        whenever(formFlowService.findDefinition(eq("multi-step"), eq(bbId))).thenReturn(definition)

        val result = exporter.export(BuildingBlockFormFlowDefinitionExportRequest("multi-step", bbId))

        assertThat(result.relatedRequests).hasSize(2)
        assertThat(result.relatedRequests.map { (it as BuildingBlockFormDefinitionExportRequest).formDefinitionName })
            .containsExactlyInAnyOrder("form-a", "form-b")
    }

    @Test
    fun `export with non-form step type produces no related form requests`() {
        // Use type name "custom-component" — the exporter only emits form requests for steps with type "form"
        val step = FormFlowStep(
            FormFlowStepId("custom-step"),
            listOf(), listOf(), listOf(), listOf(),
            type = FormFlowStepType("custom-component", FormStepTypeProperties("ignored"))
        )
        val definition = buildDefinition("my-flow", steps = setOf(step))
        whenever(formFlowService.findDefinition(eq("my-flow"), eq(bbId))).thenReturn(definition)

        val result = exporter.export(BuildingBlockFormFlowDefinitionExportRequest("my-flow", bbId))

        assertThat(result.relatedRequests).isEmpty()
    }

    private fun buildDefinition(
        key: String,
        buildingBlockDefinitionId: BuildingBlockDefinitionId = bbId,
        steps: Set<FormFlowStep> = emptySet(),
    ): FormFlowDefinition {
        val definitionId = FormFlowDefinitionId.existingId(key, buildingBlockDefinitionId)
        return FormFlowDefinition(definitionId, "start-step", steps)
    }
}
