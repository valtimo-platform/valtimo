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

package com.ritense.buildingblock.processlink.service

import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.processlink.domain.ProcessLinksCopiedEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.model.bpmn.instance.CallActivity
import org.operaton.bpm.model.xml.instance.ModelElementInstance
import org.springframework.context.event.EventListener

/**
 * When a new version of a process definition is deployed, existing process links are copied to it
 * without going through the process-link mappers, so a redeployed BPMN with a broken call activity
 * would carry its building-block link silently. This validator surfaces that at deployment time.
 *
 * It only logs an error and does not fail the deployment: existing installations must keep
 * starting. [BuildingBlockCallActivityListener] re-validates at runtime and fails the call
 * activity with the same message before any building block state is created.
 */
class BuildingBlockProcessLinkCopyValidator {

    @EventListener(ProcessLinksCopiedEvent::class)
    fun validateCopiedBuildingBlockLinks(event: ProcessLinksCopiedEvent) {
        val buildingBlockLinks = event.copiedProcessLinks.filterIsInstance<BuildingBlockProcessLink>()
        if (buildingBlockLinks.isEmpty()) {
            return
        }
        // Model comes from the event: the triggering deployment is still open, so its resources are not readable yet.
        val bpmnModel = event.processDefinitionModelInstance ?: return

        buildingBlockLinks.forEach { link ->
            // Typed overload compiles to a checkcast, which throws rather than returning null - a morphed call activity keeps its id.
            val callActivity = bpmnModel.getModelElementById<ModelElementInstance>(link.activityId) as? CallActivity
            if (callActivity == null) {
                logger.error {
                    "Building block process link '${link.id}' was copied to process definition " +
                        "'${event.processDefinitionId}', but activity '${link.activityId}' is not a call " +
                        "activity in that definition. The building block cannot start from this definition."
                }
                return@forEach
            }
            try {
                BuildingBlockCallActivityBusinessKeyValidator.validate(callActivity, event.processDefinitionId)
            } catch (e: IllegalStateException) {
                logger.error {
                    "Building block process link '${link.id}' was copied to a process definition with an " +
                        "invalid call activity configuration. The building block will fail to start until " +
                        "the BPMN is fixed. ${e.message}"
                }
            }
        }
    }

    private companion object {
        private val logger = KotlinLogging.logger {}
    }
}
