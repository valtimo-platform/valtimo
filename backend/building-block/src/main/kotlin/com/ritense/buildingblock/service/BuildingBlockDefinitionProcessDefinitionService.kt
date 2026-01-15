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

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.BuildingBlockProcessDefinitionDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockProcessDefinitionWithLinksDto
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.processlink.web.rest.dto.ProcessLinkResponseDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX
import com.ritense.valtimo.service.OperatonProcessService
import com.ritense.valtimo.web.rest.dto.ProcessDefinitionWithPropertiesDto
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.impl.util.IoUtil
import org.operaton.bpm.engine.repository.DeploymentWithDefinitions
import org.operaton.bpm.model.bpmn.Bpmn
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.Process
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.nio.charset.StandardCharsets

@Service
class BuildingBlockDefinitionProcessDefinitionService(
    private val repositoryService: RepositoryService,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val operatonProcessService: OperatonProcessService,
    private val processLinkService: ProcessLinkService,
    private val processLinkMappers: List<ProcessLinkMapper>,
    private val processDeploymentService: ProcessDeploymentService,
    private val authorizationService: AuthorizationService,
    private val buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker
) {

    @Transactional
    fun createEmptyProcessAndLink(title: String, key: String, versionTag: String): String {
        denyAuthorization()

        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(key, versionTag)
        buildingBlockDefinitionChecker.assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId)
        val buildingBlockVersionProcessVersionTag =
            OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX + buildingBlockDefinitionId.toString()
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
            processDefinitionBuildingBlockDefinitionRepository.save(
                ProcessDefinitionBuildingBlockDefinition(linkId, true)
            )
        }

        return processDefinitionId
    }

    @Transactional(readOnly = true)
    fun getProcessDefinitionsForBuildingBlock(
        key: String,
        versionTag: String
    ): List<BuildingBlockProcessDefinitionDto> {
        denyAuthorization()

        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(key, versionTag)
        val links = processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(buildingBlockDefinitionId)
        if (links.isEmpty()) return emptyList()

        val ids = links.map { it.id.processDefinitionId.id }.toSet()

        val definitions = repositoryService
            .createProcessDefinitionQuery()
            .processDefinitionIdIn(*ids.toTypedArray())
            .list()

        val definitionsById = definitions.associateBy { it.id }

        return links.mapNotNull { link ->
            definitionsById[link.id.processDefinitionId.id]?.let { pd ->
                BuildingBlockProcessDefinitionDto(
                    id = pd.id,
                    key = pd.key,
                    name = pd.name,
                    versionTag = pd.versionTag,
                    main = link.main
                )
            }
        }
    }

    @Transactional(readOnly = true)
    fun getProcessDefinitionWithProcessLinks(
        buildingBlockDefinitionKey: String,
        buildingBlockDefinitionVersionTag: String,
        processDefinitionId: String
    ): BuildingBlockProcessDefinitionWithLinksDto? {
        denyAuthorization()

        val buildingBlockDefinitionId =
            BuildingBlockDefinitionId.of(buildingBlockDefinitionKey, buildingBlockDefinitionVersionTag)
        val processDefinitionBuildingBlockDefinitionLink = processDefinitionBuildingBlockDefinitionRepository
            .findByIdBuildingBlockDefinitionIdAndIdProcessDefinitionId(
                buildingBlockDefinitionId,
                ProcessDefinitionId.of(processDefinitionId)
            ) ?: return null

        val processDefinition = runWithoutAuthorization {
            operatonProcessService.getProcessDefinitionById(
                processDefinitionBuildingBlockDefinitionLink.id.processDefinitionId.id
            )
        }

        val processDefinitionId = processDefinition.id

        val bpmnXml = String(
            IoUtil.readInputStream(
                repositoryService.getProcessModel(processDefinitionId),
                "processModelBpmn20Xml"
            ),
            StandardCharsets.UTF_8
        )

        val processLinks: List<ProcessLinkResponseDto> = processLinkService
            .getProcessLinks(processDefinitionId)
            .map { link ->
                getProcessLinkMapper(link.processLinkType).toProcessLinkResponseDto(link)
            }

        val processDto = ProcessDefinitionWithPropertiesDto.fromProcessDefinition(processDefinition)

        return BuildingBlockProcessDefinitionWithLinksDto(
            processDefinition = processDto,
            processLinks = processLinks,
            bpmn20Xml = bpmnXml
        )
    }

    @Transactional
    fun deployProcessDefinitionAndProcessLinks(
        buildingBlockDefinitionKey: String,
        buildingBlockDefinitionVersionTag: String,
        bpmn: MultipartFile,
        processLinks: List<ProcessLinkCreateRequestDto>,
        currentProcessDefinitionId: String?,
        main: Boolean
    ): ProcessDefinitionId? {
        denyAuthorization()

        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(
            buildingBlockDefinitionKey,
            buildingBlockDefinitionVersionTag
        )
        buildingBlockDefinitionChecker.assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId)

        val deployedProcessDefinitionId = processDeploymentService.deployProcessDefinitionAndProcessLinks(
            buildingBlockDefinitionId,
            bpmn,
            processLinks,
            currentProcessDefinitionId
        ) ?: return null

        val existingLink = findExistingLink(buildingBlockDefinitionId, currentProcessDefinitionId)
        val mainFlag = existingLink?.main ?: main

        val newLink = createOrReplaceLink(
            buildingBlockDefinitionId,
            deployedProcessDefinitionId,
            existingLink,
            mainFlag
        )

        if (newLink.main) {
            ensureOnlyOneMainLink(buildingBlockDefinitionId, deployedProcessDefinitionId)
        }

        setProcessVersionTag(deployedProcessDefinitionId.id, buildingBlockDefinitionId)

        return deployedProcessDefinitionId
    }

    @Transactional
    fun setMainLink(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        currentProcessDefinitionId: String? = null,
        deployedProcessDefinitionId: ProcessDefinitionId,
        main: Boolean
    ) {
        buildingBlockDefinitionChecker.assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId)
        val existingLink = if (currentProcessDefinitionId != null) {
            findExistingLink(buildingBlockDefinitionId, currentProcessDefinitionId)
        } else {
            null
        }
        val mainFlag = existingLink?.main ?: main

        val newLink = createOrReplaceLink(
            buildingBlockDefinitionId,
            deployedProcessDefinitionId,
            existingLink,
            mainFlag
        )

        if (newLink.main) {
            ensureOnlyOneMainLink(buildingBlockDefinitionId, deployedProcessDefinitionId)
        }
    }

    @Transactional(readOnly = true)
    fun isBuildingBlockProcess(processDefinitionId: String): Boolean {
        return processDefinitionBuildingBlockDefinitionRepository
            .existsByIdProcessDefinitionIdId(processDefinitionId)
    }

    @Transactional(readOnly = true)
    fun getMainProcessDefinitionKey(
        buildingBlockDefinitionKey: String,
        buildingBlockDefinitionVersionTag: String
    ): String? {
        denyAuthorization()

        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(
            buildingBlockDefinitionKey,
            buildingBlockDefinitionVersionTag
        )

        val links = processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(buildingBlockDefinitionId)

        val mainLink = links.firstOrNull { it.main } ?: return null

        return mainLink.processDefinitionKey
    }

    @Transactional
    fun setMainProcessDefinition(
        buildingBlockDefinitionKey: String,
        buildingBlockDefinitionVersionTag: String,
        processDefinitionId: String
    ) {
        denyAuthorization()

        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(
            buildingBlockDefinitionKey,
            buildingBlockDefinitionVersionTag
        )

        buildingBlockDefinitionChecker.assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId)

        val targetProcessDefinitionId = ProcessDefinitionId.of(processDefinitionId)

        val targetLink = processDefinitionBuildingBlockDefinitionRepository
            .findByIdBuildingBlockDefinitionIdAndIdProcessDefinitionId(
                buildingBlockDefinitionId,
                targetProcessDefinitionId
            ) ?: return

        if (targetLink.main) {
            return
        }

        val currentMainLink = processDefinitionBuildingBlockDefinitionRepository
            .findByIdBuildingBlockDefinitionIdAndMain(buildingBlockDefinitionId, true)

        processDefinitionBuildingBlockDefinitionRepository.save(
            ProcessDefinitionBuildingBlockDefinition(
                currentMainLink!!.id,
                false
            )
        )

        processDefinitionBuildingBlockDefinitionRepository.save(
            ProcessDefinitionBuildingBlockDefinition(
                ProcessDefinitionBuildingBlockDefinitionId(
                    targetProcessDefinitionId,
                    buildingBlockDefinitionId
                ),
                true
            )
        )
    }

    @Transactional
    fun deleteProcessDefinitionForBuildingBlock(
        buildingBlockDefinitionKey: String,
        buildingBlockDefinitionVersionTag: String,
        processDefinitionId: String
    ) {
        denyAuthorization()

        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(
            buildingBlockDefinitionKey,
            buildingBlockDefinitionVersionTag
        )

        buildingBlockDefinitionChecker.assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId)

        val targetProcessDefinitionId = ProcessDefinitionId.of(processDefinitionId)

        val link = processDefinitionBuildingBlockDefinitionRepository
            .findByIdBuildingBlockDefinitionIdAndIdProcessDefinitionId(
                buildingBlockDefinitionId,
                targetProcessDefinitionId
            )
            ?: return

        if (link.main) {
            throw IllegalStateException(
                "Cannot delete main process definition for building block $buildingBlockDefinitionId"
            )
        }

        processDefinitionBuildingBlockDefinitionRepository.delete(link)
        operatonProcessService.deleteProcessDefinition(processDefinitionId)
        // TODO: delete process links based on event sent from deleteProcessDefinition
        processLinkService.deleteProcessLinksForProcessDefinition(processDefinitionId)
    }


    private fun findExistingLink(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        currentProcessDefinitionId: String?
    ): ProcessDefinitionBuildingBlockDefinition? {
        if (currentProcessDefinitionId == null) return null

        return processDefinitionBuildingBlockDefinitionRepository
            .findByIdBuildingBlockDefinitionIdAndIdProcessDefinitionId(
                buildingBlockDefinitionId,
                ProcessDefinitionId.of(currentProcessDefinitionId)
            )
    }

    private fun createOrReplaceLink(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        newProcessDefinitionId: ProcessDefinitionId,
        existingLink: ProcessDefinitionBuildingBlockDefinition?,
        main: Boolean
    ): ProcessDefinitionBuildingBlockDefinition {
        existingLink?.let {
            processDefinitionBuildingBlockDefinitionRepository.delete(it)
        }

        val newLink = ProcessDefinitionBuildingBlockDefinition(
            ProcessDefinitionBuildingBlockDefinitionId(
                newProcessDefinitionId,
                buildingBlockDefinitionId
            ),
            main
        )

        return processDefinitionBuildingBlockDefinitionRepository.save(newLink)
    }

    private fun ensureOnlyOneMainLink(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        mainProcessDefinitionId: ProcessDefinitionId
    ) {
        val allLinks = processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(buildingBlockDefinitionId)

        allLinks
            .filter { it.id.processDefinitionId != mainProcessDefinitionId && it.main }
            .forEach { link ->
                val nonMainLink = ProcessDefinitionBuildingBlockDefinition(
                    ProcessDefinitionBuildingBlockDefinitionId(
                        link.id.processDefinitionId,
                        link.id.buildingBlockDefinitionId
                    ),
                    false
                )
                processDefinitionBuildingBlockDefinitionRepository.save(nonMainLink)
            }
    }

    private fun createMinimalModel(
        processKey: String,
        processName: String,
        versionTag: String
    ): BpmnModelInstance {
        val model = Bpmn.createExecutableProcess(processKey)
            .name(processName)
            .startEvent("StartEvent_1")
            .endEvent("EndEvent_1")
            .done()

        val process: Process = model.getModelElementsByType(Process::class.java).first()
        process.operatonVersionTag = versionTag

        return model
    }

    private fun getProcessLinkMapper(processLinkType: String): ProcessLinkMapper {
        return processLinkMappers.singleOrNull { it.supportsProcessLinkType(processLinkType) }
            ?: throw IllegalStateException("No ProcessLinkMapper found for processLinkType $processLinkType")
    }

    private fun setProcessVersionTag(
        deployedProcessDefinitionId: String,
        buildingBlockDefinitionId: BuildingBlockDefinitionId
    ) {
        val bpmnModelInstance =
            operatonProcessService.getBpmnModelInstanceByProcessDefinitionId(deployedProcessDefinitionId)

        operatonProcessService.setBuildingBlockDefinitionProcessesVersionTags(
            bpmnModelInstance,
            buildingBlockDefinitionId
        )
    }

    private fun denyAuthorization() {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                ProcessDefinitionBuildingBlockDefinition::class.java,
                Action.deny()
            )
        )
    }
}
