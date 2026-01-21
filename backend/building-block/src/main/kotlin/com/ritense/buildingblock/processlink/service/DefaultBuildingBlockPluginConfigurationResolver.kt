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

package com.ritense.buildingblock.processlink.service

import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.plugin.service.BuildingBlockPluginConfigurationResolver
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockConstants.Companion.BUILDING_BLOCK_DOCUMENT_ID_VARIABLE
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
        // Walk up to find the ROOT building block process link (the one in a case process)
        // which contains the actual plugin configuration mappings
        return findRootBuildingBlockMappings(execution)
            ?: throw IllegalStateException("Could not find root building block process link with plugin configuration mappings")
    }

    /**
     * Walks up the execution hierarchy to find the root building block process link.
     * For nested building blocks (Case -> BB-A -> BB-B -> BB-C), this finds the process link
     * from the case to BB-A, which contains the plugin configuration mappings.
     */
    private fun findRootBuildingBlockMappings(execution: DelegateExecution): Map<String, UUID>? {
        var current: DelegateExecution? = execution
        var lastBuildingBlockDocumentId: UUID? = null
        var lastProcessDefinitionId: String? = null

        // Walk up to find the topmost building block instance (the root)
        // The BUILDING_BLOCK_DOCUMENT_ID_VARIABLE contains the document ID of the building block
        // The variable is set on the call activity execution in the PARENT process (by BuildingBlockCallActivityListener)
        while (current != null) {
            if (current.hasVariableLocal(BUILDING_BLOCK_DOCUMENT_ID_VARIABLE)) {
                val variableValue = current.getVariableLocal(BUILDING_BLOCK_DOCUMENT_ID_VARIABLE)
                lastBuildingBlockDocumentId = when (variableValue) {
                    is UUID -> variableValue
                    is String -> UUID.fromString(variableValue)
                    else -> throw IllegalStateException("Unexpected type for $BUILDING_BLOCK_DOCUMENT_ID_VARIABLE: ${variableValue?.javaClass}")
                }
                // current is the call activity execution in the parent process, so its processDefinitionId
                // is the parent process definition (the one that contains the building block process link)
                lastProcessDefinitionId = current.processDefinitionId
            }
            // superExecution is only available on the process instance (root) execution.
            // Navigate to the process instance first, then get the super execution (call activity in parent process).
            current = current.processInstance?.superExecution
        }

        if (lastBuildingBlockDocumentId == null) {
            return null
        }

        val buildingBlockInstance = buildingBlockInstanceService.getByDocumentId(lastBuildingBlockDocumentId)
            ?: throw IllegalStateException("No building block instance found for documentId '$lastBuildingBlockDocumentId'")

        val processDefinitionId = lastProcessDefinitionId
            ?: throw IllegalStateException("Parent process definition not found for building block with documentId '$lastBuildingBlockDocumentId'")

        val processLinks = processLinkService.getProcessLinks(
            processDefinitionId,
            buildingBlockInstance.activityId
        ).filterIsInstance<BuildingBlockProcessLink>()

        val processLink = processLinks.singleOrNull()
            ?: throw IllegalStateException(
                "Expected a single building block process link for processDefinitionId '$processDefinitionId' " +
                    "and activityId '${buildingBlockInstance.activityId}', but found ${processLinks.size}"
            )

        return processLink.pluginConfigurationMappings
    }
}
