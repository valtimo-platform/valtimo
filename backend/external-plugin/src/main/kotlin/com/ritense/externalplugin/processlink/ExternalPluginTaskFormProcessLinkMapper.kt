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

package com.ritense.externalplugin.processlink

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.domain.ExternalPluginTaskFormProcessLink
import com.ritense.externalplugin.domain.ExternalPluginTaskFormProcessLink.Companion.PROCESS_LINK_TYPE
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkCreateRequestDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkDeployDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkExportResponseDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkResponseDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkUpdateRequestDto
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.processlink.web.rest.dto.ProcessLinkExportResponseDto
import com.ritense.processlink.web.rest.dto.ProcessLinkResponseDto
import com.ritense.processlink.web.rest.dto.ProcessLinkUpdateRequestDto
import com.ritense.valtimo.contract.BlueprintId
import java.util.UUID

class ExternalPluginTaskFormProcessLinkMapper(
    objectMapper: ObjectMapper,
) : ProcessLinkMapper {

    init {
        objectMapper.registerSubtypes(
            ExternalPluginTaskFormProcessLinkCreateRequestDto::class.java,
            ExternalPluginTaskFormProcessLinkUpdateRequestDto::class.java,
            ExternalPluginTaskFormProcessLinkResponseDto::class.java,
            ExternalPluginTaskFormProcessLinkDeployDto::class.java,
            ExternalPluginTaskFormProcessLinkExportResponseDto::class.java,
        )
    }

    override fun supportsProcessLinkType(processLinkType: String) = processLinkType == PROCESS_LINK_TYPE

    override fun toProcessLinkResponseDto(processLink: ProcessLink): ProcessLinkResponseDto {
        processLink as ExternalPluginTaskFormProcessLink
        return ExternalPluginTaskFormProcessLinkResponseDto(
            id = processLink.id,
            processDefinitionId = processLink.processDefinitionId,
            activityId = processLink.activityId,
            activityType = processLink.activityType,
            externalPluginConfigurationId = processLink.externalPluginConfigurationId,
            pluginVersion = processLink.pluginVersion,
            bundleKey = processLink.bundleKey,
        )
    }

    override fun toNewProcessLink(createRequestDto: ProcessLinkCreateRequestDto, blueprintId: BlueprintId?): ProcessLink {
        createRequestDto as ExternalPluginTaskFormProcessLinkCreateRequestDto
        return ExternalPluginTaskFormProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = createRequestDto.processDefinitionId,
            activityId = createRequestDto.activityId,
            activityType = createRequestDto.activityType,
            externalPluginConfigurationId = createRequestDto.externalPluginConfigurationId,
            pluginVersion = createRequestDto.pluginVersion,
            bundleKey = createRequestDto.bundleKey,
        )
    }

    override fun toUpdatedProcessLink(
        processLinkToUpdate: ProcessLink,
        updateRequestDto: ProcessLinkUpdateRequestDto,
        blueprintId: BlueprintId?,
    ): ProcessLink {
        updateRequestDto as ExternalPluginTaskFormProcessLinkUpdateRequestDto
        assert(processLinkToUpdate.id == updateRequestDto.id)
        return ExternalPluginTaskFormProcessLink(
            id = updateRequestDto.id,
            processDefinitionId = processLinkToUpdate.processDefinitionId,
            activityId = processLinkToUpdate.activityId,
            activityType = processLinkToUpdate.activityType,
            externalPluginConfigurationId = updateRequestDto.externalPluginConfigurationId,
            pluginVersion = updateRequestDto.pluginVersion,
            bundleKey = updateRequestDto.bundleKey,
        )
    }

    override fun toProcessLinkCreateRequestDto(deployDto: ProcessLinkDeployDto, blueprintId: BlueprintId?): ProcessLinkCreateRequestDto {
        deployDto as ExternalPluginTaskFormProcessLinkDeployDto
        return ExternalPluginTaskFormProcessLinkCreateRequestDto(
            processDefinitionId = deployDto.processDefinitionId,
            activityId = deployDto.activityId,
            activityType = deployDto.activityType,
            externalPluginConfigurationId = deployDto.externalPluginConfigurationId,
            pluginVersion = deployDto.pluginVersion,
            bundleKey = deployDto.bundleKey,
        )
    }

    override fun toProcessLinkUpdateRequestDto(
        deployDto: ProcessLinkDeployDto,
        existingProcessLinkId: UUID,
        blueprintId: BlueprintId?,
    ): ProcessLinkUpdateRequestDto {
        deployDto as ExternalPluginTaskFormProcessLinkDeployDto
        return ExternalPluginTaskFormProcessLinkUpdateRequestDto(
            id = existingProcessLinkId,
            externalPluginConfigurationId = deployDto.externalPluginConfigurationId,
            pluginVersion = deployDto.pluginVersion,
            bundleKey = deployDto.bundleKey,
        )
    }

    override fun toProcessLinkExportResponseDto(processLink: ProcessLink): ProcessLinkExportResponseDto {
        processLink as ExternalPluginTaskFormProcessLink
        return ExternalPluginTaskFormProcessLinkExportResponseDto(
            activityId = processLink.activityId,
            activityType = processLink.activityType,
            externalPluginConfigurationId = processLink.externalPluginConfigurationId,
            pluginVersion = processLink.pluginVersion,
            bundleKey = processLink.bundleKey,
        )
    }
}
