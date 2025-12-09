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

package com.ritense.buildingblock.processlink.service

import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.processlink.service.BuildingBlockCallActivityListener.Companion.BUILDING_BLOCK_INSTANCE_ID_VARIABLE
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.plugin.service.BuildingBlockPluginConfigurationResolver
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.delegate.DelegateTask
import org.springframework.stereotype.Component
import java.util.UUID

@Component
@SkipComponentScan
class DefaultBuildingBlockPluginConfigurationResolver(
    private val buildingBlockInstanceService: BuildingBlockInstanceService,
    private val processLinkService: ProcessLinkService,
) : BuildingBlockPluginConfigurationResolver {
    override fun resolve(execution: DelegateExecution, pluginDefinitionKey: String): UUID? {
        return findMappings(execution)[pluginDefinitionKey]
    }

    override fun resolve(task: DelegateTask, pluginDefinitionKey: String): UUID? {
        return resolve(task.execution, pluginDefinitionKey)
    }

    private fun findMappings(execution: DelegateExecution): Map<String, UUID> {
        val businessKey = execution.businessKey
            ?: throw IllegalStateException("Execution businessKey is required to resolve plugin configuration mappings")

        val documentId = try {
            UUID.fromString(businessKey)
        } catch(_: IllegalArgumentException) {
            throw IllegalStateException("BusinessKey for building block instance document must be a UUID, but was '$businessKey'")
        }

        val buildingBlockInstance = buildingBlockInstanceService.getByDocumentId(documentId)
            ?: throw IllegalStateException("No building block instance found for documentId '$documentId'")

        val processDefinitionId = findParentSolutionInstanceProcessId(execution)
            ?: throw IllegalStateException("Parent solution instance process not found for activityId '${buildingBlockInstance.activityId}'")

        val processLinks = processLinkService.getProcessLinks(
            processDefinitionId,
            buildingBlockInstance.activityId
        ).filterIsInstance<BuildingBlockProcessLink>()

        val processLink = processLinks.singleOrNull()
            ?: throw IllegalStateException(
                "Expected a single building block process link for processDefinitionId '${execution.processDefinitionId}' " +
                    "and activityId '${buildingBlockInstance.activityId}', but found ${processLinks.size}"
            )

        return processLink.pluginConfigurationMappings
    }

    fun findParentSolutionInstanceProcessId(execution: DelegateExecution): String? {
        var current: DelegateExecution? = execution


        while (current != null ) {
            if (current.hasVariableLocal(BUILDING_BLOCK_INSTANCE_ID_VARIABLE)) {
                return current.processDefinitionId
            }
            current = current.superExecution
        }

        return null
    }
}
