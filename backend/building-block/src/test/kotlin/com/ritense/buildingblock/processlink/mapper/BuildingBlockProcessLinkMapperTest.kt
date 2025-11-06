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

package com.ritense.buildingblock.processlink.mapper

import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.processlink.dto.BuildingBlockProcessLinkCreateRequestDto
import com.ritense.buildingblock.processlink.dto.BuildingBlockProcessLinkUpdateRequestDto
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.UUID
import kotlin.test.assertEquals

class BuildingBlockProcessLinkMapperTest {

    private val processLinkService = mock<ProcessLinkService>()
    private val repository = mock<ProcessDefinitionBuildingBlockDefinitionRepository>()
    private val mapper = BuildingBlockProcessLinkMapper(MapperSingleton.get(), processLinkService, repository)

    @Test
    fun `should create process link when mappings cover required plugins`() {
        val buildingBlockProcessDefinitionId = "bb-process"
        val pluginProcessLink = PluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = buildingBlockProcessDefinitionId,
            activityId = "activity",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            pluginConfigurationReference = PluginConfigurationReference(
                PluginConfigurationReferenceType.BUILDING_BLOCK,
                "zaken"
            ),
            pluginActionDefinitionKey = "action"
        )
        doReturn(listOf(pluginProcessLink)).whenever(processLinkService).getProcessLinks(buildingBlockProcessDefinitionId)

        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("bb", "1.0.0")
        val mainLink = ProcessDefinitionBuildingBlockDefinition(
            ProcessDefinitionBuildingBlockDefinitionId(
                ProcessDefinitionId.of(buildingBlockProcessDefinitionId),
                buildingBlockDefinitionId
            ),
            true
        )
        doReturn(listOf(mainLink)).whenever(repository).findAllByIdBuildingBlockDefinitionId(buildingBlockDefinitionId)

        val mappingId = UUID.randomUUID()
        val dto = BuildingBlockProcessLinkCreateRequestDto(
            processDefinitionId = "case-process",
            activityId = "callActivity",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionKey = "bb",
            buildingBlockDefinitionVersionTag = "1.0.0",
            pluginConfigurationMappings = mapOf("zaken" to mappingId)
        )

        val result = mapper.toNewProcessLink(dto, CaseDefinitionId("case", "1.0.0")) as BuildingBlockProcessLink

        assertEquals(mapOf("zaken" to mappingId), result.pluginConfigurationMappings)
        assertEquals("bb", result.buildingBlockDefinitionId.key)
    }

    @Test
    fun `should throw when required plugin mapping missing`() {
        val buildingBlockProcessDefinitionId = "bb-process"
        val pluginProcessLink = PluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = buildingBlockProcessDefinitionId,
            activityId = "activity",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            pluginConfigurationReference = PluginConfigurationReference(
                PluginConfigurationReferenceType.BUILDING_BLOCK,
                "zaken"
            ),
            pluginActionDefinitionKey = "action"
        )
        doReturn(listOf(pluginProcessLink)).whenever(processLinkService).getProcessLinks(buildingBlockProcessDefinitionId)

        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("bb", "1.0.0")
        val mainLink = ProcessDefinitionBuildingBlockDefinition(
            ProcessDefinitionBuildingBlockDefinitionId(
                ProcessDefinitionId.of(buildingBlockProcessDefinitionId),
                buildingBlockDefinitionId
            ),
            true
        )
        doReturn(listOf(mainLink)).whenever(repository).findAllByIdBuildingBlockDefinitionId(buildingBlockDefinitionId)

        val existingLink = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "case-process",
            activityId = "callActivity",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = buildingBlockDefinitionId,
            pluginConfigurationMappings = mapOf("zaken" to UUID.randomUUID())
        )

        val dto = BuildingBlockProcessLinkUpdateRequestDto(
            id = existingLink.id,
            buildingBlockDefinitionKey = "bb",
            buildingBlockDefinitionVersionTag = "1.0.0",
            pluginConfigurationMappings = emptyMap()
        )

        assertThrows(IllegalArgumentException::class.java) {
            mapper.toUpdatedProcessLink(existingLink, dto, CaseDefinitionId("case", "1.0.0"))
        }
    }
}
