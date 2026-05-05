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
import com.ritense.externalplugin.domain.ExternalPluginProcessLink
import com.ritense.externalplugin.domain.ExternalPluginProcessLink.Companion.PROCESS_LINK_TYPE
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkCreateRequestDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkDeployDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkExportResponseDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkResponseDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkUpdateRequestDto
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.processlink.web.rest.dto.ProcessLinkExportResponseDto
import com.ritense.processlink.web.rest.dto.ProcessLinkResponseDto
import com.ritense.processlink.web.rest.dto.ProcessLinkUpdateRequestDto
import com.ritense.valtimo.contract.BlueprintId
import java.util.UUID

class ExternalPluginProcessLinkMapper(
    objectMapper: ObjectMapper,
) : ProcessLinkMapper {

    init {
        objectMapper.registerSubtypes(
            ExternalPluginProcessLinkCreateRequestDto::class.java,
            ExternalPluginProcessLinkUpdateRequestDto::class.java,
            ExternalPluginProcessLinkResponseDto::class.java,
            ExternalPluginProcessLinkDeployDto::class.java,
            ExternalPluginProcessLinkExportResponseDto::class.java,
        )
    }

    override fun supportsProcessLinkType(processLinkType: String) = processLinkType == PROCESS_LINK_TYPE

    override fun toProcessLinkResponseDto(processLink: ProcessLink): ProcessLinkResponseDto {
        processLink as ExternalPluginProcessLink
        return ExternalPluginProcessLinkResponseDto(
            id = processLink.id,
            processDefinitionId = processLink.processDefinitionId,
            activityId = processLink.activityId,
            activityType = processLink.activityType,
            externalPluginConfigurationId = processLink.externalPluginConfigurationId,
            actionKey = processLink.actionKey,
            actionProperties = processLink.actionProperties,
        )
    }

    override fun toNewProcessLink(createRequestDto: ProcessLinkCreateRequestDto, blueprintId: BlueprintId?): ProcessLink {
        createRequestDto as ExternalPluginProcessLinkCreateRequestDto
        return ExternalPluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = createRequestDto.processDefinitionId,
            activityId = createRequestDto.activityId,
            activityType = createRequestDto.activityType,
            externalPluginConfigurationId = createRequestDto.externalPluginConfigurationId,
            actionKey = createRequestDto.actionKey,
            actionProperties = createRequestDto.actionProperties,
        )
    }

    override fun toUpdatedProcessLink(
        processLinkToUpdate: ProcessLink,
        updateRequestDto: ProcessLinkUpdateRequestDto,
        blueprintId: BlueprintId?,
    ): ProcessLink {
        updateRequestDto as ExternalPluginProcessLinkUpdateRequestDto
        assert(processLinkToUpdate.id == updateRequestDto.id)
        return ExternalPluginProcessLink(
            id = updateRequestDto.id,
            processDefinitionId = processLinkToUpdate.processDefinitionId,
            activityId = processLinkToUpdate.activityId,
            activityType = processLinkToUpdate.activityType,
            externalPluginConfigurationId = updateRequestDto.externalPluginConfigurationId,
            actionKey = updateRequestDto.actionKey,
            actionProperties = updateRequestDto.actionProperties,
        )
    }

    override fun toProcessLinkCreateRequestDto(deployDto: ProcessLinkDeployDto, blueprintId: BlueprintId?): ProcessLinkCreateRequestDto {
        deployDto as ExternalPluginProcessLinkDeployDto
        return ExternalPluginProcessLinkCreateRequestDto(
            processDefinitionId = deployDto.processDefinitionId,
            activityId = deployDto.activityId,
            activityType = deployDto.activityType,
            externalPluginConfigurationId = deployDto.externalPluginConfigurationId,
            actionKey = deployDto.actionKey,
            actionProperties = deployDto.actionProperties,
        )
    }

    override fun toProcessLinkUpdateRequestDto(
        deployDto: ProcessLinkDeployDto,
        existingProcessLinkId: UUID,
        blueprintId: BlueprintId?,
    ): ProcessLinkUpdateRequestDto {
        deployDto as ExternalPluginProcessLinkDeployDto
        return ExternalPluginProcessLinkUpdateRequestDto(
            id = existingProcessLinkId,
            externalPluginConfigurationId = deployDto.externalPluginConfigurationId,
            actionKey = deployDto.actionKey,
            actionProperties = deployDto.actionProperties,
        )
    }

    override fun toProcessLinkExportResponseDto(processLink: ProcessLink): ProcessLinkExportResponseDto {
        processLink as ExternalPluginProcessLink
        return ExternalPluginProcessLinkExportResponseDto(
            activityId = processLink.activityId,
            activityType = processLink.activityType,
            externalPluginConfigurationId = processLink.externalPluginConfigurationId,
            actionKey = processLink.actionKey,
            actionProperties = processLink.actionProperties,
        )
    }
}
