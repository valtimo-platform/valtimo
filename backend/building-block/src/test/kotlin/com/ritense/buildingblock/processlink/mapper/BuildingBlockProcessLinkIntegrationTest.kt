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

import com.ritense.buildingblock.BaseIntegrationTest
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
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.mock.mockito.MockBean
import java.util.UUID
import kotlin.test.assertEquals

class BuildingBlockProcessLinkIntegrationTest @Autowired constructor(
    private val mapper: BuildingBlockProcessLinkMapper,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository
) : BaseIntegrationTest() {

    @MockBean
    lateinit var processLinkService: ProcessLinkService

    @AfterEach
    fun tearDown() {
        processDefinitionBuildingBlockDefinitionRepository.deleteAll()
    }

    @Test
    fun `should create process link when mappings cover required plugins`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("bb", "1.0.0")
        val mainProcessDefinitionId = "bb-process"
        stubMainProcess(buildingBlockDefinitionId, mainProcessDefinitionId)
        stubBuildingBlockPluginLink(mainProcessDefinitionId, "zaken")

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
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("bb", "1.0.0")
        val mainProcessDefinitionId = "bb-process"
        stubMainProcess(buildingBlockDefinitionId, mainProcessDefinitionId)
        stubBuildingBlockPluginLink(mainProcessDefinitionId, "zaken")

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

    @Test
    fun `should allow empty mappings when no placeholders`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("bb", "1.0.0")
        val mainProcessDefinitionId = "bb-process"
        stubMainProcess(buildingBlockDefinitionId, mainProcessDefinitionId)
        doReturn(emptyList<PluginProcessLink>()).whenever(processLinkService).getProcessLinks(mainProcessDefinitionId)

        val dto = BuildingBlockProcessLinkCreateRequestDto(
            processDefinitionId = "case-process",
            activityId = "callActivity",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionKey = "bb",
            buildingBlockDefinitionVersionTag = "1.0.0",
            pluginConfigurationMappings = emptyMap()
        )

        val result = mapper.toNewProcessLink(dto, CaseDefinitionId("case", "1.0.0")) as BuildingBlockProcessLink

        assertEquals(emptyMap(), result.pluginConfigurationMappings)
    }

    @Test
    fun `should throw when main process definition missing`() {
        val dto = BuildingBlockProcessLinkCreateRequestDto(
            processDefinitionId = "case-process",
            activityId = "callActivity",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionKey = "bb",
            buildingBlockDefinitionVersionTag = "1.0.0",
            pluginConfigurationMappings = emptyMap()
        )

        assertThrows(IllegalStateException::class.java) {
            mapper.toNewProcessLink(dto, CaseDefinitionId("case", "1.0.0"))
        }
    }

    private fun stubMainProcess(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        mainProcessDefinitionId: String
    ) {
        processDefinitionBuildingBlockDefinitionRepository.save(
            ProcessDefinitionBuildingBlockDefinition(
                ProcessDefinitionBuildingBlockDefinitionId(
                    ProcessDefinitionId.of(mainProcessDefinitionId),
                    buildingBlockDefinitionId
                ),
                true
            )
        )
    }

    private fun stubBuildingBlockPluginLink(
        processDefinitionId: String,
        pluginDefinitionKey: String
    ) {
        val pluginProcessLink = PluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = processDefinitionId,
            activityId = "activity",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            pluginConfigurationReference = PluginConfigurationReference(
                PluginConfigurationReferenceType.BUILDING_BLOCK,
                pluginDefinitionKey
            ),
            pluginActionDefinitionKey = "action"
        )
        doReturn(listOf(pluginProcessLink))
            .whenever(processLinkService)
            .getProcessLinks(processDefinitionId)
    }
}
