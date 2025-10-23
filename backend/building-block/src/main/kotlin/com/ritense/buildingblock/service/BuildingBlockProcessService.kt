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

import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.BuildingBlockProcessDefinitionDto
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.process.ProcessConstants.OPERATION_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.DeploymentWithDefinitions
import org.operaton.bpm.model.bpmn.Bpmn
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.Process
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class BuildingBlockProcessService(
    private val repositoryService: RepositoryService,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository
) {
    @Transactional
    fun createEmptyProcessAndLink(title: String, key: String, versionTag: String): String {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(key, versionTag)
        val buildingBlockVersionProcessVersionTag = OPERATION_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX + buildingBlockDefinitionId.toString()
        val model = createMinimalModel(key, title, buildingBlockVersionProcessVersionTag)
        val fileName = "$key-$versionTag.bpmn"
        val deployment: DeploymentWithDefinitions = repositoryService
            .createDeployment()
            .addModelInstance(fileName, model)
            .deployWithResult()
        val processDefinitionId = deployment.deployedProcessDefinitions.first().id
        val linkId = ProcessDefinitionBuildingBlockDefinitionId(
            ProcessDefinitionId.of(processDefinitionId),
            buildingBlockDefinitionId
        )
        if (!processDefinitionBuildingBlockDefinitionRepository.existsById(linkId)) {
            processDefinitionBuildingBlockDefinitionRepository.save(ProcessDefinitionBuildingBlockDefinition(linkId, true))
        }
        return processDefinitionId
    }


    @Transactional(readOnly = true)
    fun getProcessDefinitionsForBuildingBlock(
        key: String,
        versionTag: String
    ): List<BuildingBlockProcessDefinitionDto> {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(key, versionTag)
        val links = processDefinitionBuildingBlockDefinitionRepository.findAllByIdBuildingBlockDefinitionId(buildingBlockDefinitionId)
        if (links.isEmpty()) return emptyList()

        val ids = links.map { it.id.processDefinitionId.id }.toSet()
        val definitions = repositoryService
            .createProcessDefinitionQuery()
            .processDefinitionIdIn(*ids.toTypedArray())
            .list()
        val definitionsById = definitions.associateBy { it.id }

        return links.mapNotNull { link ->
            definitionsById[link.id.processDefinitionId.id]?.let { processDefinition ->
                BuildingBlockProcessDefinitionDto(
                    id = processDefinition.id,
                    key = processDefinition.key,
                    name = processDefinition.name,
                    versionTag = processDefinition.versionTag,
                    main = link.main
                )
            }
        }
    }

    private fun createMinimalModel(processKey: String, processName: String, versionTag: String): BpmnModelInstance {
        val model = Bpmn.createExecutableProcess(processKey)
            .name(processName)
            .startEvent("StartEvent_1")
            .endEvent("EndEvent_1")
            .done()
        val process: Process = model.getModelElementsByType(Process::class.java).first()
        process.operatonVersionTag = versionTag
        return model
    }
}