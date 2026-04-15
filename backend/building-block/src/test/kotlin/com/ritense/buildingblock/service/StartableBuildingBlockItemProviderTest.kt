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
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.AuthorizationSupportedHelper
import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.CaseDefinitionBuildingBlockLinkDto
import com.ritense.case.web.rest.dto.StartableItemType
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationContext
import org.springframework.core.ResolvableType
import java.util.UUID

class StartableBuildingBlockItemProviderTest {

    private lateinit var linkRepository: CaseDefinitionBuildingBlockLinkRepository
    private lateinit var processDefBBDefRepository: ProcessDefinitionBuildingBlockDefinitionRepository
    private lateinit var authorizationService: AuthorizationService
    private lateinit var linkService: CaseDefinitionBuildingBlockLinkService
    private lateinit var objectMapper: ObjectMapper
    private lateinit var provider: StartableBuildingBlockItemProvider

    private val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")
    private val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("income-check", "1.0.0")

    @BeforeEach
    fun setUp() {
        linkRepository = mock()
        processDefBBDefRepository = mock()
        authorizationService = mock()
        linkService = mock()
        objectMapper = MapperSingleton.get()

        val applicationContext = mock<ApplicationContext>()
        whenever(applicationContext.getBeanNamesForType(any<ResolvableType>()))
            .thenReturn(arrayOf("mockBean"))
        AuthorizationSupportedHelper.setApplicationContext(applicationContext)

        whenever(authorizationService.hasPermission<Any>(any())).thenReturn(true)

        provider = StartableBuildingBlockItemProvider(
            linkRepository = linkRepository,
            processDefinitionBuildingBlockDefinitionRepository = processDefBBDefRepository,
            authorizationService = authorizationService,
            caseDefinitionBuildingBlockLinkService = linkService,
            objectMapper = objectMapper
        )
    }

    @Test
    fun `should return BUILDING_BLOCK as type`() {
        assertThat(provider.type).isEqualTo(StartableItemType.BUILDING_BLOCK)
    }

    @Test
    fun `should get startable items from linked building blocks`() {
        val link = CaseDefinitionBuildingBlockLink(
            caseDefinitionId = caseDefinitionId,
            buildingBlockDefinitionId = buildingBlockDefinitionId
        )
        whenever(linkRepository.findAllByCaseDefinitionId(caseDefinitionId)).thenReturn(listOf(link))

        val processDefBBDefId = ProcessDefinitionBuildingBlockDefinitionId(
            processDefinitionId = ProcessDefinitionId("bb-process:1"),
            buildingBlockDefinitionId = buildingBlockDefinitionId
        )
        val mainProcessLink = ProcessDefinitionBuildingBlockDefinition(
            id = processDefBBDefId,
            main = true
        ).apply {
            processDefinitionName = "Income Check Process"
        }

        whenever(processDefBBDefRepository.findByIdBuildingBlockDefinitionIdAndMain(buildingBlockDefinitionId, true))
            .thenReturn(mainProcessLink)

        val result = provider.getStartableItems(caseDefinitionId)

        assertThat(result).hasSize(1)
        assertThat(result[0].type).isEqualTo(StartableItemType.BUILDING_BLOCK)
        assertThat(result[0].name).isEqualTo("Income Check Process")
        assertThat(result[0].key).isEqualTo("income-check")
        assertThat(result[0].versionTag).isEqualTo("1.0.0")
        assertThat(result[0].processDefinitionId).isEqualTo("bb-process:1")
    }

    @Test
    fun `should skip items without main process link`() {
        val link = CaseDefinitionBuildingBlockLink(
            caseDefinitionId = caseDefinitionId,
            buildingBlockDefinitionId = buildingBlockDefinitionId
        )
        whenever(linkRepository.findAllByCaseDefinitionId(caseDefinitionId)).thenReturn(listOf(link))
        whenever(processDefBBDefRepository.findByIdBuildingBlockDefinitionIdAndMain(buildingBlockDefinitionId, true))
            .thenReturn(null)

        val result = provider.getStartableItems(caseDefinitionId)

        assertThat(result).isEmpty()
    }

    @Test
    fun `should skip items without execution permission`() {
        val link = CaseDefinitionBuildingBlockLink(
            caseDefinitionId = caseDefinitionId,
            buildingBlockDefinitionId = buildingBlockDefinitionId
        )
        whenever(linkRepository.findAllByCaseDefinitionId(caseDefinitionId)).thenReturn(listOf(link))

        val processDefBBDefId = ProcessDefinitionBuildingBlockDefinitionId(
            processDefinitionId = ProcessDefinitionId("bb-process:1"),
            buildingBlockDefinitionId = buildingBlockDefinitionId
        )
        val mainProcessLink = ProcessDefinitionBuildingBlockDefinition(
            id = processDefBBDefId,
            main = true
        ).apply {
            processDefinitionName = "Income Check Process"
        }

        whenever(processDefBBDefRepository.findByIdBuildingBlockDefinitionIdAndMain(buildingBlockDefinitionId, true))
            .thenReturn(mainProcessLink)
        whenever(authorizationService.hasPermission<Any>(any())).thenReturn(false)

        val result = provider.getStartableItems(caseDefinitionId)

        assertThat(result).isEmpty()
    }

