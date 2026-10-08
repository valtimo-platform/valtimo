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

package com.ritense.valtimo.processlink.mapper

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.exporter.manifest.ArtifactDependency
import com.ritense.exporter.manifest.DependencyType
import com.ritense.exporter.manifest.ResolvableValue
import com.ritense.logging.LoggableResource
import com.ritense.logging.withLoggingContext
import com.ritense.plugin.domain.PluginActionResultMapping
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.domain.PluginConfigurationReferenceType.BUILDING_BLOCK
import com.ritense.plugin.domain.PluginConfigurationReferenceType.FIXED
import com.ritense.plugin.domain.PluginConfigurationReferenceType.VALUE_RESOLVER
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.plugin.repository.PluginDefinitionRepository
import com.ritense.plugin.service.PluginActionResultMappingValidator
import com.ritense.plugin.service.PluginService.Companion.PROCESS_LINK_TYPE_PLUGIN
import com.ritense.plugin.web.rest.request.PluginProcessLinkCreateDto
import com.ritense.plugin.web.rest.request.PluginProcessLinkUpdateDto
import com.ritense.plugin.web.rest.result.PluginProcessLinkResultDto
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.mapper.remapConfigurationIdField
import com.ritense.processlink.repository.ValtimoPluginProcessLinkRepository
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.processlink.web.rest.dto.ProcessLinkUpdateRequestDto
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseConfigurationIssueDetectedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import com.ritense.valueresolver.ValueResolverService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Component
import java.util.UUID

