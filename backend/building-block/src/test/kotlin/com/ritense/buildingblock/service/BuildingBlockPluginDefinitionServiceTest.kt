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

import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.plugin.service.PluginService
import com.ritense.plugin.web.rest.result.PluginDefinitionsWithDependenciesDto
import com.ritense.plugin.web.rest.result.PluginRequirementSource
import com.ritense.plugin.web.rest.result.PluginWithDependenciesDto
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processlink.repository.ExternalPluginReferenceProjection
import com.ritense.processlink.repository.ValtimoPluginProcessLinkRepository
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

class BuildingBlockPluginDefinitionServiceTest {

    private lateinit var pluginProcessLinkRepository: ValtimoPluginProcessLinkRepository
    private lateinit var processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository
    private lateinit var pluginService: PluginService
    private lateinit var processLinkService: ProcessLinkService
    private lateinit var service: BuildingBlockPluginDefinitionService

    private val buildingBlockId = BuildingBlockDefinitionId.of("my-building-block", "1.0.0")
    private val processDefinitionId = "my-building-block-process:1:abc"

    @BeforeEach
    fun setUp() {
        pluginProcessLinkRepository = mock()
        processDefinitionBuildingBlockDefinitionRepository = mock()
        pluginService = mock()
        processLinkService = mock()
        service = BuildingBlockPluginDefinitionService(
            pluginProcessLinkRepository,
            processDefinitionBuildingBlockDefinitionRepository,
            pluginService,
            processLinkService,
        )

        whenever(processDefinitionBuildingBlockDefinitionRepository.findAllByIdBuildingBlockDefinitionId(buildingBlockId))
            .thenReturn(
                listOf(
                    ProcessDefinitionBuildingBlockDefinition(
                        id = ProcessDefinitionBuildingBlockDefinitionId(
                            processDefinitionId = ProcessDefinitionId.of(processDefinitionId),
                            buildingBlockDefinitionId = buildingBlockId,
                        ),
                        main = true,
                    )
                )
            )
        whenever(processLinkService.getProcessLinks(processDefinitionId)).thenReturn(emptyList())
    }

    @Test
    fun `combines embedded and external plugin requirements with a source discriminator`() {
        whenever(pluginProcessLinkRepository.findPluginDefinitionKeysByProcessDefinitionIds(listOf(processDefinitionId)))
            .thenReturn(listOf("embedded-plugin"))
        whenever(pluginProcessLinkRepository.findExternalPluginReferencesByProcessDefinitionIds(listOf(processDefinitionId)))
            .thenReturn(listOf(referenceProjection("case-summary", "0.1.0")))
        whenever(pluginService.getPluginDefinitionsWithDependencies(setOf("embedded-plugin"))).thenReturn(
            PluginDefinitionsWithDependenciesDto(
                plugins = listOf(
                    PluginWithDependenciesDto(
                        pluginDefinitionKey = "embedded-plugin",
                        dependencies = emptyList(),
                    )
                )
            )
        )

        val result = service.getPluginDefinitionsWithDependenciesForBuildingBlock(buildingBlockId)

        assertThat(result.plugins).hasSize(2)
        assertThat(result.plugins).anySatisfy { plugin ->
            assertThat(plugin.pluginDefinitionKey).isEqualTo("embedded-plugin")
            assertThat(plugin.source).isEqualTo(PluginRequirementSource.EMBEDDED)
            assertThat(plugin.pluginDefinitionVersion).isNull()
        }
        assertThat(result.plugins).anySatisfy { plugin ->
            assertThat(plugin.pluginDefinitionKey).isEqualTo("case-summary")
            assertThat(plugin.source).isEqualTo(PluginRequirementSource.EXTERNAL)
            assertThat(plugin.pluginDefinitionVersion).isEqualTo("0.1.0")
        }
    }

    @Test
    fun `external plugin requirements are collected recursively through nested building blocks`() {
        val nestedBuildingBlockId = BuildingBlockDefinitionId.of("nested-building-block", "2.0.0")
        val nestedProcessDefinitionId = "nested-building-block-process:1:def"

        whenever(pluginProcessLinkRepository.findPluginDefinitionKeysByProcessDefinitionIds(listOf(processDefinitionId)))
            .thenReturn(emptyList())
        whenever(pluginProcessLinkRepository.findExternalPluginReferencesByProcessDefinitionIds(listOf(processDefinitionId)))
            .thenReturn(emptyList())
        whenever(pluginService.getPluginDefinitionsWithDependencies(emptySet()))
            .thenReturn(PluginDefinitionsWithDependenciesDto(plugins = emptyList()))

        val nestedLink = mock<BuildingBlockProcessLink> {
            on { this.buildingBlockDefinitionId } doReturn nestedBuildingBlockId
        }
        whenever(processLinkService.getProcessLinks(processDefinitionId)).thenReturn(listOf(nestedLink))

        whenever(processDefinitionBuildingBlockDefinitionRepository.findAllByIdBuildingBlockDefinitionId(nestedBuildingBlockId))
            .thenReturn(
                listOf(
                    ProcessDefinitionBuildingBlockDefinition(
                        id = ProcessDefinitionBuildingBlockDefinitionId(
                            processDefinitionId = ProcessDefinitionId.of(nestedProcessDefinitionId),
                            buildingBlockDefinitionId = nestedBuildingBlockId,
                        ),
                        main = true,
                    )
                )
            )
        whenever(processLinkService.getProcessLinks(nestedProcessDefinitionId)).thenReturn(emptyList())
        whenever(pluginProcessLinkRepository.findExternalPluginReferencesByProcessDefinitionIds(listOf(nestedProcessDefinitionId)))
            .thenReturn(listOf(referenceProjection("nested-plugin", "1.2.3")))

        val references = service.getExternalPluginReferencesForBuildingBlock(buildingBlockId)

        assertThat(references).containsExactly("nested-plugin" to "1.2.3")
    }

    private fun referenceProjection(pluginId: String, version: String): ExternalPluginReferenceProjection =
        object : ExternalPluginReferenceProjection {
            override fun getPluginDefinitionKey() = pluginId
            override fun getPluginDefinitionVersion() = version
        }
}
