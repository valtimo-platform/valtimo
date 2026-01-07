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
import com.ritense.exporter.request.BuildingBlockProcessDefinitionExportRequest
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.processlink.web.rest.dto.ProcessLinkExportResponseDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.ProcessDefinition
import org.operaton.bpm.engine.repository.ProcessDefinitionQuery

@ExtendWith(MockitoExtension::class)
class BuildingBlockProcessLinkExporterTest(
    @Mock private val processLinkService: ProcessLinkService,
    @Mock private val repositoryService: RepositoryService,
    @Mock private val processLinkMapper: ProcessLinkMapper,
) {

    private val objectMapper = ObjectMapper()
    private lateinit var exporter: BuildingBlockProcessLinkExporter

    private data class TestProcessLinkExportResponseDto(
        override val activityId: String,
        override val activityType: ActivityTypeWithEventName,
        override val processLinkType: String,
        val pluginActionDefinitionKey: String?,
        val pluginDefinitionKey: String?,
        val actionProperties: Map<String, Any?>,
        val pluginConfigurationId: String? = null,
        val referenceType: String? = "BUILDING_BLOCK",
    ) : ProcessLinkExportResponseDto

    @BeforeEach
    fun setUp() {
        exporter = BuildingBlockProcessLinkExporter(
            processLinkService = processLinkService,
            objectMapper = objectMapper,
            repositoryService = repositoryService,
            processLinkMappers = listOf(processLinkMapper),
        )
    }

    @Test
    fun `should export building block process links in importer compatible format`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId("bb-key", "1.0.0")
        val processDefinitionId = "bb-key:1:some-id"
        val processDefinitionKey = "auto-deploy-process-link-with-long-key"

        val query: ProcessDefinitionQuery = mock()
        val processDefinition: ProcessDefinition = mock()
        whenever(repositoryService.createProcessDefinitionQuery()).thenReturn(query)
        whenever(query.processDefinitionId(processDefinitionId)).thenReturn(query)
        whenever(query.singleResult()).thenReturn(processDefinition)
        whenever(processDefinition.key).thenReturn(processDefinitionKey)

        val processLink: ProcessLink = mock()
        whenever(processLink.processLinkType).thenReturn("plugin")
        whenever(processLinkService.getProcessLinks(processDefinitionId)).thenReturn(listOf(processLink))

        whenever(processLinkMapper.supportsProcessLinkType("plugin")).thenReturn(true)

        val exportDto = TestProcessLinkExportResponseDto(
            activityId = "GetBesluittypeURLTask",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            processLinkType = "plugin",
            pluginActionDefinitionKey = "get-besluittype",
            pluginDefinitionKey = "catalogiapi",
            actionProperties = mapOf(
                "besluittype" to "doc:besluitTypeDescription",
                "processVariable" to "besluittypeUrl"
            ),
            pluginConfigurationId = null,
            referenceType = "BUILDING_BLOCK"
        )
        whenever(processLinkMapper.toProcessLinkExportResponseDto(processLink)).thenReturn(exportDto)

        val result = exporter.export(
            BuildingBlockProcessDefinitionExportRequest(processDefinitionId, buildingBlockDefinitionId)
        )

        assertThat(result.exportFiles).hasSize(1)

        val exportFile = result.exportFiles.single()
        assertThat(exportFile.path).isEqualTo(
            "config/building-block/bb-key/1-0-0/process-link/auto-deploy-process-link-with-long-key.process-link.json"
        )

        val json = objectMapper.readTree(exportFile.content)
        assertThat(json.isArray).isTrue()
        assertThat(json.size()).isEqualTo(1)

        val first = json[0]
        assertThat(first["activityId"].asText()).isEqualTo("GetBesluittypeURLTask")
        assertThat(first["activityType"].asText()).isEqualTo("bpmn:ServiceTask:start")
        assertThat(first["processLinkType"].asText()).isEqualTo("plugin")
        assertThat(first["pluginActionDefinitionKey"].asText()).isEqualTo("get-besluittype")
        assertThat(first["pluginDefinitionKey"].asText()).isEqualTo("catalogiapi")
        assertThat(first["referenceType"].asText()).isEqualTo("BUILDING_BLOCK")
        assertThat(first["pluginConfigurationId"].isNull).isTrue()

        assertThat(first["actionProperties"]["besluittype"].asText()).isEqualTo("doc:besluitTypeDescription")
        assertThat(first["actionProperties"]["processVariable"].asText()).isEqualTo("besluittypeUrl")
    }
}