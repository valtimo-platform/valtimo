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
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginProcessLink
import com.ritense.externalplugin.domain.ExternalPluginProcessLink.Companion.PROCESS_LINK_TYPE
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkCreateRequestDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkDeployDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkExportResponseDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkResponseDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkUpdateRequestDto
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginProcessLinkRepository
import com.ritense.plugin.domain.PluginActionResultMapping
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.domain.PluginConfigurationReferenceType.BUILDING_BLOCK
import com.ritense.plugin.domain.PluginConfigurationReferenceType.FIXED
import com.ritense.plugin.service.PluginActionResultMappingValidator
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
import com.ritense.valueresolver.exception.ValueResolverValidationException
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.ApplicationEventPublisher
import java.util.UUID

/**
 * Reference-model invariants mirror `PluginProcessLinkMapper.validateReference`:
 * - `FIXED`: [ExternalPluginProcessLinkCreateRequestDto.externalPluginConfigurationId] is required
 *   (nullable only for dangling imports); `pluginDefinitionKey`/`pluginVersion` are
 *   *derived from the configuration* at save time — the frontend only ever sends the config id.
 * - `BUILDING_BLOCK`: config id must be `NULL`; `pluginDefinitionKey` + `pluginVersion` are required
 *   from the DTO.
 */
