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

package com.ritense.externalplugin.service

import com.ritense.case_.service.CaseExternalPluginTabService
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginProcessLinkRepository
import com.ritense.externalplugin.repository.ExternalPluginTaskFormProcessLinkRepository
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.service.BuildingBlockPluginMappingUsageFinder
import com.ritense.plugin.service.ProcessDefinitionUsageMeta
import com.ritense.plugin.service.ProcessDefinitionUsageMetaResolver
import com.ritense.plugin.web.rest.dto.PluginUsageDto
import com.ritense.plugin.web.rest.dto.PluginUsageParentType
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.Optional
import java.util.UUID

@Service
@SkipComponentScan
@Transactional(readOnly = true)
class ExternalPluginHostUsageResolver(
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val processLinkRepository: ExternalPluginProcessLinkRepository,
    private val taskFormProcessLinkRepository: ExternalPluginTaskFormProcessLinkRepository,
    /** Shared with the embedded plugin module — resolves process-definition/parent/activity meta. */
    private val processDefinitionUsageMetaResolver: ProcessDefinitionUsageMetaResolver,
    /**
     * Optional so the module still wires up if the case module's tab service is unavailable; in a
     * normal GZAC deployment it is always present (external-plugin depends on case).
     */
    private val caseExternalPluginTabService: Optional<CaseExternalPluginTabService>,
    /**
     * Optional for the same reason: implemented by the building-block module, which external-plugin
     * cannot depend on directly (the SPI lives in `:backend:plugin`). Without it, building-block
     * mapping usages simply don't block deletion — matching a deployment without building blocks.
     */
    private val buildingBlockMappingUsageFinder: Optional<BuildingBlockPluginMappingUsageFinder> = Optional.empty(),
) {

    fun findUsagesForHost(hostId: UUID): List<PluginUsageDto> {
        val definitions = definitionRepository.findAllByHostId(hostId)
        val configurations = collectConfigurations(definitions)
        return buildUsageDtos(configurations) +
            buildCaseTabUsageDtos(configurations) +
            buildBuildingBlockMappingUsageDtos(configurations) +
            buildDefinitionReferenceUsageDtos(definitions)
    }

    fun findUsagesForConfiguration(configurationId: UUID): List<PluginUsageDto> {
        val configuration = configurationRepository.findById(configurationId).orElse(null)
            ?: return emptyList()
        return buildUsageDtos(listOf(configuration)) +
            buildCaseTabUsageDtos(listOf(configuration)) +
            buildBuildingBlockMappingUsageDtos(listOf(configuration))
    }

    /**
     * A `case-tab` of an external plugin references the configuration without a process link, so it
     * counts as a usage that blocks deletion (system-plan §12).
     */
    private fun buildCaseTabUsageDtos(configurations: List<ExternalPluginConfiguration>): List<PluginUsageDto> {
        val tabService = caseExternalPluginTabService.orElse(null) ?: return emptyList()
        if (configurations.isEmpty()) return emptyList()
        return configurations.flatMap { configuration ->
            tabService.findUsagesForConfiguration(configuration.id).map { usage ->
                PluginUsageDto(
                    configurationId = configuration.id,
                    configurationTitle = configuration.title,
                    parentType = PluginUsageParentType.CASE,
                    parentKey = usage.caseDefinitionKey,
                    parentVersionTag = usage.caseDefinitionVersionTag,
                    tabKey = usage.tabKey,
                    tabName = usage.tabName,
                )
            }
        }
    }

    private fun buildUsageDtos(configurations: List<ExternalPluginConfiguration>): List<PluginUsageDto> {
        if (configurations.isEmpty()) return emptyList()
        val configById = configurations.associateBy { it.id }
        // Both external-plugin process-link surfaces reference a configuration: service-task actions
        // and user-task forms. Each is its own discriminator (a subtype-typed JPA repository only
        // returns rows of its own type), so we union both to guard deletion against either usage.
        val links = collectUsageLinks(configById.keys)
        if (links.isEmpty()) return emptyList()

        val metaCache = mutableMapOf<String, ProcessDefinitionUsageMeta>()

        return links.map { link ->
            val meta = metaCache.getOrPut(link.processDefinitionId) {
                processDefinitionUsageMetaResolver.resolveMeta(link.processDefinitionId)
            }
            val configuration = configById.getValue(link.configurationId)
            PluginUsageDto(
                configurationId = configuration.id,
                configurationTitle = configuration.title,
                parentType = meta.parentType,
                parentKey = meta.parentKey,
                parentVersionTag = meta.parentVersionTag,
                processDefinitionId = link.processDefinitionId,
                processDefinitionKey = meta.processDefinitionKey,
                processDefinitionName = meta.processDefinitionName,
                activityId = link.activityId,
                activityName = processDefinitionUsageMetaResolver.resolveActivityName(meta, link.activityId),
                processLinkId = link.id,
            )
        }
    }

    /**
     * A building block references a configuration through its `pluginConfigurationMappings` (on the
     * call-activity process link or the case-definition ↔ BB link) rather than through a process
     * link's own configuration id, so those mappings must equally block deletion — otherwise the
     * mapping would silently dangle and every run of the building block would fail to resolve its
     * plugin.
     */
    private fun buildBuildingBlockMappingUsageDtos(
        configurations: List<ExternalPluginConfiguration>,
    ): List<PluginUsageDto> {
        val finder = buildingBlockMappingUsageFinder.orElse(null) ?: return emptyList()
        if (configurations.isEmpty()) return emptyList()

        val metaCache = mutableMapOf<String, ProcessDefinitionUsageMeta>()
        return configurations.flatMap { configuration ->
            finder.findUsages(configuration.id).map { usage ->
                val processDefinitionId = usage.processDefinitionId
                if (processDefinitionId != null) {
                    val meta = metaCache.getOrPut(processDefinitionId) {
                        processDefinitionUsageMetaResolver.resolveMeta(processDefinitionId)
                    }
                    PluginUsageDto(
                        configurationId = configuration.id,
                        configurationTitle = configuration.title,
                        parentType = meta.parentType,
                        parentKey = meta.parentKey,
                        parentVersionTag = meta.parentVersionTag,
                        processDefinitionId = processDefinitionId,
                        processDefinitionKey = meta.processDefinitionKey,
                        processDefinitionName = meta.processDefinitionName,
                        activityId = usage.activityId,
                        activityName = usage.activityId?.let { processDefinitionUsageMetaResolver.resolveActivityName(meta, it) },
                        processLinkId = usage.processLinkId,
                        buildingBlockKey = usage.buildingBlockDefinitionKey,
                    )
                } else {
                    PluginUsageDto(
                        configurationId = configuration.id,
                        configurationTitle = configuration.title,
                        parentType = PluginUsageParentType.CASE,
                        parentKey = usage.caseDefinitionKey,
                        parentVersionTag = usage.caseDefinitionVersionTag,
                        buildingBlockKey = usage.buildingBlockDefinitionKey,
                    )
                }
            }
        }
    }

    /**
     * A `BUILDING_BLOCK`-reference process link pins a plugin *definition* (`pluginId@version`),
     * not a configuration — it never blocks deleting an individual configuration, but it must block
     * deleting the host that serves the definition: without the host, the reference can never
     * resolve again, even when no case definition uses the building block yet. The shared
     * [PluginUsageDto] requires a configuration identity, so the definition stands in:
     * `configurationId` carries the definition id and `configurationTitle` the `pluginId@version`
     * pair the link is pinned to.
     */
    private fun buildDefinitionReferenceUsageDtos(
        definitions: List<ExternalPluginDefinition>,
    ): List<PluginUsageDto> {
        if (definitions.isEmpty()) return emptyList()

        val links = processLinkRepository.findAllByReferenceTypeAndPluginDefinitionKeyIn(
            PluginConfigurationReferenceType.BUILDING_BLOCK,
            definitions.map { it.pluginId }.toSet(),
        )
        if (links.isEmpty()) return emptyList()

        val definitionByKeyAndVersion = definitions.associateBy { it.pluginId to it.version }
        val metaCache = mutableMapOf<String, ProcessDefinitionUsageMeta>()

        return links.mapNotNull { link ->
            val reference = link.pluginConfigurationReference
            val definition = definitionByKeyAndVersion[reference.pluginDefinitionKey to reference.pluginDefinitionVersion]
                ?: return@mapNotNull null
            val meta = metaCache.getOrPut(link.processDefinitionId) {
                processDefinitionUsageMetaResolver.resolveMeta(link.processDefinitionId)
            }
            PluginUsageDto(
                configurationId = definition.id,
                configurationTitle = "${definition.pluginId}@${definition.version}",
                parentType = meta.parentType,
                parentKey = meta.parentKey,
                parentVersionTag = meta.parentVersionTag,
                processDefinitionId = link.processDefinitionId,
                processDefinitionKey = meta.processDefinitionKey,
                processDefinitionName = meta.processDefinitionName,
                activityId = link.activityId,
                activityName = processDefinitionUsageMetaResolver.resolveActivityName(meta, link.activityId),
                processLinkId = link.id,
            )
        }
    }

    private fun collectUsageLinks(configurationIds: Collection<UUID>): List<UsageLink> {
        // externalPluginConfigurationId is nullable on the entity (BUILDING_BLOCK references, Phase
        // 2, carry no fixed config id) but findAllByExternalPluginConfigurationIdIn only ever
        // returns rows whose id is one of the (non-null) ids queried for — the mapNotNull is a type
        //-level formality, not an expected filter.
        val actionLinks = processLinkRepository.findAllByExternalPluginConfigurationIdIn(configurationIds)
            .mapNotNull { link ->
                link.externalPluginConfigurationId?.let { UsageLink(link.id, link.processDefinitionId, link.activityId, it) }
            }
        val taskFormLinks = taskFormProcessLinkRepository.findAllByExternalPluginConfigurationIdIn(configurationIds)
            .map { UsageLink(it.id, it.processDefinitionId, it.activityId, it.externalPluginConfigurationId) }
        return actionLinks + taskFormLinks
    }

    private fun collectConfigurations(definitions: List<ExternalPluginDefinition>): List<ExternalPluginConfiguration> {
        if (definitions.isEmpty()) return emptyList()
        return definitions.flatMap { configurationRepository.findAllByDefinitionId(it.id) }
    }

    /**
     * Configuration-referencing process link, unified across the external-plugin surfaces (service-task
     * action + user-task form) so the delete guard treats both identically.
     */
    private data class UsageLink(
        val id: UUID,
        val processDefinitionId: String,
        val activityId: String,
        val configurationId: UUID,
    )
}