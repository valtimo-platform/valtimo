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
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.externalplugin.domain.ExternalPluginTaskFormProcessLink
import com.ritense.externalplugin.domain.ExternalPluginTaskFormProcessLink.Companion.PROCESS_LINK_TYPE
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkCreateRequestDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkDeployDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkExportResponseDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkResponseDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkUpdateRequestDto
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginTaskFormProcessLinkRepository
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType.FIXED
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.mapper.remapConfigurationIdField
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.processlink.web.rest.dto.ProcessLinkExportResponseDto
import com.ritense.processlink.web.rest.dto.ProcessLinkResponseDto
import com.ritense.processlink.web.rest.dto.ProcessLinkUpdateRequestDto
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseConfigurationIssueDetectedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import org.springframework.context.ApplicationEventPublisher
import java.util.UUID

/**
 * The task-form link is always a `FIXED` reference today; `pluginDefinitionKey`/`pluginVersion` are
 * derived from
 * [ExternalPluginTaskFormProcessLinkCreateRequestDto.externalPluginConfigurationId]'s definition at
 * save time — mirrors [ExternalPluginProcessLinkMapper]'s `FIXED` handling. The frontend keeps
 * sending `pluginVersion` for backward compatibility, but it is only used as a dangling-import
 * fallback when the configuration can no longer be resolved.
 */
class ExternalPluginTaskFormProcessLinkMapper(
    objectMapper: ObjectMapper,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val processLinkRepository: ExternalPluginTaskFormProcessLinkRepository,
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
            pluginVersion = processLink.pluginConfigurationReference.pluginDefinitionVersion,
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
            pluginConfigurationReference = createReference(
                createRequestDto.externalPluginConfigurationId,
                createRequestDto.pluginVersion,
            ),
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
            pluginConfigurationReference = createReference(
                updateRequestDto.externalPluginConfigurationId,
                updateRequestDto.pluginVersion,
            ),
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
            pluginDefinitionKey = processLink.pluginConfigurationReference.pluginDefinitionKey,
            pluginVersion = processLink.pluginConfigurationReference.pluginDefinitionVersion,
            bundleKey = processLink.bundleKey,
        )
    }

    /**
     * `externalPluginConfigurationId` is non-nullable on this link's deploy DTO (always `FIXED`),
     * so a mapping value of `null` (admin chose to leave it dangling) is left as the original,
     * unmapped id rather than nulled out — nulling it would fail deserialization outright.
     */
    override fun applyPluginConfigurationMappings(node: ObjectNode, mappings: Map<UUID, UUID?>) {
        remapConfigurationIdField(node, "externalPluginConfigurationId", mappings, allowNull = false)
    }

    /**
     * Mirrors [ExternalPluginProcessLinkMapper.afterImport]. Unlike the service-task link, the
     * task-form link's `externalPluginConfigurationId` is never nullable — it always references a
     * `FIXED` configuration — so "dangling" here only means the referenced configuration no longer
     * exists in the target environment.
     */
    override fun afterImport(
        caseDefinitionId: CaseDefinitionId,
        processDefinitionIds: Set<String>,
        applicationEventPublisher: ApplicationEventPublisher
    ) {
        val allLinks = processDefinitionIds.flatMap { pdId -> processLinkRepository.findByProcessDefinitionId(pdId) }

        val hasIssue = allLinks.any { link -> !configurationRepository.existsById(link.externalPluginConfigurationId) }

        if (hasIssue) {
            applicationEventPublisher.publishEvent(
                CaseConfigurationIssueDetectedEvent(caseDefinitionId, ExternalPluginProcessLinkMapper.ISSUE_TYPE)
            )
        } else {
            applicationEventPublisher.publishEvent(
                CaseConfigurationIssueResolvedEvent(caseDefinitionId, ExternalPluginProcessLinkMapper.ISSUE_TYPE)
            )
        }
    }

    /**
     * Always `FIXED` today: `pluginDefinitionKey`/`pluginVersion` are derived from
     * [externalPluginConfigurationId]'s definition, falling back to the dto-supplied [pluginVersion]
     * only when the configuration can no longer be resolved (dangling import).
     */
    private fun createReference(
        externalPluginConfigurationId: UUID,
        pluginVersion: String,
    ): PluginConfigurationReference {
        val definition = configurationRepository.findById(externalPluginConfigurationId)
            .map { configuration -> definitionRepository.findById(configuration.definitionId).orElse(null) }
            .orElse(null)
        return PluginConfigurationReference(
            type = FIXED,
            pluginDefinitionKey = definition?.pluginId,
            pluginDefinitionVersion = definition?.version ?: pluginVersion,
        )
    }
}
