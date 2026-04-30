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
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockSyncTiming
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.exporter.request.BuildingBlockDefinitionExportRequest
import com.ritense.exporter.request.CaseDefinitionBuildingBlockLinkExportRequest
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.whenever
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class CaseDefinitionBuildingBlockLinkExporterTest(
    @Mock private val linkRepository: CaseDefinitionBuildingBlockLinkRepository,
) {

    private val objectMapper: ObjectMapper = jacksonObjectMapper()
    private lateinit var exporter: CaseDefinitionBuildingBlockLinkExporter

    private val caseDefinitionId = CaseDefinitionId("my-case", "1.2.3")

    @BeforeEach
    fun setUp() {
        exporter = CaseDefinitionBuildingBlockLinkExporter(objectMapper, linkRepository)
    }

    @Test
    fun `should support CaseDefinitionBuildingBlockLinkExportRequest`() {
        assertThat(exporter.supports()).isEqualTo(CaseDefinitionBuildingBlockLinkExportRequest::class.java)
    }

    @Test
    fun `should return empty result when no links exist`() {
        whenever(linkRepository.findAllByCaseDefinitionId(caseDefinitionId)).thenReturn(emptyList())

        val result = exporter.export(CaseDefinitionBuildingBlockLinkExportRequest(caseDefinitionId))

        assertThat(result.exportFiles).isEmpty()
        assertThat(result.relatedRequests).isEmpty()
    }

    @Test
    fun `should export links with correct path and content`() {
        val bbDefinitionId = BuildingBlockDefinitionId.of("income-check", "2.0.0")
        val link = CaseDefinitionBuildingBlockLink(
            id = UUID.randomUUID(),
            caseDefinitionId = caseDefinitionId,
            buildingBlockDefinitionId = bbDefinitionId,
            inputMappings = listOf(BuildingBlockInputMapping(source = "doc:/income", target = "/amount")),
            outputMappings = listOf(BuildingBlockOutputMapping(source = "/result", target = "doc:/checkResult", syncTiming = BuildingBlockSyncTiming.END)),
            pluginConfigurationMappings = emptyMap()
        )
        whenever(linkRepository.findAllByCaseDefinitionId(caseDefinitionId)).thenReturn(listOf(link))

        val result = exporter.export(CaseDefinitionBuildingBlockLinkExportRequest(caseDefinitionId))

        assertThat(result.exportFiles).hasSize(1)
        val exportFile = result.exportFiles.first()
        assertThat(exportFile.path).isEqualTo(
            "config/case/my-case/1-2-3/building-block-link/my-case.case-building-block-links.json"
        )

        val exportedJson = objectMapper.readTree(exportFile.content)
        assertThat(exportedJson.isArray).isTrue()
        assertThat(exportedJson).hasSize(1)

        val dto = exportedJson[0]
        assertThat(dto.get("buildingBlockDefinitionKey").asText()).isEqualTo("income-check")
        assertThat(dto.get("buildingBlockDefinitionVersionTag").asText()).isEqualTo("2.0.0")
        assertThat(dto.get("inputMappings")).hasSize(1)
        assertThat(dto.get("inputMappings")[0].get("source").asText()).isEqualTo("doc:/income")
        assertThat(dto.get("inputMappings")[0].get("target").asText()).isEqualTo("/amount")
        assertThat(dto.get("outputMappings")).hasSize(1)
        assertThat(dto.get("outputMappings")[0].get("source").asText()).isEqualTo("/result")
        assertThat(dto.get("outputMappings")[0].get("target").asText()).isEqualTo("doc:/checkResult")
    }

    @Test
    fun `should include BuildingBlockDefinitionExportRequest for each link`() {
        val bbDefinitionId1 = BuildingBlockDefinitionId.of("bb-one", "1.0.0")
        val bbDefinitionId2 = BuildingBlockDefinitionId.of("bb-two", "2.0.0")
        val link1 = CaseDefinitionBuildingBlockLink(
            caseDefinitionId = caseDefinitionId,
            buildingBlockDefinitionId = bbDefinitionId1,
        )
        val link2 = CaseDefinitionBuildingBlockLink(
            caseDefinitionId = caseDefinitionId,
            buildingBlockDefinitionId = bbDefinitionId2,
        )
        whenever(linkRepository.findAllByCaseDefinitionId(caseDefinitionId)).thenReturn(listOf(link1, link2))

        val result = exporter.export(CaseDefinitionBuildingBlockLinkExportRequest(caseDefinitionId))

        assertThat(result.relatedRequests).containsExactlyInAnyOrder(
            BuildingBlockDefinitionExportRequest(bbDefinitionId1),
            BuildingBlockDefinitionExportRequest(bbDefinitionId2)
        )
    }
}
