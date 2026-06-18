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

import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginProcessLink
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginProcessLinkRepository
import com.ritense.plugin.web.rest.dto.PluginUsageDto
import com.ritense.plugin.web.rest.dto.PluginUsageParentType
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.FlowElement
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
@SkipComponentScan
@Transactional(readOnly = true)
class ExternalPluginHostUsageResolver(
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val processLinkRepository: ExternalPluginProcessLinkRepository,
    private val operatonRepositoryService: OperatonRepositoryService,
    private val bpmnRepositoryService: RepositoryService,
) {

    fun findUsagesForHost(hostId: UUID): List<PluginUsageDto> {
        val configurations = collectConfigurationsForHost(hostId)
        return buildUsageDtos(configurations)
    }

    fun findUsagesForConfiguration(configurationId: UUID): List<PluginUsageDto> {
        val configuration = configurationRepository.findById(configurationId).orElse(null)
            ?: return emptyList()
        return buildUsageDtos(listOf(configuration))
    }

    private fun buildUsageDtos(configurations: List<ExternalPluginConfiguration>): List<PluginUsageDto> {
        if (configurations.isEmpty()) return emptyList()
        val configById = configurations.associateBy { it.id }
        val links = processLinkRepository
            .findAllByExternalPluginConfigurationIdIn(configById.keys)
        if (links.isEmpty()) return emptyList()

        val metaCache = mutableMapOf<String, ProcessDefinitionMeta>()

        return links.map { link ->
            val meta = metaCache.getOrPut(link.processDefinitionId) {
                resolveProcessDefinitionMeta(link.processDefinitionId)
            }
            val configuration = configById.getValue(link.externalPluginConfigurationId)
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
                activityName = resolveActivityName(link, meta),
                processLinkId = link.id,
            )
        }
    }

    private fun collectConfigurationsForHost(hostId: UUID): List<ExternalPluginConfiguration> {
        val definitions = definitionRepository.findAllByHostId(hostId)
        if (definitions.isEmpty()) return emptyList()
        return definitions.flatMap { configurationRepository.findAllByDefinitionId(it.id) }
    }

    private fun resolveProcessDefinitionMeta(processDefinitionId: String): ProcessDefinitionMeta {
        val processDefinition: OperatonProcessDefinition? = runCatching {
            operatonRepositoryService.findProcessDefinitionById(processDefinitionId)
        }.getOrNull()

        val parent = classifyParent(processDefinition)

        return ProcessDefinitionMeta(
            processDefinitionKey = processDefinition?.key,
            processDefinitionName = processDefinition?.name,
            parentType = parent.type,
            parentKey = parent.key,
            parentVersionTag = parent.versionTag,
            bpmnModelLoader = {
                runCatching { bpmnRepositoryService.getBpmnModelInstance(processDefinitionId) }.getOrNull()
            },
        )
    }

    /**
     * Operaton stores the owning case-definition or building-block in the `versionTag` of the
     * process definition (encoded with the `CD:` or `BB:` prefix — see [CaseDefinitionId] /
     * [BuildingBlockDefinitionId]). `OperatonProcessDefinition.getBlueprintId` already does the
     * parsing; we just need to widen the result into the public-facing enum.
     */
    private fun classifyParent(processDefinition: OperatonProcessDefinition?): ParentClassification {
        return when (val blueprint = processDefinition?.getBlueprintId()) {
            is CaseDefinitionId -> ParentClassification(
                type = PluginUsageParentType.CASE,
                key = blueprint.key,
                versionTag = blueprint.versionTag.toString(),
            )
            is BuildingBlockDefinitionId -> ParentClassification(
                type = PluginUsageParentType.BUILDING_BLOCK,
                key = blueprint.key,
                versionTag = blueprint.versionTag.toString(),
            )
            else -> ParentClassification(
                type = PluginUsageParentType.GLOBAL,
                key = null,
                versionTag = null,
            )
        }
    }

    private fun resolveActivityName(
        link: ExternalPluginProcessLink,
        meta: ProcessDefinitionMeta,
    ): String? {
        val model = meta.bpmnModel ?: return null
        return runCatching {
            model.getModelElementById<FlowElement>(link.activityId)?.name
        }.getOrNull()
    }

    private data class ParentClassification(
        val type: PluginUsageParentType,
        val key: String?,
        val versionTag: String?,
    )

    private class ProcessDefinitionMeta(
        val processDefinitionKey: String?,
        val processDefinitionName: String?,
        val parentType: PluginUsageParentType,
        val parentKey: String?,
        val parentVersionTag: String?,
        bpmnModelLoader: () -> BpmnModelInstance?,
    ) {
        val bpmnModel: BpmnModelInstance? by lazy(bpmnModelLoader)
    }
}