    @Test
    fun `should use building block key as name when process definition name is null`() {
        val link = CaseDefinitionBuildingBlockLink(
            caseDefinitionId = caseDefinitionId,
            buildingBlockDefinitionId = buildingBlockDefinitionId
        )
        whenever(linkRepository.findAllByCaseDefinitionId(caseDefinitionId)).thenReturn(listOf(link))

        val processDefBBDefId = ProcessDefinitionBuildingBlockDefinitionId(
            processDefinitionId = ProcessDefinitionId("bb-process:1"),
            buildingBlockDefinitionId = buildingBlockDefinitionId
        )
        val mainProcessLink = ProcessDefinitionBuildingBlockDefinition(
            id = processDefBBDefId,
            main = true
        )
        // processDefinitionName is null by default

        whenever(processDefBBDefRepository.findByIdBuildingBlockDefinitionIdAndMain(buildingBlockDefinitionId, true))
            .thenReturn(mainProcessLink)

        val result = provider.getStartableItems(caseDefinitionId)

        assertThat(result).hasSize(1)
        assertThat(result[0].name).isEqualTo("income-check")
    }

    @Test
    fun `should create item via link service`() {
        val properties = objectMapper.readTree("""{
            "buildingBlockDefinitionKey": "income-check",
            "buildingBlockDefinitionVersionTag": "1.0.0"
        }""")

        val linkDto = CaseDefinitionBuildingBlockLinkDto(
            id = UUID.randomUUID(),
            caseDefinitionKey = "my-case",
            caseDefinitionVersionTag = "1.0.0",
            buildingBlockDefinitionKey = "income-check",
            buildingBlockDefinitionVersionTag = "1.0.0",
            inputMappings = emptyList(),
            outputMappings = emptyList(),
            pluginConfigurationMappings = emptyMap()
        )
        whenever(linkService.createLink(eq(caseDefinitionId), any())).thenReturn(linkDto)

        val result = provider.createItem(caseDefinitionId, properties)

        assertThat(result.type).isEqualTo(StartableItemType.BUILDING_BLOCK)
        assertThat(result.key).isEqualTo("income-check")
        assertThat(result.versionTag).isEqualTo("1.0.0")
        verify(linkService).createLink(eq(caseDefinitionId), any())
    }

    @Test
    fun `should delete item via link service`() {
        provider.deleteItem(caseDefinitionId, "income-check", "1.0.0")

        verify(linkService).deleteLink(caseDefinitionId, buildingBlockDefinitionId)
    }

    @Test
    fun `should get item properties via link service`() {
        val linkDto = CaseDefinitionBuildingBlockLinkDto(
            id = UUID.randomUUID(),
            caseDefinitionKey = "my-case",
            caseDefinitionVersionTag = "1.0.0",
            buildingBlockDefinitionKey = "income-check",
            buildingBlockDefinitionVersionTag = "1.0.0",
            inputMappings = emptyList(),
            outputMappings = emptyList(),
            pluginConfigurationMappings = emptyMap()
        )
        whenever(linkService.getLink(caseDefinitionId, buildingBlockDefinitionId)).thenReturn(linkDto)

        val result = provider.getItemProperties(caseDefinitionId, "income-check", "1.0.0")

        assertThat(result).isNotNull
        assertThat(result!!.get("buildingBlockDefinitionKey").asText()).isEqualTo("income-check")
        verify(linkService).getLink(caseDefinitionId, buildingBlockDefinitionId)
    }

    @Test
    fun `should update item via link service`() {
        val properties = objectMapper.readTree("""{
            "inputMappings": [],
            "outputMappings": [],
            "pluginConfigurationMappings": {}
        }""")

        val linkDto = CaseDefinitionBuildingBlockLinkDto(
            id = UUID.randomUUID(),
            caseDefinitionKey = "my-case",
            caseDefinitionVersionTag = "1.0.0",
            buildingBlockDefinitionKey = "income-check",
            buildingBlockDefinitionVersionTag = "1.0.0",
            inputMappings = emptyList(),
            outputMappings = emptyList(),
            pluginConfigurationMappings = emptyMap()
        )
        whenever(linkService.updateLink(eq(caseDefinitionId), eq(buildingBlockDefinitionId), any()))
            .thenReturn(linkDto)

        val result = provider.updateItem(caseDefinitionId, "income-check", "1.0.0", properties)

        assertThat(result.type).isEqualTo(StartableItemType.BUILDING_BLOCK)
        assertThat(result.key).isEqualTo("income-check")
        verify(linkService).updateLink(eq(caseDefinitionId), eq(buildingBlockDefinitionId), any())
    }
}
