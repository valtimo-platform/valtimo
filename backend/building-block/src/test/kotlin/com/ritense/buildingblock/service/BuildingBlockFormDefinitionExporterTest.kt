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

package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.exporter.request.BuildingBlockFormDefinitionExportRequest
import com.ritense.form.domain.FormDefinitionBlueprintId
import com.ritense.form.domain.FormIoFormDefinition
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.eq
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class BuildingBlockFormDefinitionExporterTest(
    @Mock private val buildingBlockFormDefinitionService: BuildingBlockFormDefinitionService
) {
    private val objectMapper = ObjectMapper()
    private lateinit var exporter: BuildingBlockFormDefinitionExporter

    private val buildingBlockDefinitionId = BuildingBlockDefinitionId("my-building-block", "1.0.0")
    private val formDefinitionJson = """{"display": "form", "components": []}"""

    @BeforeEach
    fun setUp() {
        exporter = BuildingBlockFormDefinitionExporter(objectMapper, buildingBlockFormDefinitionService)
    }

    @Test
    fun `should support BuildingBlockFormDefinitionExportRequest`() {
        assertThat(exporter.supports()).isEqualTo(BuildingBlockFormDefinitionExportRequest::class.java)
    }

    @Test
    fun `should export form definition`() {
        val formId = UUID.randomUUID()
        val blueprintId = FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId)
        val form = FormIoFormDefinition(formId, "my-form", formDefinitionJson, blueprintId, false)

        whenever(
            buildingBlockFormDefinitionService.getFormDefinitionByName(
                eq(buildingBlockDefinitionId),
                eq("my-form")
            )
        ).thenReturn(Optional.of(form))

        val result = exporter.export(
            BuildingBlockFormDefinitionExportRequest(
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                formDefinitionName = "my-form"
            )
        )

        assertThat(result.exportFiles).hasSize(1)
        val exportFile = result.exportFiles.first()
        assertThat(exportFile.path).isEqualTo("config/building-block/my-building-block/1-0-0/form/my-form.form.json")

        val exportedContent = objectMapper.readTree(exportFile.content)
        assertThat(exportedContent.get("display").asText()).isEqualTo("form")
        assertThat(result.relatedRequests).isEmpty()
    }

    @Test
    fun `should export form definition with different version tag`() {
        val bbId = BuildingBlockDefinitionId("test-bb", "2.3.1")
        val formId = UUID.randomUUID()
        val blueprintId = FormDefinitionBlueprintId.forBuildingBlock(bbId)
        val form = FormIoFormDefinition(formId, "test-form", formDefinitionJson, blueprintId, false)

        whenever(
            buildingBlockFormDefinitionService.getFormDefinitionByName(
                eq(bbId),
                eq("test-form")
            )
        ).thenReturn(Optional.of(form))

        val result = exporter.export(
            BuildingBlockFormDefinitionExportRequest(
                buildingBlockDefinitionId = bbId,
                formDefinitionName = "test-form"
            )
        )

        assertThat(result.exportFiles).hasSize(1)
        val exportFile = result.exportFiles.first()
        assertThat(exportFile.path).isEqualTo("config/building-block/test-bb/2-3-1/form/test-form.form.json")
    }

    @Test
    fun `should throw when form definition not found`() {
        whenever(
            buildingBlockFormDefinitionService.getFormDefinitionByName(
                eq(buildingBlockDefinitionId),
                eq("non-existent")
            )
        ).thenReturn(Optional.empty())

        val exception = assertThrows<IllegalArgumentException> {
            exporter.export(
                BuildingBlockFormDefinitionExportRequest(
                    buildingBlockDefinitionId = buildingBlockDefinitionId,
                    formDefinitionName = "non-existent"
                )
            )
        }

        assertThat(exception.message).contains("Form definition 'non-existent' not found")
    }

    @Test
    fun `should export form with complex form definition`() {
        val complexFormDefinition = """
            {
                "display": "form",
                "components": [
                    {"type": "textfield", "key": "firstName", "label": "First Name"},
                    {"type": "textfield", "key": "lastName", "label": "Last Name"},
                    {"type": "email", "key": "email", "label": "Email"}
                ]
            }
        """.trimIndent()

        val formId = UUID.randomUUID()
        val blueprintId = FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId)
        val form = FormIoFormDefinition(formId, "complex-form", complexFormDefinition, blueprintId, false)

        whenever(
            buildingBlockFormDefinitionService.getFormDefinitionByName(
                eq(buildingBlockDefinitionId),
                eq("complex-form")
            )
        ).thenReturn(Optional.of(form))

        val result = exporter.export(
            BuildingBlockFormDefinitionExportRequest(
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                formDefinitionName = "complex-form"
            )
        )

        assertThat(result.exportFiles).hasSize(1)
        val exportedContent = objectMapper.readTree(result.exportFiles.first().content)
        assertThat(exportedContent.get("components").size()).isEqualTo(3)
        assertThat(exportedContent.get("components").get(0).get("type").asText()).isEqualTo("textfield")
    }
}
