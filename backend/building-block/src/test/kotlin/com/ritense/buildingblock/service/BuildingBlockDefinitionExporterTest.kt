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
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.service.DocumentDefinitionService
import com.ritense.exporter.request.BuildingBlockDecisionDefinitionExportRequest
import com.ritense.exporter.request.BuildingBlockDefinitionExportRequest
import com.ritense.exporter.request.BuildingBlockDocumentDefinitionExportRequest
import com.ritense.form.repository.FormDefinitionRepository
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.never
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.mockito.kotlin.verify
import org.operaton.bpm.engine.repository.DecisionDefinition
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class BuildingBlockDefinitionExporterTest(
    @Mock private val repository: BuildingBlockDefinitionRepository,
    @Mock private val documentDefinitionService: DocumentDefinitionService,
    @Mock private val formDefinitionRepository: FormDefinitionRepository,
    @Mock private val buildingBlockDecisionService: BuildingBlockDecisionService,
) {

    private val objectMapper = ObjectMapper()
    private lateinit var exporter: BuildingBlockDefinitionExporter

    private val buildingBlockDefinitionId = BuildingBlockDefinitionId("bb-key", "1.2.3")

    @BeforeEach
    fun setUp() {
        exporter = BuildingBlockDefinitionExporter(
            objectMapper, repository, documentDefinitionService, formDefinitionRepository, buildingBlockDecisionService
        )
    }

    @Test
    fun `should export definition and include document definition request`() {
        val definition = BuildingBlockDefinition(
            id = buildingBlockDefinitionId,
            name = "Test building block",
            description = "Description"
        )

        val documentDefinitionId = JsonSchemaDocumentDefinitionId.forBuildingBlock("document-definition", buildingBlockDefinitionId)
        val documentDefinition = mock<JsonSchemaDocumentDefinition>()
        whenever(documentDefinition.id()).thenReturn(documentDefinitionId)

        whenever(repository.findById(buildingBlockDefinitionId)).thenReturn(Optional.of(definition))
        whenever(documentDefinitionService.findByBlueprintId(buildingBlockDefinitionId)).thenReturn(Optional.of(documentDefinition))
        whenever(formDefinitionRepository.findAllByBlueprintId(
            BlueprintType.BUILDING_BLOCK,
            buildingBlockDefinitionId.key,
            buildingBlockDefinitionId.versionTag
        )).thenReturn(emptyList())
        whenever(buildingBlockDecisionService.getDecisionDefinitions(buildingBlockDefinitionId)).thenReturn(emptyList())

        val result = exporter.export(BuildingBlockDefinitionExportRequest(buildingBlockDefinitionId))

        assertThat(result.exportFiles).hasSize(1)
        val exportFile = result.exportFiles.first()
        assertThat(exportFile.path).isEqualTo(
            "config/building-block/bb-key/1-2-3/building-block/definition/bb-key.building-block-definition.json"
        )

        val exportedJson = objectMapper.readTree(exportFile.content)
        assertThat(exportedJson.get("key").asText()).isEqualTo("bb-key")
        assertThat(exportedJson.get("name").asText()).isEqualTo("Test building block")
        assertThat(exportedJson.get("description").asText()).isEqualTo("Description")

        assertThat(result.relatedRequests).containsExactly(
            BuildingBlockDocumentDefinitionExportRequest("document-definition", buildingBlockDefinitionId)
        )
    }

    @Test
    fun `should export definition and include decision definition requests`() {
        val definition = BuildingBlockDefinition(
            id = buildingBlockDefinitionId,
            name = "Test building block",
            description = "Description"
        )

        whenever(repository.findById(buildingBlockDefinitionId)).thenReturn(Optional.of(definition))
        whenever(documentDefinitionService.findByBlueprintId(buildingBlockDefinitionId)).thenReturn(Optional.empty())
        whenever(formDefinitionRepository.findAllByBlueprintId(
            BlueprintType.BUILDING_BLOCK,
            buildingBlockDefinitionId.key,
            buildingBlockDefinitionId.versionTag
        )).thenReturn(emptyList())

        val decisionDefinition = mock<DecisionDefinition>()
        whenever(decisionDefinition.id).thenReturn("decision-def-id")
        whenever(buildingBlockDecisionService.getDecisionDefinitions(buildingBlockDefinitionId))
            .thenReturn(listOf(decisionDefinition))

        val result = exporter.export(BuildingBlockDefinitionExportRequest(buildingBlockDefinitionId))

        assertThat(result.relatedRequests).contains(
            BuildingBlockDecisionDefinitionExportRequest("decision-def-id", buildingBlockDefinitionId)
        )
    }

    @Test
    fun `should return empty result when definition not found`() {
        whenever(repository.findById(buildingBlockDefinitionId)).thenReturn(Optional.empty())

        val result = exporter.export(BuildingBlockDefinitionExportRequest(buildingBlockDefinitionId))

        assertThat(result.exportFiles).isEmpty()
        assertThat(result.relatedRequests).isEmpty()
        verify(documentDefinitionService, never()).findByBlueprintId(any())
    }
}