@Component
@SkipComponentScan
class PluginProcessLinkMapper(
    objectMapper: ObjectMapper,
    private val pluginConfigurationRepository: PluginConfigurationRepository,
    private val pluginProcessLinkRepository: ValtimoPluginProcessLinkRepository,
    private val pluginDefinitionRepository: PluginDefinitionRepository,
    private val valueResolverService: ValueResolverService,
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
            PluginProcessLinkResultDto(
                id = processLink.id,
                processDefinitionId = processLink.processDefinitionId,
                activityId = processLink.activityId,
                activityType = processLink.activityType,
                pluginConfigurationId = processLink.pluginConfigurationId?.id,
                referenceType = processLink.pluginConfigurationReference.type,
                pluginDefinitionKey = processLink.pluginConfigurationReference.pluginDefinitionKey,
                pluginActionDefinitionKey = processLink.pluginActionDefinitionKey,
                actionProperties = processLink.actionProperties,
                actionResultMappings = processLink.actionResultMappings,
                pluginConfigurationIdExpression = processLink.pluginConfigurationIdExpression,
            )
        }
    }

    override fun toProcessLinkCreateRequestDto(deployDto: ProcessLinkDeployDto, blueprintId: BlueprintId?): PluginProcessLinkCreateDto {
        deployDto as PluginProcessLinkDeployDto
        val reference = toDeployedReference(deployDto, logIssues = true)
        return PluginProcessLinkCreateDto(
            processDefinitionId = deployDto.processDefinitionId,
            activityId = deployDto.activityId,
            pluginConfigurationId = reference.configurationId,
            pluginActionDefinitionKey = deployDto.pluginActionDefinitionKey,
            actionProperties = deployDto.actionProperties,
            activityType = deployDto.activityType,
            referenceType = reference.type,
            pluginDefinitionKey = deployDto.pluginDefinitionKey,
            actionResultMappings = deployDto.actionResultMappings,
            pluginConfigurationIdExpression = reference.expression,
        )
    }

    override fun toProcessLinkUpdateRequestDto(
        deployDto: ProcessLinkDeployDto,
        @LoggableResource(resourceType = ProcessLink::class) existingProcessLinkId: UUID,
        blueprintId: BlueprintId?
    ): ProcessLinkUpdateRequestDto {
        deployDto as PluginProcessLinkDeployDto
        // Logged already by toProcessLinkCreateRequestDto; importers call it first
        val reference = toDeployedReference(deployDto, logIssues = false)
        return PluginProcessLinkUpdateDto(
            id = existingProcessLinkId,
            pluginConfigurationId = reference.configurationId,
            pluginActionDefinitionKey = deployDto.pluginActionDefinitionKey,
            actionProperties = deployDto.actionProperties,
            referenceType = reference.type,
            pluginDefinitionKey = deployDto.pluginDefinitionKey,
            actionResultMappings = deployDto.actionResultMappings,
            pluginConfigurationIdExpression = reference.expression,
        )
    }

    override fun toProcessLinkExportResponseDto(processLink: ProcessLink): PluginProcessLinkExportResponseDto {
        return withLoggingContext(ProcessLink::class, processLink.id) {
            processLink as PluginProcessLink
            val definitionKey = processLink.pluginConfigurationReference.pluginDefinitionKey
                ?: processLink.pluginConfigurationId?.let { configId ->
                    pluginConfigurationRepository.findById(configId)
                        .map { it.pluginDefinition.key }
                        .orElse(null)
                }
            PluginProcessLinkExportResponseDto(
                activityId = processLink.activityId,
                activityType = processLink.activityType,
                pluginConfigurationId = processLink.pluginConfigurationId?.id,
                pluginActionDefinitionKey = processLink.pluginActionDefinitionKey,
                actionProperties = processLink.actionProperties,
                referenceType = processLink.pluginConfigurationReference.type,
                pluginDefinitionKey = definitionKey,
                actionResultMappings = processLink.actionResultMappings,
                pluginConfigurationIdExpression = processLink.pluginConfigurationIdExpression,
            )
        }
    }

    override fun toManifestDependencies(processLink: ProcessLink): Set<ArtifactDependency> {
        return withLoggingContext(ProcessLink::class, processLink.id) {
            processLink as PluginProcessLink
            val definitionKey = processLink.pluginConfigurationReference.pluginDefinitionKey
                ?: processLink.pluginConfigurationId?.let { configId ->
                    pluginConfigurationRepository.findById(configId)
                        .map { it.pluginDefinition.key }
                        .orElse(null)
                }
                ?: return@withLoggingContext setOf()

            val title = pluginDefinitionRepository.findById(definitionKey)
                .map { it.title }
                .orElse(definitionKey)

            setOf(
                ArtifactDependency(
                    type = DependencyType.PLUGIN,
                    key = ResolvableValue.of(definitionKey),
                    title = ResolvableValue.of(title),
                )
            )
        }
    }

    override fun toNewProcessLink(createRequestDto: ProcessLinkCreateRequestDto, blueprintId: BlueprintId?): PluginProcessLink {
        createRequestDto as PluginProcessLinkCreateDto
        val reference = createReference(createRequestDto.referenceType, createRequestDto.pluginDefinitionKey)
        val configurationId = createRequestDto.pluginConfigurationId?.let { PluginConfigurationId.existingId(it) }
        val expression = createRequestDto.pluginConfigurationIdExpression
        validateReference(reference.type, configurationId, expression)
        PluginActionResultMappingValidator.validate(createRequestDto.actionResultMappings)
        return PluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = createRequestDto.processDefinitionId,
            activityId = createRequestDto.activityId,
            activityType = createRequestDto.activityType,
            pluginConfigurationId = configurationId,
            pluginConfigurationReference = reference,
            pluginActionDefinitionKey = createRequestDto.pluginActionDefinitionKey,
            actionProperties = createRequestDto.actionProperties,
            actionResultMappings = createRequestDto.actionResultMappings,
            pluginConfigurationIdExpression = expression,
        )
    }

    override fun toUpdatedProcessLink(
        processLinkToUpdate: ProcessLink,
        updateRequestDto: ProcessLinkUpdateRequestDto,
        blueprintId: BlueprintId?
    ): PluginProcessLink {
        return withLoggingContext(ProcessLink::class, processLinkToUpdate.id) {
            updateRequestDto as PluginProcessLinkUpdateDto
            processLinkToUpdate as PluginProcessLink
            // Editor cannot show expression; keep stored one when update omits it
            val keepsStoredExpression = updateRequestDto.referenceType == VALUE_RESOLVER &&
                processLinkToUpdate.pluginConfigurationReference.type == VALUE_RESOLVER
            val expression = updateRequestDto.pluginConfigurationIdExpression
                ?: processLinkToUpdate.pluginConfigurationIdExpression.takeIf { keepsStoredExpression }
            val definitionKey = updateRequestDto.pluginDefinitionKey
                ?: processLinkToUpdate.pluginConfigurationReference.pluginDefinitionKey.takeIf { keepsStoredExpression }
            val reference = createReference(updateRequestDto.referenceType, definitionKey)
            val configurationId = updateRequestDto.pluginConfigurationId?.let { PluginConfigurationId.existingId(it) }
            validateReference(reference.type, configurationId, expression)
            PluginActionResultMappingValidator.validate(updateRequestDto.actionResultMappings)
            PluginProcessLink(
                id = updateRequestDto.id,
                processDefinitionId = processLinkToUpdate.processDefinitionId,
                activityId = processLinkToUpdate.activityId,
                activityType = processLinkToUpdate.activityType,
                pluginConfigurationId = configurationId,
                pluginConfigurationReference = reference,
                pluginActionDefinitionKey = updateRequestDto.pluginActionDefinitionKey,
                actionProperties = updateRequestDto.actionProperties,
                actionResultMappings = updateRequestDto.actionResultMappings,
                pluginConfigurationIdExpression = expression,
            )
        }
    }

    private fun createReference(
        type: PluginConfigurationReferenceType,
        pluginDefinitionKey: String?
    ): PluginConfigurationReference {
        return when (type) {
            FIXED -> PluginConfigurationReference(
                type = type,
                pluginDefinitionKey = pluginDefinitionKey,
            )
            BUILDING_BLOCK -> PluginConfigurationReference(
                type = type,
                pluginDefinitionKey = requireNotNull(pluginDefinitionKey) {
                    "pluginDefinitionKey is required when reference type is BUILDING_BLOCK"
                }
            )
            VALUE_RESOLVER -> PluginConfigurationReference(
                type = type,
                pluginDefinitionKey = requireNotNull(pluginDefinitionKey?.takeIf { it.isNotBlank() }) {
                    "pluginDefinitionKey is required when reference type is VALUE_RESOLVER"
                }
            )
        }
    }

    override fun applyPluginConfigurationMappings(node: ObjectNode, mappings: Map<UUID, UUID?>) {
        remapConfigurationIdField(node, "pluginConfigurationId", mappings)
    }

    override fun afterImport(
        caseDefinitionId: CaseDefinitionId,
        processDefinitionIds: Set<String>,
        applicationEventPublisher: ApplicationEventPublisher
    ) {
        val hasIssue = processDefinitionIds.isNotEmpty() &&
            pluginProcessLinkRepository.existsDanglingFixedLink(processDefinitionIds)

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

    private fun validateReference(
        type: PluginConfigurationReferenceType,
        pluginConfigurationId: PluginConfigurationId?,
        pluginConfigurationIdExpression: String?,
    ) {
        when (type) {
            FIXED -> {} // pluginConfigurationId may be null during import
            BUILDING_BLOCK -> require(pluginConfigurationId == null) {
                "pluginConfigurationId must be empty when reference type is BUILDING_BLOCK"
            }
            VALUE_RESOLVER -> {
                require(pluginConfigurationId == null) {
                    "pluginConfigurationId must be empty when reference type is VALUE_RESOLVER"
                }
                require(!pluginConfigurationIdExpression.isNullOrBlank()) {
                    "pluginConfigurationIdExpression is required when reference type is VALUE_RESOLVER"
                }
                require(isSupportedExpression(pluginConfigurationIdExpression)) {
                    "pluginConfigurationIdExpression '$pluginConfigurationIdExpression' is not supported by any value resolver"
                }
            }
        }
        if (type != VALUE_RESOLVER) {
            require(pluginConfigurationIdExpression == null) {
                "pluginConfigurationIdExpression can only be set when reference type is VALUE_RESOLVER"
            }
        }
    }

    private fun toDeployedReference(deployDto: PluginProcessLinkDeployDto, logIssues: Boolean): DeployedReference {
        val activityId = deployDto.activityId
        if (logIssues) {
            findPlaceholderName(deployDto.pluginActionDefinitionKey)?.let { name ->
                logger.error {
                    "Plugin process link for activity '$activityId' of process definition '${deployDto.processDefinitionId}': " +
                        "pluginActionDefinitionKey contains the unresolved placeholder '$name'. $PLACEHOLDER_HINT " +
                        "The link is stored as written and will fail when the activity runs."
                }
            }
        }

        val expression = deployDto.pluginConfigurationIdExpression
        if (deployDto.referenceType != VALUE_RESOLVER || expression == null) {
            return DeployedReference(deployDto.referenceType, deployDto.pluginConfigurationId, expression)
        }

        val placeholderName = findPlaceholderName(expression)
        if (placeholderName != null || !isSupportedExpression(expression)) {
            if (logIssues) {
                val problem = if (placeholderName != null) {
                    "contains the unresolved placeholder '$placeholderName'. $PLACEHOLDER_HINT"
                } else {
                    "has the value '$expression', which is neither a plugin configuration id (UUID) nor a value " +
                        "supported by a value resolver (such as 'pv:<variable>'). If pluginConfigurationId was written as " +
                        "an environment placeholder, '$expression' is the value it was replaced with."
                }
                logger.error {
                    "Plugin process link for activity '$activityId' of process definition '${deployDto.processDefinitionId}': " +
                        "pluginConfigurationId $problem The link is stored without a plugin configuration."
                }
            }
            return DeployedReference(FIXED, null, null)
        }

        require(!deployDto.pluginDefinitionKey.isNullOrBlank()) {
            "Plugin process link for activity '$activityId': pluginConfigurationId '$expression' is resolved per " +
                "process instance and therefore requires pluginDefinitionKey. If pluginConfigurationId was written " +
                "as an environment placeholder, '$expression' is the value it was replaced with."
        }
        if (logIssues && deployDto.activityType == ActivityTypeWithEventName.MESSAGE_START_EVENT_START) {
            logger.warn {
                "Plugin process link for activity '$activityId': pluginConfigurationId '$expression' is resolved per " +
                    "process instance, so it cannot be used to decide which messages start this process."
            }
        }
        return DeployedReference(VALUE_RESOLVER, null, expression)
    }

    private fun isSupportedExpression(expression: String): Boolean {
        if (expression.indexOf(':') <= 0) {
            return false
        }
        return valueResolverService.supportsValue(expression)
    }

    private fun findPlaceholderName(value: String): String? =
        PLACEHOLDER_PATTERN.find(value)?.groupValues?.get(1)?.substringBefore(':')

    private data class DeployedReference(
        val type: PluginConfigurationReferenceType,
        val configurationId: UUID?,
        val expression: String?,
    )

    companion object {
        const val ISSUE_TYPE = "plugin-process-link"
        private val logger = KotlinLogging.logger {}
        private val PLACEHOLDER_PATTERN = Regex("""\$\{([^{}]+)}""")
        private const val PLACEHOLDER_HINT = "Placeholders are only substituted during autodeployment, and only " +
            "for property names matching valtimo.import.whitelistedPaths."
    }
}
