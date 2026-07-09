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

package com.ritense.processdocument.migration

import com.ritense.valtimo.contract.utils.LcsDistance
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.instance.Activity

/**
 * Suggests a best-effort activity mapping between two BPMN process definitions for the
 * `processMigration` component. Operaton requires *every* source activity to be mapped, but a target
 * activity may be the destination of several sources, so each source activity is mapped to its
 * closest target. Closeness is the smaller of the LCS distance between the activity ids and between
 * the activity names/titles — so a match on either the technical id or the human name counts.
 */
class ProcessActivityMapper(
    private val repositoryService: RepositoryService,
) {

    fun suggestActivityMapping(
        sourceProcessDefinitionId: String,
        targetProcessDefinitionId: String,
    ): Map<String, String> {
        return try {
            val targetActivities = activities(targetProcessDefinitionId)
            if (targetActivities.isEmpty()) {
                emptyMap()
            } else {
                activities(sourceProcessDefinitionId).associate { source ->
                    source.id to targetActivities.minByOrNull { target -> score(source, target) }!!.id
                }
            }
        } catch (e: Exception) {
            logger.debug(e) {
                "Could not suggest an activity mapping from '$sourceProcessDefinitionId' to '$targetProcessDefinitionId'"
            }
            emptyMap()
        }
    }

    /** The process definition's name/title, or null when it has none / cannot be resolved. */
    fun processDefinitionName(processDefinitionId: String): String? =
        try {
            repositoryService.getProcessDefinition(processDefinitionId).name
        } catch (e: Exception) {
            logger.debug(e) { "Could not resolve the name of process definition '$processDefinitionId'" }
            null
        }

    /** min( LCS(source id, target id), LCS(source name, target name) ) — lower is more similar. */
    private fun score(source: ActivityRef, target: ActivityRef): Int = minOf(
        LcsDistance.between(source.id.lowercase(), target.id.lowercase()),
        LcsDistance.between(source.name.lowercase(), target.name.lowercase()),
    )

    // Only BPMN activities (tasks, subprocesses, call activities, ...) — not gateways, events or
    // sequence flows, which are not mapped during migration.
    private fun activities(processDefinitionId: String): List<ActivityRef> =
        repositoryService.getBpmnModelInstance(processDefinitionId)
            .getModelElementsByType(Activity::class.java)
            .map { activity -> ActivityRef(activity.id, activity.name ?: activity.id) }

    private data class ActivityRef(val id: String, val name: String)

    private companion object {
        val logger = KotlinLogging.logger {}
    }
}
