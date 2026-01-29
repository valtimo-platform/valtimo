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

import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.plugin.service.PluginService
import com.ritense.plugin.web.rest.result.PluginDefinitionsWithDependenciesDto
import com.ritense.processlink.repository.ValtimoPluginProcessLinkRepository
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.springframework.stereotype.Service

@Service
@SkipComponentScan
class BuildingBlockPluginDefinitionService(
    private val pluginProcessLinkRepository: ValtimoPluginProcessLinkRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val pluginService: PluginService,
    private val processLinkService: ProcessLinkService
) {
    /**
     * Get all plugin definition keys required by a building block, including plugins required by
     * nested building blocks (building blocks referenced within this building block's processes).
     */
    fun getPluginDefinitionKeysForBuildingBlock(buildingBlockDefinitionId: BuildingBlockDefinitionId): Set<String> {
        return getPluginDefinitionKeysForBuildingBlockRecursive(buildingBlockDefinitionId, mutableSetOf())
    }

    private fun getPluginDefinitionKeysForBuildingBlockRecursive(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        visitedBuildingBlocks: MutableSet<BuildingBlockDefinitionId>
    ): Set<String> {
        // Prevent infinite loops in case of circular references
        if (visitedBuildingBlocks.contains(buildingBlockDefinitionId)) {
            return emptySet()
        }
        visitedBuildingBlocks.add(buildingBlockDefinitionId)

        val processDefinitionIds = processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(buildingBlockDefinitionId)
            .map { it.id.processDefinitionId.id }

        if (processDefinitionIds.isEmpty()) {
            return emptySet()
        }

        // Get direct plugin requirements from this building block's processes
        val directPluginKeys = pluginProcessLinkRepository
            .findPluginDefinitionKeysByProcessDefinitionIds(processDefinitionIds)
            .toSet()

        // Find all nested building block process links in this building block's processes
        val nestedBuildingBlockDefinitionIds = processDefinitionIds.flatMap { processDefinitionId ->
            processLinkService.getProcessLinks(processDefinitionId)
                .filterIsInstance<BuildingBlockProcessLink>()
                .map { it.buildingBlockDefinitionId }
        }.toSet()

        // Recursively get plugin requirements from nested building blocks
        val nestedPluginKeys = nestedBuildingBlockDefinitionIds.flatMap { nestedBuildingBlockId ->
            getPluginDefinitionKeysForBuildingBlockRecursive(nestedBuildingBlockId, visitedBuildingBlocks)
        }.toSet()

        return directPluginKeys + nestedPluginKeys
    }

    fun getPluginDefinitionKeysForProcessDefinition(processDefinitionId: String): Set<String> {
        val keys = pluginProcessLinkRepository.findPluginDefinitionKeysByProcessDefinitionIds(listOf(processDefinitionId))
        return keys.toSet()
    }

    fun getPluginDefinitionsWithDependenciesForBuildingBlock(
        buildingBlockId: BuildingBlockDefinitionId
    ): PluginDefinitionsWithDependenciesDto {
        val pluginKeys = getPluginDefinitionKeysForBuildingBlock(buildingBlockId)

        return pluginService
            .getPluginDefinitionsWithDependencies(pluginKeys)
    }
}
