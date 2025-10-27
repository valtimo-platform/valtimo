package com.ritense.buildingblock.service

import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.BuildingBlockProcessDefinitionDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockProcessDefinitionWithLinksDto
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.processlink.web.rest.dto.ProcessLinkResponseDto
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
import java.nio.charset.StandardCharsets

@Service
class BuildingBlockProcessService(
    private val repositoryService: RepositoryService,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val operatonProcessService: OperatonProcessService,
    private val processLinkService: ProcessLinkService,
    private val processLinkMappers: List<ProcessLinkMapper>
) {

    @Transactional
    fun createEmptyProcessAndLink(title: String, key: String, versionTag: String): String {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(key, versionTag)
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
    fun getProcessDefinitionWithLinks(
        buildingBlockDefinitionKey: String,
        buildingBlockDefinitionVersionTag: String,
        processDefinitionKey: String
    ): BuildingBlockProcessDefinitionWithLinksDto? {
        val processDefinition = operatonProcessService.getDefinitionByKeyAndBuildingBlockDefinition(
            buildingBlockDefinitionKey,
            buildingBlockDefinitionVersionTag,
            processDefinitionKey
        )
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
}