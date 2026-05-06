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
import com.ritense.buildingblock.web.rest.dto.BuildingBlockProcessDefinitionDto
import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_PROCESS_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_PROCESS_LINK
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.plugin.service.PluginService.Companion.PROCESS_LINK_TYPE_PLUGIN
import com.ritense.plugin.web.rest.request.PluginProcessLinkCreateDto
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.repository.ValtimoPluginProcessLinkRepository
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.processlink.mapper.PluginProcessLinkMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNotNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

@ExtendWith(MockitoExtension::class)
class BuildingBlockProcessLinkImporterTest {

    @Mock
    lateinit var processLinkService: ProcessLinkService

    @Mock
    lateinit var buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService

    @Mock
    lateinit var pluginConfigurationRepository: PluginConfigurationRepository

    @Mock
    lateinit var pluginProcessLinkRepository: ValtimoPluginProcessLinkRepository

    private lateinit var objectMapper: ObjectMapper
    private lateinit var importer: BuildingBlockProcessLinkImporter

    @BeforeEach
    fun setUp() {
        objectMapper = jacksonObjectMapper()
        PluginProcessLinkMapper(objectMapper, pluginConfigurationRepository, pluginProcessLinkRepository)

        importer = BuildingBlockProcessLinkImporter(
            processLinkService = processLinkService,
            objectMapper = objectMapper,
            buildingBlockDefinitionProcessDefinitionService = buildingBlockDefinitionProcessDefinitionService
        )
    }

    @Test
    fun `should be of type 'buildingblockprocesslink'`() {
        assertThat(importer.type()).isEqualTo(BUILDING_BLOCK_PROCESS_LINK)
    }

    @Test
    fun `should depend on building block process definition plus processlink dependencies`() {
        whenever(processLinkService.getImporterDependsOnTypes()).thenReturn(setOf("document-definition"))
        assertThat(importer.dependsOn()).isEqualTo(setOf(BUILDING_BLOCK_PROCESS_DEFINITION, "document-definition"))
    }

    @Test
    fun `should support valid process link fileName`() {
        assertThat(importer.supports(VALID_FILENAME)).isTrue()
    }

    @Test
    fun `should not support invalid process link fileName`() {
        assertThat(importer.supports("/process-link/not-a-process-link.json")).isFalse()
        assertThat(importer.supports("/process-link/my-process.process-link.json.txt")).isFalse()
        assertThat(importer.supports("/other-path/my-process.process-link.json")).isFalse()
    }

    @Test
    fun `should not be part of case definition`() {
        assertThat(importer.partOfCaseDefinition()).isFalse()
    }

    @Test
    fun `should be part of building block definition`() {
        assertThat(importer.partOfBuildingBlockDefinition()).isTrue()
    }

    @Test
    fun `should force referenceType BUILDING_BLOCK and remove pluginConfigurationId`() {
        val processDefinitionKeyFromFilename = "my-process"
        val processDefinitionId = "pd-123"
        val buildingBlockId = BuildingBlockDefinitionId.of("my-bb", "1.2.0")

        whenever(
            buildingBlockDefinitionProcessDefinitionService.getProcessDefinitionsForBuildingBlock(
                eq(buildingBlockId.key),
                eq(buildingBlockId.versionTag.toString())
            )
        ).thenReturn(
            listOf(
                BuildingBlockProcessDefinitionDto(
                    id = processDefinitionId,
                    key = processDefinitionKeyFromFilename,
                    name = "My Process",
                    versionTag = "1",
                    main = true
                )
            )
        )

        val pluginMapper = PluginProcessLinkMapper(objectMapper, pluginConfigurationRepository, pluginProcessLinkRepository)
        whenever(processLinkService.getProcessLinkMapper(eq(PROCESS_LINK_TYPE_PLUGIN))).thenReturn(pluginMapper)

        doReturn(mock<ProcessLink>()).whenever(processLinkService).createProcessLink(any(), anyOrNull())

        val json = """
          [
            {
              "activityId": "Task_1",
              "activityType": "bpmn:ServiceTask:start",
              "processLinkType": "plugin",
              "pluginConfigurationId": "857d4312-c420-4a22-979b-625818d97ed5",
              "referenceType": "FIXED",
              "pluginDefinitionKey": "some-plugin",
              "pluginActionDefinitionKey": "get-besluittype",
              "actionProperties": { "x": "y" }
            }
          ]
        """.trimIndent()

        importer.import(
            ImportRequest(
                fileName = VALID_FILENAME,
                content = json.toByteArray(),
                buildingBlockDefinitionId = buildingBlockId,
                caseDefinitionId = null
            )
        )

        val createCaptor = argumentCaptor<ProcessLinkCreateRequestDto>()
        verify(processLinkService).createProcessLink(createCaptor.capture(), isNotNull())

        val createDto = createCaptor.firstValue as PluginProcessLinkCreateDto
        assertThat(createDto.processDefinitionId).isEqualTo(processDefinitionId)
        assertThat(createDto.referenceType).isEqualTo(PluginConfigurationReferenceType.BUILDING_BLOCK)
        assertThat(createDto.pluginConfigurationId).isNull()
    }

    private companion object {
        const val VALID_FILENAME = "/process-link/my-process.process-link.json"
    }
}