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

package com.ritense.buildingblock.processlink.mapper

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.exporter.request.BuildingBlockDefinitionExportRequest
import com.ritense.exporter.request.ExportRequest
import com.ritense.buildingblock.processlink.dto.BuildingBlockProcessLinkCreateRequestDto
import com.ritense.buildingblock.processlink.dto.BuildingBlockProcessLinkDeployDto
import com.ritense.buildingblock.processlink.dto.BuildingBlockProcessLinkExportResponseDto
import com.ritense.buildingblock.processlink.dto.BuildingBlockProcessLinkResponseDto
import com.ritense.buildingblock.processlink.dto.BuildingBlockProcessLinkUpdateRequestDto
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.logging.withLoggingContext
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.processlink.web.rest.dto.ProcessLinkExportResponseDto
import com.ritense.processlink.web.rest.dto.ProcessLinkResponseDto
import com.ritense.processlink.web.rest.dto.ProcessLinkUpdateRequestDto
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.springframework.stereotype.Component
import java.util.UUID

@Component
@SkipComponentScan
class BuildingBlockProcessLinkMapper(
    objectMapper: ObjectMapper,
    private val processLinkService: ProcessLinkService,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository
) : ProcessLinkMapper {

    init {
        objectMapper.registerSubtypes(
            BuildingBlockProcessLinkCreateRequestDto::class.java,
            BuildingBlockProcessLinkUpdateRequestDto::class.java,
            BuildingBlockProcessLinkResponseDto::class.java,
            BuildingBlockProcessLinkExportResponseDto::class.java,
            BuildingBlockProcessLinkDeployDto::class.java
        )
    }

    override fun supportsProcessLinkType(processLinkType: String): Boolean {
        return processLinkType == BuildingBlockProcessLink.PROCESS_LINK_TYPE
    }

    override fun toProcessLinkResponseDto(processLink: ProcessLink): ProcessLinkResponseDto {
        processLink as BuildingBlockProcessLink
        return withLoggingContext(ProcessLink::class, processLink.id) {
            BuildingBlockProcessLinkResponseDto(
                id = processLink.id,
                processDefinitionId = processLink.processDefinitionId,
                activityId = processLink.activityId,
                activityType = processLink.activityType,
                buildingBlockDefinitionKey = processLink.buildingBlockDefinitionId.key,
                buildingBlockDefinitionVersionTag = processLink.buildingBlockDefinitionId.versionTag.toString(),
                pluginConfigurationMappings = processLink.pluginConfigurationMappings,
                inputMappings = processLink.inputMappings.toInputDto(),
                outputMappings = processLink.outputMappings.toOutputDto()
            )
        }
    }

    override fun toProcessLinkCreateRequestDto(deployDto: ProcessLinkDeployDto): ProcessLinkCreateRequestDto {
        deployDto as BuildingBlockProcessLinkDeployDto
        return BuildingBlockProcessLinkCreateRequestDto(
            processDefinitionId = deployDto.processDefinitionId,
            activityId = deployDto.activityId,
            activityType = deployDto.activityType,
            buildingBlockDefinitionKey = deployDto.buildingBlockDefinitionKey,
            buildingBlockDefinitionVersionTag = deployDto.buildingBlockDefinitionVersionTag,
            pluginConfigurationMappings = deployDto.pluginConfigurationMappings,
            inputMappings = deployDto.inputMappings,
            outputMappings = deployDto.outputMappings
        )
    }

    override fun toProcessLinkUpdateRequestDto(
        deployDto: ProcessLinkDeployDto,
        existingProcessLinkId: UUID
    ): ProcessLinkUpdateRequestDto {
        deployDto as BuildingBlockProcessLinkDeployDto
        return BuildingBlockProcessLinkUpdateRequestDto(
            id = existingProcessLinkId,
            buildingBlockDefinitionKey = deployDto.buildingBlockDefinitionKey,
            buildingBlockDefinitionVersionTag = deployDto.buildingBlockDefinitionVersionTag,
            pluginConfigurationMappings = deployDto.pluginConfigurationMappings,
            inputMappings = deployDto.inputMappings,
            outputMappings = deployDto.outputMappings
        )
    }

    override fun toProcessLinkExportResponseDto(processLink: ProcessLink): ProcessLinkExportResponseDto {
        processLink as BuildingBlockProcessLink
        return withLoggingContext(ProcessLink::class, processLink.id) {
            BuildingBlockProcessLinkExportResponseDto(
                activityId = processLink.activityId,
                activityType = processLink.activityType,
                buildingBlockDefinitionKey = processLink.buildingBlockDefinitionId.key,
                buildingBlockDefinitionVersionTag = processLink.buildingBlockDefinitionId.versionTag.toString(),
                pluginConfigurationMappings = processLink.pluginConfigurationMappings,
                inputMappings = processLink.inputMappings.toInputDto(),
                outputMappings = processLink.outputMappings.toOutputDto()
            )
        }
    }

    override fun createRelatedExportRequests(processLink: ProcessLink, caseDefinitionId: CaseDefinitionId): Set<ExportRequest> {
        processLink as BuildingBlockProcessLink
        return setOf(BuildingBlockDefinitionExportRequest(processLink.buildingBlockDefinitionId))
    }

    override fun createRelatedExportRequestsForBuildingBlock(
        processLink: ProcessLink,
        buildingBlockDefinitionId: BuildingBlockDefinitionId
    ): Set<ExportRequest> {
        processLink as BuildingBlockProcessLink
        return setOf(BuildingBlockDefinitionExportRequest(processLink.buildingBlockDefinitionId))
    }

    override fun toNewProcessLink(
        createRequestDto: ProcessLinkCreateRequestDto,
        blueprintId: BlueprintId?
    ): ProcessLink {
        createRequestDto as BuildingBlockProcessLinkCreateRequestDto
        val isNestedBuildingBlockLink = isNestedBuildingBlockLink(blueprintId, createRequestDto.processDefinitionId)
        val buildingBlockDefinitionId = toDefinitionId(
            createRequestDto.buildingBlockDefinitionKey,
            createRequestDto.buildingBlockDefinitionVersionTag
        )
        return BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = createRequestDto.processDefinitionId,
            activityId = createRequestDto.activityId,
            activityType = createRequestDto.activityType,
            buildingBlockDefinitionId = buildingBlockDefinitionId,
            pluginConfigurationMappings = resolvePluginMappings(
                isNestedBuildingBlockLink,
                createRequestDto.pluginConfigurationMappings,
                buildingBlockDefinitionId
            ),
            inputMappings = createRequestDto.inputMappings.toInputDomain(),
            outputMappings = createRequestDto.outputMappings.toOutputDomain()
        )
    }

    override fun toUpdatedProcessLink(
        processLinkToUpdate: ProcessLink,
        updateRequestDto: ProcessLinkUpdateRequestDto,
        blueprintId: BlueprintId?
    ): ProcessLink {
        processLinkToUpdate as BuildingBlockProcessLink
        updateRequestDto as BuildingBlockProcessLinkUpdateRequestDto
        val isNestedBuildingBlockLink = isNestedBuildingBlockLink(blueprintId, processLinkToUpdate.processDefinitionId)
        return withLoggingContext(ProcessLink::class, processLinkToUpdate.id) {
            val buildingBlockDefinitionId = toDefinitionId(
                updateRequestDto.buildingBlockDefinitionKey,
                updateRequestDto.buildingBlockDefinitionVersionTag
            )
            BuildingBlockProcessLink(
                id = updateRequestDto.id,
                processDefinitionId = processLinkToUpdate.processDefinitionId,
                activityId = processLinkToUpdate.activityId,
                activityType = processLinkToUpdate.activityType,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = resolvePluginMappings(
                    isNestedBuildingBlockLink,
                    updateRequestDto.pluginConfigurationMappings,
                    buildingBlockDefinitionId
                ),
                inputMappings = updateRequestDto.inputMappings.toInputDomain(),
                outputMappings = updateRequestDto.outputMappings.toOutputDomain()
            )
        }
    }

    /**
     * Determines if this is a nested building block link (a building block referencing another building block).
     * Nested building block links don't require a CaseDefinitionId since they inherit plugin configurations
     * from the root process link at runtime.
     */
    private fun isNestedBuildingBlockLink(blueprintId: BlueprintId?, processDefinitionId: String): Boolean {
        val isNested = blueprintId is BuildingBlockDefinitionId ||
            processDefinitionBuildingBlockDefinitionRepository.existsByIdProcessDefinitionIdId(processDefinitionId)

        if (!isNested) {
            require(blueprintId is CaseDefinitionId) {
                "CaseDefinitionId is required for building-block process links in case processes"
            }
        }
        return isNested
    }

    /**
     * Resolves plugin configuration mappings. For nested building blocks, plugin configurations
     * are inherited from the root process link at runtime, so mappings are passed through as-is.
     * For top-level building blocks, mappings are validated against required plugins.
     */
    private fun resolvePluginMappings(
        isNestedBuildingBlockLink: Boolean,
        mappings: Map<String, UUID>,
        buildingBlockDefinitionId: BuildingBlockDefinitionId
    ): Map<String, UUID> {
        return if (isNestedBuildingBlockLink) {
            mappings
        } else {
            ensureMappings(mappings, buildingBlockDefinitionId)
        }
    }

    private fun ensureMappings(
        mappings: Map<String, UUID>,
        buildingBlockDefinitionId: BuildingBlockDefinitionId
    ): Map<String, UUID> {
        val mainProcessDefinitionId = processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(buildingBlockDefinitionId)
            .firstOrNull { it.main }
            ?.id
            ?.processDefinitionId
            ?.id
            ?: throw IllegalStateException(
                "No main process definition configured for building block '$buildingBlockDefinitionId'"
            )

        val requiredKeys = processLinkService.getProcessLinks(mainProcessDefinitionId)
            .filterIsInstance<PluginProcessLink>()
            .filter { it.pluginConfigurationReference.type == PluginConfigurationReferenceType.BUILDING_BLOCK }
            .mapNotNull { it.pluginConfigurationReference.pluginDefinitionKey }
            .toSet()

        if (requiredKeys.isEmpty()) {
            return mappings
        }

        require(mappings.isNotEmpty()) { "pluginConfigurationMappings must not be empty" }
        require(mappings.keys.none { it.isBlank() }) { "pluginConfigurationMappings contains blank plugin definition keys" }

        val missingKeys = requiredKeys - mappings.keys
        require(missingKeys.isEmpty()) {
            "pluginConfigurationMappings missing entries for plugin definitions: ${missingKeys.joinToString()}"
        }
        return mappings
    }

    private fun toDefinitionId(key: String, versionTag: String): BuildingBlockDefinitionId {
        return BuildingBlockDefinitionId.of(key, versionTag)
    }

    private fun List<com.ritense.buildingblock.processlink.dto.BuildingBlockInputMappingDto>.toInputDomain(): List<BuildingBlockInputMapping> =
        this.map { BuildingBlockInputMapping(source = it.source, target = it.target) }

    private fun List<com.ritense.buildingblock.processlink.dto.BuildingBlockOutputMappingDto>.toOutputDomain(): List<BuildingBlockOutputMapping> =
        this.map {
            BuildingBlockOutputMapping(
                source = it.source,
                target = it.target,
                syncTiming = it.syncTiming
            )
        }

    private fun List<BuildingBlockInputMapping>.toInputDto(): List<com.ritense.buildingblock.processlink.dto.BuildingBlockInputMappingDto> =
        this.map { com.ritense.buildingblock.processlink.dto.BuildingBlockInputMappingDto(source = it.source, target = it.target) }

    private fun List<BuildingBlockOutputMapping>.toOutputDto(): List<com.ritense.buildingblock.processlink.dto.BuildingBlockOutputMappingDto> =
        this.map {
            com.ritense.buildingblock.processlink.dto.BuildingBlockOutputMappingDto(
                source = it.source,
                target = it.target,
                syncTiming = it.syncTiming
            )
        }
}
