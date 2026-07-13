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

import com.ritense.valtimo.contract.blueprint.migration.ActivityMappingSuggester
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.Activity
import org.operaton.bpm.model.bpmn.instance.FlowNode
import org.operaton.bpm.model.bpmn.instance.StartEvent

/**
 * Suggests an activity mapping between two versions of the same process definition for the
 * `processMigration` component, so a running instance's token migrates to roughly the same position
 * in the new flow. The suggestion is a version diff anchored on the activities that kept their id:
 * they split both flows into matching segments, and each changed activity is placed into the segment
 * between its surrounding anchors.
 *
 * Only the *changed* activities are suggested: the unchanged (equal) ones are migrated automatically
 * by the engine's `mapEqualActivities()` at execution, so mapping them explicitly would double-map
 * their source and be rejected. Suggested pairs are then validated through the engine
 * ([ProcessMigrationActivityValidator]); incompatible pairs (e.g. a user task to a service task) are
 * dropped rather than forced. A target activity may still be the destination of several sources.
 */
class ProcessActivityMapper(
    private val repositoryService: RepositoryService,
    private val activityValidator: ProcessMigrationActivityValidator,
) : ActivityMappingSuggester {

    override fun suggestActivityMapping(
        sourceProcessDefinitionId: String,
        targetProcessDefinitionId: String,
    ): Map<String, String> {
        return try {
            val source = orderedActivities(repositoryService.getBpmnModelInstance(sourceProcessDefinitionId))
            val target = orderedActivities(repositoryService.getBpmnModelInstance(targetProcessDefinitionId))
            if (target.isEmpty()) {
                emptyMap()
            } else {
                // Unchanged (equal) activities are migrated automatically by `mapEqualActivities()`,
                // so only the changed activities are suggested — and only those the engine accepts;
                // incompatible pairs are dropped rather than forced, since we rely 100% on Operaton.
                val changed = alignByFlow(source, target).filter { (sourceId, targetId) -> sourceId != targetId }
                activityValidator.retainValidActivityMappings(sourceProcessDefinitionId, targetProcessDefinitionId, changed)
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

    /**
     * Aligns the flow-ordered [source] activities onto the [target] activities as a version
     * migration. An activity that kept its id is an anchor mapped to itself, splitting both flows
     * into matching segments. A changed source activity is mapped into the segment between its
     * nearest surrounding anchors, to the target activity new to that segment at the proportional
     * flow position (preferring one of the same activity type). When the segment holds no such
     * target — the activity was removed — the token is advanced to the following surviving anchor
     * (or the last activity when there is none) so it never revisits already-completed work.
     */
    private fun alignByFlow(source: List<Activity>, target: List<Activity>): Map<String, String> {
        val sourceIds = source.mapTo(mutableSetOf()) { it.id }
        val targetIndexById = target.withIndex().associate { (index, activity) -> activity.id to index }

        return source.withIndex().associate { (i, activity) ->
            activity.id to if (activity.id in targetIndexById) {
                activity.id // anchor: unchanged activity migrates to itself
            } else {
                val prevAnchor = (i - 1 downTo 0).firstOrNull { source[it].id in targetIndexById }
                val nextAnchor = (i + 1 until source.size).firstOrNull { source[it].id in targetIndexById }
                val tPrev = prevAnchor?.let { targetIndexById.getValue(source[it].id) } ?: -1
                val tNext = nextAnchor?.let { targetIndexById.getValue(source[it].id) } ?: target.size

                // Target activities new to this segment are the rename/insert candidates.
                val gap = if (tNext > tPrev + 1) target.subList(tPrev + 1, tNext).filter { it.id !in sourceIds }
                else emptyList()
                val candidates = gap.filter { it.elementType.typeName == activity.elementType.typeName }.ifEmpty { gap }

                if (candidates.isNotEmpty()) {
                    val segmentStart = (prevAnchor ?: -1) + 1
                    val segmentSize = (nextAnchor ?: source.size) - segmentStart
                    val fraction = (i - segmentStart + 0.5) / segmentSize
                    candidates[(fraction * candidates.size).toInt().coerceIn(candidates.indices)].id
                } else {
                    target[if (tNext < target.size) tNext else target.size - 1].id
                }
            }
        }
    }

    /**
     * Activities in (roughly) flow order: walked depth-first from the process' start event(s) along
     * the outgoing sequence flows, so each branch is followed to its end before the next is started.
     * Gateways and events are traversed but not collected, cycles are visited once, and any activity
     * not reached by the walk (e.g. disconnected) is appended so every activity is always returned.
     * The alignment relies on this order: it places changed activities by their position between the
     * surrounding unchanged ones, so the input must run in flow order for the result to be sensible.
     */
    private fun orderedActivities(model: BpmnModelInstance): List<Activity> {
        val activitiesById = model.getModelElementsByType(Activity::class.java).associateBy { it.id }
        val orderedIds = LinkedHashSet<String>()
        val visited = mutableSetOf<String>()

        fun walk(node: FlowNode) {
            if (!visited.add(node.id)) return
            if (node.id in activitiesById) orderedIds.add(node.id)
            node.outgoing.forEach { flow -> flow.target?.let(::walk) }
        }

        model.getModelElementsByType(StartEvent::class.java)
            .ifEmpty { model.getModelElementsByType(FlowNode::class.java).filter { it.incoming.isEmpty() } }
            .forEach(::walk)
        orderedIds.addAll(activitiesById.keys)
        return orderedIds.mapNotNull { activitiesById[it] }
    }

    private companion object {
        val logger = KotlinLogging.logger {}
    }
}
