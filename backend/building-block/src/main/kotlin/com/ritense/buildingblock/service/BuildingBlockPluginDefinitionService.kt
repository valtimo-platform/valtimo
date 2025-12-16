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

import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.plugin.service.PluginService
import com.ritense.plugin.web.rest.result.PluginDefinitionsWithDependenciesDto
import com.ritense.processlink.repository.ValtimoPluginProcessLinkRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.springframework.stereotype.Service

@Service
@SkipComponentScan
class BuildingBlockPluginDefinitionService(
    private val pluginProcessLinkRepository: ValtimoPluginProcessLinkRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val pluginService: PluginService
) {
    //TODO: change these method so they also take call activities to other processes and building blocks into account
    fun getPluginDefinitionKeysForBuildingBlock(buildingBlockDefinitionId: BuildingBlockDefinitionId): Set<String> {
        val processDefinitionIds = processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(buildingBlockDefinitionId)
            .map { it.id.processDefinitionId.id }

        if (processDefinitionIds.isEmpty()) {
            return emptySet()
        }

        val keys = pluginProcessLinkRepository.findPluginDefinitionKeysByProcessDefinitionIds(processDefinitionIds)
        return keys.toSet()
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
