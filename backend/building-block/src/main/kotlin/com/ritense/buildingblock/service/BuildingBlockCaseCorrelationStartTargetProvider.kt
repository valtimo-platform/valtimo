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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.service.CaseCorrelationStartTargetProvider
import java.util.UUID
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.instance.EventDefinition
import org.operaton.bpm.model.bpmn.instance.MessageEventDefinition
import org.operaton.bpm.model.bpmn.instance.StartEvent

/**
 * Makes the building blocks linked to a case definition startable by message. Only the main process
 * of a link is considered, and always in the version the link pins — engine-level start correlation
 * on a process definition key would pick the latest deployed version instead, which could start a
 * building block in a version the case does not use.
 */
class BuildingBlockCaseCorrelationStartTargetProvider(
    private val documentService: DocumentService,
    private val caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val repositoryService: RepositoryService,
) : CaseCorrelationStartTargetProvider {

    override fun getStartTargets(caseDocumentId: UUID, message: String): List<String> {
        val caseDefinitionId = runWithoutAuthorization {
            documentService.get(caseDocumentId.toString())
        }.definitionId().caseDefinitionId()

        return caseDefinitionBuildingBlockLinkRepository.findAllByCaseDefinitionId(caseDefinitionId)
            .mapNotNull { link ->
                processDefinitionBuildingBlockDefinitionRepository
                    .findByIdBuildingBlockDefinitionIdAndMain(link.buildingBlockDefinitionId, true)
                    ?.id?.processDefinitionId?.id
            }
            .filter { hasMessageStartEvent(it, message) }
    }

    private fun hasMessageStartEvent(processDefinitionId: String, message: String): Boolean {
        val bpmnModel = repositoryService.getBpmnModelInstance(processDefinitionId) ?: return false
        return bpmnModel.getModelElementsByType(StartEvent::class.java).any { startEvent ->
            startEvent.getChildElementsByType(EventDefinition::class.java)
                .filterIsInstance<MessageEventDefinition>()
                .any { it.message?.name == message }
        }
    }
}
