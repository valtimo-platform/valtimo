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

import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.document.service.DocumentService
import com.ritense.plugin.service.BuildingBlockPluginConfigurationResolver
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import java.util.UUID
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.delegate.DelegateTask
import org.springframework.stereotype.Component

@Component
@SkipComponentScan
class DefaultBuildingBlockPluginConfigurationResolver(
    private val buildingBlockInstanceService: BuildingBlockInstanceService,
    private val processLinkService: ProcessLinkService,
    private val linkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val documentService: DocumentService,
) : BuildingBlockPluginConfigurationResolver {

    override fun resolve(execution: DelegateExecution, pluginDefinitionKey: String): UUID? {
        val instance = buildingBlockInstanceService.getByProcessInstanceId(execution.processInstanceId)
            ?: return null
        val root = findRootInstance(instance)

        return findCallActivityMapping(root, pluginDefinitionKey)
            ?: findCaseLinkMapping(root, pluginDefinitionKey)
    }

    override fun resolve(task: DelegateTask, pluginDefinitionKey: String): UUID? {
        return resolve(task.execution, pluginDefinitionKey)
    }

    private fun findRootInstance(instance: BuildingBlockInstance): BuildingBlockInstance {
        val rootId = instance.rootBuildingBlockInstanceId ?: return instance
        return buildingBlockInstanceService.get(rootId) ?: instance
    }

    /**
     * Resolves plugin configuration from the BuildingBlockProcessLink on the call activity
     * that started the root building block.
     */
    private fun findCallActivityMapping(instance: BuildingBlockInstance, pluginDefinitionKey: String): UUID? {
        val activityId = instance.activityId ?: return null
        val callerProcessDefinitionId = instance.callerProcessDefinitionId ?: return null

        return processLinkService.getProcessLinks(callerProcessDefinitionId, activityId)
            .filterIsInstance<BuildingBlockProcessLink>()
            .firstOrNull()
            ?.pluginConfigurationMappings
            ?.get(pluginDefinitionKey)
    }

    private fun findCaseLinkMapping(instance: BuildingBlockInstance, pluginDefinitionKey: String): UUID? {
        val caseDocumentId = instance.caseDocumentId ?: return null
        val caseDocument = documentService.get(caseDocumentId.toString())
        val caseDefinitionId = caseDocument.definitionId().caseDefinitionId()

        val link = linkRepository.findByCaseDefinitionIdAndBuildingBlockDefinitionId(
            caseDefinitionId,
            instance.definition.id
        ) ?: return null

        return link.pluginConfigurationMappings[pluginDefinitionKey]
    }
}
