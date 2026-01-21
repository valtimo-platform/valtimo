/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.exporter.request.BuildingBlockDocumentDefinitionExportRequest
import com.ritense.exporter.request.BuildingBlockProcessDefinitionExportRequest
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.never
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.ProcessDefinition

@ExtendWith(MockitoExtension::class)
class BuildingBlockProcessDefinitionLinkExporterTest(
    @Mock private val repositoryService: RepositoryService,
    @Mock private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
) {

    private lateinit var exporter: BuildingBlockProcessDefinitionLinkExporter
    private val objectMapper = ObjectMapper()
    private val buildingBlockDefinitionId = BuildingBlockDefinitionId("bb-link", "1.0.0")

    @BeforeEach
    fun setUp() {
        exporter = BuildingBlockProcessDefinitionLinkExporter(
            objectMapper,
            repositoryService,
            processDefinitionBuildingBlockDefinitionRepository
        )
    }

    @Test
    fun `should export main process link and include all related process definitions`() {
        val mainLink = ProcessDefinitionBuildingBlockDefinition(
            id = ProcessDefinitionBuildingBlockDefinitionId(
                ProcessDefinitionId.of("main-process-id"),
                buildingBlockDefinitionId
            ),
            main = true
        )
        val secondaryLink = ProcessDefinitionBuildingBlockDefinition(
            id = ProcessDefinitionBuildingBlockDefinitionId(
                ProcessDefinitionId.of("secondary-process-id"),
                buildingBlockDefinitionId
            ),
            main = false
        )
        val mainProcessDefinition = org.mockito.kotlin.mock<ProcessDefinition>()
        whenever(mainProcessDefinition.id).thenReturn("main-process-id")
        whenever(mainProcessDefinition.key).thenReturn("main-process-key")

        whenever(
            processDefinitionBuildingBlockDefinitionRepository.findAllByIdBuildingBlockDefinitionId(
                buildingBlockDefinitionId
            )
        )
            .thenReturn(listOf(mainLink, secondaryLink))
        whenever(repositoryService.getProcessDefinition(mainProcessDefinition.id)).thenReturn(mainProcessDefinition)

        val result = exporter.export(
            BuildingBlockDocumentDefinitionExportRequest(
                name = "document-definition",
                buildingBlockDefinitionId = buildingBlockDefinitionId
            )
        )

        assertThat(result.exportFiles).hasSize(1)
        val exportFile = result.exportFiles.first()
        assertThat(exportFile.path).isEqualTo(
            "config/building-block/bb-link/1-0-0/building-block/building-block-definition-main-process-definition.json"
        )

        val exportedDto = ObjectMapper().readTree(exportFile.content)
        assertThat(exportedDto.get("processDefinitionKey").asText()).isEqualTo("main-process-key")

        assertThat(result.relatedRequests).containsExactlyInAnyOrder(
            BuildingBlockProcessDefinitionExportRequest("main-process-id", buildingBlockDefinitionId),
            BuildingBlockProcessDefinitionExportRequest("secondary-process-id", buildingBlockDefinitionId)
        )
    }

    @Test
    fun `should return only related process definitions when no main process definition is present`() {
        val link = ProcessDefinitionBuildingBlockDefinition(
            id = ProcessDefinitionBuildingBlockDefinitionId(
                ProcessDefinitionId.of("process-id"),
                buildingBlockDefinitionId
            ),
            main = false
        )
        whenever(
            processDefinitionBuildingBlockDefinitionRepository.findAllByIdBuildingBlockDefinitionId(
                buildingBlockDefinitionId
            )
        )
            .thenReturn(listOf(link))

        val result = exporter.export(
            BuildingBlockDocumentDefinitionExportRequest(
                name = "document-definition",
                buildingBlockDefinitionId = buildingBlockDefinitionId
            )
        )

        assertThat(result.exportFiles).isEmpty()
        assertThat(result.relatedRequests).containsExactly(
            BuildingBlockProcessDefinitionExportRequest("process-id", buildingBlockDefinitionId)
        )
        verify(repositoryService, never()).getProcessDefinition(any())
    }
}
