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

package com.ritense.valtimo.processlink.mapper

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.logging.LoggableResource
import com.ritense.logging.withLoggingContext
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.plugin.service.PluginService
import com.ritense.plugin.service.PluginService.Companion.PROCESS_LINK_TYPE_PLUGIN
import com.ritense.plugin.web.rest.request.PluginProcessLinkCreateDto
import com.ritense.plugin.web.rest.request.PluginProcessLinkUpdateDto
import com.ritense.plugin.web.rest.result.PluginProcessLinkResultDto
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.processlink.web.rest.dto.ProcessLinkUpdateRequestDto
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component
import java.util.UUID

@Component
@SkipComponentScan
class PluginProcessLinkMapper(
    objectMapper: ObjectMapper,
    private val pluginService: PluginService,
) : ProcessLinkMapper {

    init {
        objectMapper.registerSubtypes(
            PluginProcessLinkCreateDto::class.java,
            PluginProcessLinkDeployDto::class.java,
            PluginProcessLinkExportResponseDto::class.java,
            PluginProcessLinkResultDto::class.java,
            PluginProcessLinkUpdateDto::class.java
        )
    }

    override fun supportsProcessLinkType(processLinkType: String) = processLinkType == PROCESS_LINK_TYPE_PLUGIN

    override fun toProcessLinkResponseDto(processLink: ProcessLink): PluginProcessLinkResultDto {
        return withLoggingContext(ProcessLink::class, processLink.id) {
            processLink as PluginProcessLink
            val pluginConfigurationTitle = processLink.pluginConfigurationId?.let { configId ->
                pluginService.getPluginConfiguration(configId).title
            }
            PluginProcessLinkResultDto(
                id = processLink.id,
                processDefinitionId = processLink.processDefinitionId,
                activityId = processLink.activityId,
                activityType = processLink.activityType,
                pluginConfigurationId = processLink.pluginConfigurationId?.id,
                pluginConfigurationTitle = pluginConfigurationTitle,
                referenceType = processLink.pluginConfigurationReference.type,
                pluginDefinitionKey = processLink.pluginConfigurationReference.pluginDefinitionKey,
                pluginActionDefinitionKey = processLink.pluginActionDefinitionKey,
                actionProperties = processLink.actionProperties,
            )
        }
    }

    override fun toProcessLinkCreateRequestDto(deployDto: ProcessLinkDeployDto): PluginProcessLinkCreateDto {
        deployDto as PluginProcessLinkDeployDto
        return PluginProcessLinkCreateDto(
            processDefinitionId = deployDto.processDefinitionId,
            activityId = deployDto.activityId,
            pluginConfigurationId = deployDto.pluginConfigurationId,
            pluginActionDefinitionKey = deployDto.pluginActionDefinitionKey,
            actionProperties = deployDto.actionProperties,
            activityType = deployDto.activityType,
            referenceType = deployDto.referenceType,
            pluginDefinitionKey = deployDto.pluginDefinitionKey,
        )
    }

    override fun toProcessLinkUpdateRequestDto(
        deployDto: ProcessLinkDeployDto,
        @LoggableResource(resourceType = ProcessLink::class) existingProcessLinkId: UUID
    ): ProcessLinkUpdateRequestDto {
        deployDto as PluginProcessLinkDeployDto
        return PluginProcessLinkUpdateDto(
            id = existingProcessLinkId,
            pluginConfigurationId = deployDto.pluginConfigurationId,
            pluginActionDefinitionKey = deployDto.pluginActionDefinitionKey,
            actionProperties = deployDto.actionProperties,
            referenceType = deployDto.referenceType,
            pluginDefinitionKey = deployDto.pluginDefinitionKey,
        )
    }

    override fun toProcessLinkExportResponseDto(processLink: ProcessLink): PluginProcessLinkExportResponseDto {
        return withLoggingContext(ProcessLink::class, processLink.id) {
            processLink as PluginProcessLink
            PluginProcessLinkExportResponseDto(
                activityId = processLink.activityId,
                activityType = processLink.activityType,
                pluginConfigurationId = processLink.pluginConfigurationId?.id,
                pluginActionDefinitionKey = processLink.pluginActionDefinitionKey,
                actionProperties = processLink.actionProperties,
                referenceType = processLink.pluginConfigurationReference.type,
                pluginDefinitionKey = processLink.pluginConfigurationReference.pluginDefinitionKey,
            )
        }
    }

    override fun toNewProcessLink(createRequestDto: ProcessLinkCreateRequestDto, blueprintId: BlueprintId?): PluginProcessLink {
        createRequestDto as PluginProcessLinkCreateDto
        val reference = createReference(createRequestDto.referenceType, createRequestDto.pluginDefinitionKey)
        val configurationId = createRequestDto.pluginConfigurationId?.let { PluginConfigurationId.existingId(it) }
        validateReference(reference.type, configurationId)
        return PluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = createRequestDto.processDefinitionId,
            activityId = createRequestDto.activityId,
            activityType = createRequestDto.activityType,
            pluginConfigurationId = configurationId,
            pluginConfigurationReference = reference,
            pluginActionDefinitionKey = createRequestDto.pluginActionDefinitionKey,
            actionProperties = createRequestDto.actionProperties,
        )
    }

    override fun toUpdatedProcessLink(
        processLinkToUpdate: ProcessLink,
        updateRequestDto: ProcessLinkUpdateRequestDto,
        blueprintId: BlueprintId?
    ): PluginProcessLink {
        return withLoggingContext(ProcessLink::class, processLinkToUpdate.id) {
            updateRequestDto as PluginProcessLinkUpdateDto
            val reference = createReference(updateRequestDto.referenceType, updateRequestDto.pluginDefinitionKey)
            val configurationId = updateRequestDto.pluginConfigurationId?.let { PluginConfigurationId.existingId(it) }
            validateReference(reference.type, configurationId)
            PluginProcessLink(
                id = updateRequestDto.id,
                processDefinitionId = processLinkToUpdate.processDefinitionId,
                activityId = processLinkToUpdate.activityId,
                activityType = processLinkToUpdate.activityType,
                pluginConfigurationId = configurationId,
                pluginConfigurationReference = reference,
                pluginActionDefinitionKey = updateRequestDto.pluginActionDefinitionKey,
                actionProperties = updateRequestDto.actionProperties,
            )
        }
    }

    private fun createReference(
        type: PluginConfigurationReferenceType,
        pluginDefinitionKey: String?
    ): PluginConfigurationReference {
        return when (type) {
            PluginConfigurationReferenceType.FIXED -> PluginConfigurationReference(type)
            PluginConfigurationReferenceType.BUILDING_BLOCK -> PluginConfigurationReference(
                type = type,
                pluginDefinitionKey = requireNotNull(pluginDefinitionKey) {
                    "pluginDefinitionKey is required when reference type is BUILDING_BLOCK"
                }
            )
        }
    }

    private fun validateReference(
        type: PluginConfigurationReferenceType,
        pluginConfigurationId: PluginConfigurationId?
    ) {
        when (type) {
            PluginConfigurationReferenceType.FIXED -> requireNotNull(pluginConfigurationId) {
                "pluginConfigurationId is required when reference type is FIXED"
            }
            PluginConfigurationReferenceType.BUILDING_BLOCK -> require(pluginConfigurationId == null) {
                "pluginConfigurationId must be empty when reference type is BUILDING_BLOCK"
            }
        }
    }
}
