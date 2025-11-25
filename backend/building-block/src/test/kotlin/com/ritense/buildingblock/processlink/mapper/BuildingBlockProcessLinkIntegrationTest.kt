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
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockSyncTiming
import com.ritense.buildingblock.processlink.dto.BuildingBlockInputMappingDto
import com.ritense.buildingblock.processlink.dto.BuildingBlockOutputMappingDto
import com.ritense.buildingblock.processlink.dto.BuildingBlockProcessLinkCreateRequestDto
import com.ritense.buildingblock.processlink.dto.BuildingBlockProcessLinkExportResponseDto
import com.ritense.buildingblock.processlink.dto.BuildingBlockProcessLinkResponseDto
import com.ritense.buildingblock.processlink.dto.BuildingBlockProcessLinkUpdateRequestDto
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
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
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.mock.mockito.MockBean
import java.time.LocalDateTime
import java.util.UUID
import kotlin.test.assertEquals

class BuildingBlockProcessLinkIntegrationTest @Autowired constructor(
    private val mapper: BuildingBlockProcessLinkMapper,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
) : BaseIntegrationTest() {

    @MockBean
    lateinit var processLinkService: ProcessLinkService

    lateinit var buildingBlock: BuildingBlockDefinition

    @BeforeEach
    fun setUp() {
        val bbToSave = BuildingBlockDefinition(
            BuildingBlockDefinitionId.of("bb", "1.0.0"),
            "Test Building Block",
            "This is a building block used to test process links.",
            "Me",
            LocalDateTime.now(),
        )
        this.buildingBlock = buildingBlockDefinitionRepository.save(bbToSave)
    }

    @AfterEach
    fun tearDown() {
        processDefinitionBuildingBlockDefinitionRepository.deleteAll()
    }

    @Test
    fun `should create process link when mappings cover required plugins`() {
        val buildingBlockDefinitionId = buildingBlock.id
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
    fun `should map input and output mappings through create and response`() {
        val buildingBlockDefinitionId = buildingBlock.id
        val mainProcessDefinitionId = "bb-process"
        stubMainProcess(buildingBlockDefinitionId, mainProcessDefinitionId)
        doReturn(emptyList<PluginProcessLink>()).whenever(processLinkService).getProcessLinks(mainProcessDefinitionId)

        val inputMappings = listOf(
            BuildingBlockInputMappingDto(source = "doc:firstName", target = "firstName"),
            BuildingBlockInputMappingDto(source = "doc:Smith", target = "lastName")
        )
        val outputMappings = listOf(
            BuildingBlockOutputMappingDto(
                source = "result",
                target = "doc:result",
                syncTiming = BuildingBlockSyncTiming.END
            )
        )

        val dto = BuildingBlockProcessLinkCreateRequestDto(
            processDefinitionId = "case-process",
            activityId = "callActivity",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionKey = "bb",
            buildingBlockDefinitionVersionTag = "1.0.0",
            pluginConfigurationMappings = emptyMap(),
            inputMappings = inputMappings,
            outputMappings = outputMappings
        )

        val processLink = mapper.toNewProcessLink(dto, CaseDefinitionId("case", "1.0.0")) as BuildingBlockProcessLink
        assertEquals(
            listOf(
                BuildingBlockInputMapping(target = "firstName", source = "doc:firstName"),
                BuildingBlockInputMapping(target = "lastName", source = "manual:Smith")
            ),
            processLink.inputMappings
        )
        assertEquals(
            listOf(
                BuildingBlockOutputMapping(
                    source = "result",
                    target = "doc:result",
                    syncTiming = BuildingBlockSyncTiming.END
                )
            ),
            processLink.outputMappings
        )

        val response = mapper.toProcessLinkResponseDto(processLink) as BuildingBlockProcessLinkResponseDto
        val export = mapper.toProcessLinkExportResponseDto(processLink) as BuildingBlockProcessLinkExportResponseDto
        assertEquals(inputMappings, response.inputMappings)
        assertEquals(outputMappings, response.outputMappings)
        assertEquals(outputMappings, export.outputMappings)
    }

    @Test
    fun `should map input and output mappings through update`() {
        val buildingBlockDefinitionId = buildingBlock.id
        val mainProcessDefinitionId = "bb-process"
        stubMainProcess(buildingBlockDefinitionId, mainProcessDefinitionId)
        doReturn(emptyList<PluginProcessLink>()).whenever(processLinkService).getProcessLinks(mainProcessDefinitionId)

        val existing = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "case-process",
            activityId = "callActivity",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = buildingBlockDefinitionId,
            pluginConfigurationMappings = emptyMap(),
            inputMappings = listOf(BuildingBlockInputMapping(source = "doc:firstName", target = "firstName")),
            outputMappings = listOf(
                BuildingBlockOutputMapping(
                    source = "result",
                    target = "doc:result",
                    syncTiming = BuildingBlockSyncTiming.END
                )
            )
        )

        val dto = BuildingBlockProcessLinkUpdateRequestDto(
            id = existing.id,
            buildingBlockDefinitionKey = "bb",
            buildingBlockDefinitionVersionTag = "1.0.0",
            pluginConfigurationMappings = emptyMap(),
            inputMappings = listOf(BuildingBlockInputMappingDto(source = "doc:lastName", target = "lastName")),
            outputMappings = listOf(
                BuildingBlockOutputMappingDto(
                    source = "result",
                    target = "pv:result",
                    syncTiming = BuildingBlockSyncTiming.CONTINUOUS
                )
            )
        )

        val updated = mapper.toUpdatedProcessLink(existing, dto, CaseDefinitionId("case", "1.0.0")) as BuildingBlockProcessLink

        assertEquals(
            listOf(BuildingBlockInputMapping(target = "lastName", source = "doc:lastName")),
            updated.inputMappings
        )
        assertEquals(
            listOf(
                BuildingBlockOutputMapping(
                    source = "result",
                    target = "pv:result",
                    syncTiming = BuildingBlockSyncTiming.CONTINUOUS
                )
            ),
            updated.outputMappings
        )
    }

    @Test
    fun `should throw when required plugin mapping missing`() {
        val buildingBlockDefinitionId = buildingBlock.id
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
        val buildingBlockDefinitionId = buildingBlock.id
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
