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

package com.ritense.plugin.service

import com.ritense.plugin.web.rest.dto.PluginUsageParentType
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.FlowElement
import org.springframework.stereotype.Component

/**
 * Reads everything the in-use guards (embedded and external) need to know about a process
 * definition behind a process-link reference: its key/name, what case-definition or building-
 * block owns it (parsed from the Operaton `versionTag` via
 * [OperatonProcessDefinition.getBlueprintId]), and lazily, the BPMN model so the activity name
 * can be resolved.
 *
 * Operaton lookups are wrapped in `runCatching` so a missing or unloadable process definition
 * degrades to nullable fields — the row still surfaces with `processDefinitionId` and the link
 * id, so the admin can investigate manually.
 */
@Component
@SkipComponentScan
class ProcessDefinitionUsageMetaResolver(
    private val operatonRepositoryService: OperatonRepositoryService,
    private val bpmnRepositoryService: RepositoryService,
) {

    fun resolveMeta(processDefinitionId: String): ProcessDefinitionUsageMeta {
        val processDefinition: OperatonProcessDefinition? = runCatching {
            operatonRepositoryService.findProcessDefinitionById(processDefinitionId)
        }.getOrNull()

        val (parentType, parentKey, parentVersionTag) = classifyParent(processDefinition)

        return ProcessDefinitionUsageMeta(
            processDefinitionKey = processDefinition?.key,
            processDefinitionName = processDefinition?.name,
            parentType = parentType,
            parentKey = parentKey,
            parentVersionTag = parentVersionTag,
            bpmnModelLoader = {
                runCatching { bpmnRepositoryService.getBpmnModelInstance(processDefinitionId) }.getOrNull()
            },
        )
    }

    fun resolveActivityName(meta: ProcessDefinitionUsageMeta, activityId: String): String? {
        val model = meta.bpmnModel ?: return null
        return runCatching {
            model.getModelElementById<FlowElement>(activityId)?.name
        }.getOrNull()
    }

    private fun classifyParent(
        processDefinition: OperatonProcessDefinition?,
    ): Triple<PluginUsageParentType, String?, String?> {
        return when (val blueprint = processDefinition?.getBlueprintId()) {
            is CaseDefinitionId -> Triple(PluginUsageParentType.CASE, blueprint.key, blueprint.versionTag.toString())
            is BuildingBlockDefinitionId -> Triple(PluginUsageParentType.BUILDING_BLOCK, blueprint.key, blueprint.versionTag.toString())
            else -> Triple(PluginUsageParentType.GLOBAL, null, null)
        }
    }
}

class ProcessDefinitionUsageMeta(
    val processDefinitionKey: String?,
    val processDefinitionName: String?,
    val parentType: PluginUsageParentType,
    val parentKey: String?,
    val parentVersionTag: String?,
    bpmnModelLoader: () -> BpmnModelInstance?,
) {
    val bpmnModel: BpmnModelInstance? by lazy(bpmnModelLoader)
}