class ExternalPluginProcessLinkMapper(
    objectMapper: ObjectMapper,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val processLinkRepository: ExternalPluginProcessLinkRepository,
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
            referenceType = processLink.pluginConfigurationReference.type,
            pluginDefinitionKey = processLink.pluginConfigurationReference.pluginDefinitionKey,
            pluginVersion = processLink.pluginConfigurationReference.pluginDefinitionVersion,
            actionResultMappings = processLink.actionResultMappings,
        )
    }

    override fun toNewProcessLink(createRequestDto: ProcessLinkCreateRequestDto, blueprintId: BlueprintId?): ProcessLink {
        createRequestDto as ExternalPluginProcessLinkCreateRequestDto
        val reference = createReference(
            createRequestDto.referenceType,
            createRequestDto.externalPluginConfigurationId,
            createRequestDto.pluginDefinitionKey,
            createRequestDto.pluginVersion,
        )
        validateReference(reference.type, createRequestDto.externalPluginConfigurationId)
        PluginActionResultMappingValidator.validate(createRequestDto.actionResultMappings)
        validateActionResultMappingSources(
            createRequestDto.externalPluginConfigurationId,
            reference,
            createRequestDto.actionKey,
            createRequestDto.actionResultMappings,
        )
        return ExternalPluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = createRequestDto.processDefinitionId,
            activityId = createRequestDto.activityId,
            activityType = createRequestDto.activityType,
            externalPluginConfigurationId = createRequestDto.externalPluginConfigurationId,
            actionKey = createRequestDto.actionKey,
            pluginConfigurationReference = reference,
            actionProperties = createRequestDto.actionProperties,
            actionResultMappings = createRequestDto.actionResultMappings,
        )
    }

    override fun toUpdatedProcessLink(
        processLinkToUpdate: ProcessLink,
        updateRequestDto: ProcessLinkUpdateRequestDto,
        blueprintId: BlueprintId?,
    ): ProcessLink {
        updateRequestDto as ExternalPluginProcessLinkUpdateRequestDto
        assert(processLinkToUpdate.id == updateRequestDto.id)
        val reference = createReference(
            updateRequestDto.referenceType,
            updateRequestDto.externalPluginConfigurationId,
            updateRequestDto.pluginDefinitionKey,
            updateRequestDto.pluginVersion,
        )
        validateReference(reference.type, updateRequestDto.externalPluginConfigurationId)
        PluginActionResultMappingValidator.validate(updateRequestDto.actionResultMappings)
        validateActionResultMappingSources(
            updateRequestDto.externalPluginConfigurationId,
            reference,
            updateRequestDto.actionKey,
            updateRequestDto.actionResultMappings,
        )
        return ExternalPluginProcessLink(
            id = updateRequestDto.id,
            processDefinitionId = processLinkToUpdate.processDefinitionId,
            activityId = processLinkToUpdate.activityId,
            activityType = processLinkToUpdate.activityType,
            externalPluginConfigurationId = updateRequestDto.externalPluginConfigurationId,
            actionKey = updateRequestDto.actionKey,
            pluginConfigurationReference = reference,
            actionProperties = updateRequestDto.actionProperties,
            actionResultMappings = updateRequestDto.actionResultMappings,
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
            referenceType = deployDto.referenceType,
            pluginDefinitionKey = deployDto.pluginDefinitionKey,
            pluginVersion = deployDto.pluginVersion,
            actionResultMappings = deployDto.actionResultMappings,
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
            referenceType = deployDto.referenceType,
            pluginDefinitionKey = deployDto.pluginDefinitionKey,
            pluginVersion = deployDto.pluginVersion,
            actionResultMappings = deployDto.actionResultMappings,
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
            referenceType = processLink.pluginConfigurationReference.type,
            pluginDefinitionKey = processLink.pluginConfigurationReference.pluginDefinitionKey,
            pluginVersion = processLink.pluginConfigurationReference.pluginDefinitionVersion,
            actionResultMappings = processLink.actionResultMappings,
        )
    }

    override fun applyPluginConfigurationMappings(node: ObjectNode, mappings: Map<UUID, UUID?>) {
        remapConfigurationIdField(node, "externalPluginConfigurationId", mappings)
    }

    /**
     * Mirrors [com.ritense.valtimo.processlink.mapper.PluginProcessLinkMapper.afterImport]: a `FIXED`
     * reference whose configuration id is `null` (left dangling by the import wizard) or no longer
     * resolves to an existing configuration is a configuration issue. `BUILDING_BLOCK` references are
     * never dangling in this sense — they have no configuration id to lose.
     */
    override fun afterImport(
        caseDefinitionId: CaseDefinitionId,
        processDefinitionIds: Set<String>,
        applicationEventPublisher: ApplicationEventPublisher
    ) {
        val allLinks = processDefinitionIds.flatMap { pdId -> processLinkRepository.findByProcessDefinitionId(pdId) }

        val hasIssue = allLinks.any { link ->
            if (link.pluginConfigurationReference.type != FIXED) {
                return@any false
            }

            val configId = link.externalPluginConfigurationId ?: return@any true
            !configurationRepository.existsById(configId)
        }

        if (hasIssue) {
            applicationEventPublisher.publishEvent(
                CaseConfigurationIssueDetectedEvent(caseDefinitionId, ISSUE_TYPE)
            )
        } else {
            applicationEventPublisher.publishEvent(
                CaseConfigurationIssueResolvedEvent(caseDefinitionId, ISSUE_TYPE)
            )
        }
    }

    /**
     * For `FIXED`, `pluginDefinitionKey`/`pluginVersion` are always derived from the configuration
     * — even if the caller (deploy DTOs, legacy imports) supplied values, those are ignored so the
     * reference can never drift from the actual configuration it points at. For `BUILDING_BLOCK`,
     * both must be supplied by the caller since there is no configuration id to derive them from.
     */
    private fun createReference(
        type: PluginConfigurationReferenceType,
        externalPluginConfigurationId: UUID?,
        pluginDefinitionKey: String?,
        pluginVersion: String?,
    ): PluginConfigurationReference {
        return when (type) {
            FIXED -> {
                val definition = externalPluginConfigurationId?.let { configId ->
                    configurationRepository.findById(configId)
                        .map { configuration -> definitionRepository.findById(configuration.definitionId).orElse(null) }
                        .orElse(null)
                }
                PluginConfigurationReference(
                    type = type,
                    pluginDefinitionKey = definition?.pluginId ?: pluginDefinitionKey,
                    pluginDefinitionVersion = definition?.version ?: pluginVersion,
                )
            }
            BUILDING_BLOCK -> PluginConfigurationReference(
                type = type,
                pluginDefinitionKey = requireNotNull(pluginDefinitionKey) {
                    "pluginDefinitionKey is required when reference type is BUILDING_BLOCK"
                },
                pluginDefinitionVersion = requireNotNull(pluginVersion) {
                    "pluginVersion is required when reference type is BUILDING_BLOCK"
                },
            )
        }
    }

    private fun validateReference(
        type: PluginConfigurationReferenceType,
        externalPluginConfigurationId: UUID?,
    ) {
        when (type) {
            FIXED -> {} // externalPluginConfigurationId may be null during import (dangling)
            BUILDING_BLOCK -> require(externalPluginConfigurationId == null) {
                "externalPluginConfigurationId must be empty when reference type is BUILDING_BLOCK"
            }
        }
    }

    /**
     * A mapping source is only meaningful when the action declares its output shape in the
     * manifest — there is no free-text pointer anymore, the frontend stepper offers a dropdown of
     * the declared `outputs` keys. Resolves the link's definition ([FIXED] via the configuration,
     * [BUILDING_BLOCK] via `pluginId`+version) and checks each mapping's first JSON-pointer segment
     * is a declared key; an action with no/empty `outputs` cannot carry any mappings at all.
     * Lenient (skip validation, log a warning) when the definition or its manifest can't be
     * resolved — import/legacy scenarios where the plugin isn't installed yet or predates this
     * feature must not block saving the link.
     */
    private fun validateActionResultMappingSources(
        externalPluginConfigurationId: UUID?,
        reference: PluginConfigurationReference,
        actionKey: String,
        mappings: List<PluginActionResultMapping>,
    ) {
        if (mappings.isEmpty()) {
            return
        }

        val definition = resolveDefinition(externalPluginConfigurationId, reference)
        if (definition == null) {
            logger.warn {
                "Could not resolve the definition for external plugin process link action '$actionKey' " +
                    "(reference '${reference.pluginDefinitionKey}@${reference.pluginDefinitionVersion}') — " +
                    "skipping action result mapping source validation"
            }
            return
        }

        val declaredOutputs = declaredActionOutputs(definition, actionKey)
        if (declaredOutputs == null) {
            logger.warn {
                "Plugin '${definition.pluginId}@${definition.version}' manifest does not declare its " +
                    "'actions' — skipping action result mapping source validation for action '$actionKey'"
            }
            return
        }

        if (declaredOutputs.isEmpty()) {
            throw ValueResolverValidationException(
                "Action '$actionKey' of plugin '${definition.pluginId}@${definition.version}' does not " +
                    "declare any outputs — it cannot be used with action result mappings"
            )
        }

        mappings.forEach { mapping ->
            val key = mapping.source.removePrefix("/").substringBefore("/")
            if (key !in declaredOutputs) {
                throw ValueResolverValidationException(
                    "Action result mapping source '${mapping.source}' does not match a declared output of " +
                        "action '$actionKey' (plugin '${definition.pluginId}@${definition.version}') — " +
                        "declared outputs: ${declaredOutputs.joinToString()}"
                )
            }
        }
    }

    private fun resolveDefinition(
        externalPluginConfigurationId: UUID?,
        reference: PluginConfigurationReference,
    ): ExternalPluginDefinition? {
        return when (reference.type) {
            FIXED -> externalPluginConfigurationId
                ?.let { configId -> configurationRepository.findById(configId).orElse(null) }
                ?.let { configuration -> definitionRepository.findById(configuration.definitionId).orElse(null) }

            BUILDING_BLOCK -> {
                val pluginId = reference.pluginDefinitionKey
                val version = reference.pluginDefinitionVersion
                if (pluginId == null || version == null) {
                    null
                } else {
                    definitionRepository.findByPluginIdAndVersion(pluginId, version)
                }
            }
        }
    }

    /**
     * `null` means the manifest doesn't declare `actions` at all (lenient); an empty list means the
     * action key wasn't found, or was found without an `outputs` array — both treated as "no
     * declared outputs" (reject any mapping).
     */
    private fun declaredActionOutputs(definition: ExternalPluginDefinition, actionKey: String): List<String>? {
        val actions = definition.manifestJson?.get("actions") ?: return null
        if (!actions.isArray) {
            return null
        }
        val action = actions.firstOrNull { it.get("key")?.asText() == actionKey } ?: return emptyList()
        val outputs = action.get("outputs") ?: return emptyList()
        if (!outputs.isArray) {
            return emptyList()
        }
        return outputs.mapNotNull { it.asText(null) }
    }

    companion object {
        const val ISSUE_TYPE = "external-plugin-process-link"
        private val logger = KotlinLogging.logger {}
    }
}
