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

package com.ritense.buildingblock.processlink.service

import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.logging.withLoggingContext
import com.ritense.plugin.service.BuildingBlockPluginConfigurationResolver
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

@Component
@SkipComponentScan
class BuildingBlockCallActivityListener(
    private val processLinkService: ProcessLinkService,
    private val buildingBlockPluginConfigurationResolver: BuildingBlockPluginConfigurationResolver?
) {

    @EventListener(
        condition = """#execution.bpmnModelElementInstance != null
            && #execution.bpmnModelElementInstance.elementType.typeName == T(org.operaton.bpm.engine.ActivityTypes).CALL_ACTIVITY
            && #execution.eventName == T(org.operaton.bpm.engine.delegate.ExecutionListener).EVENTNAME_START"""
    )
    fun onCallActivityStart(execution: DelegateExecution) {
        val resolver = buildingBlockPluginConfigurationResolver ?: return
        val activityId = execution.currentActivityId ?: return
        val links = processLinkService.getProcessLinks(execution.processDefinitionId, activityId)
            .filterIsInstance<BuildingBlockProcessLink>()

        links.forEach { processLink ->
            withLoggingContext(ProcessLink::class, processLink.id) {
                resolver.register(execution, processLink.pluginConfigurationMappings)
            }
        }
    }
}
