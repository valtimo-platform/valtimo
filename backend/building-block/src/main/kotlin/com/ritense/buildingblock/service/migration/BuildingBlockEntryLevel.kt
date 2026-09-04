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

package com.ritense.buildingblock.service.migration

import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId

/** Whether an entry for a block one version models and the other does not belongs in this plan, or to a plan one level down that would then be fighting it — a re-pointed call activity and a change below a surviving parent are neither a gain nor a loss. */
class BuildingBlockEntryLevel(
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
) {

    /** Why an entry for [block] belongs to another plan, as a sentence to log; null when it belongs here. [declaredBy] is the blueprint whose call activity names it, or null for a startable-item link. */
    fun handledElsewhere(
        block: BuildingBlockDefinitionId,
        declaredBy: BlueprintId?,
        source: BlueprintId,
        target: BlueprintId,
    ): String? = rePointedCallActivity(block, source, target) ?: parentBlockThatSurvives(declaredBy, source, target)

    /** The call activity declaring [block] in either version, when the other version has that same activity declaring a different key. */
    private fun rePointedCallActivity(
        block: BuildingBlockDefinitionId,
        source: BlueprintId,
        target: BlueprintId,
    ): String? {
        val before = linkedBuildingBlockVersionResolver.resolveCallActivityDeclaredBlocks(source)
        val after = linkedBuildingBlockVersionResolver.resolveCallActivityDeclaredBlocks(target)
        val activityId = before.entries.firstOrNull { it.value == block }?.key
            ?: after.entries.firstOrNull { it.value == block }?.key
            ?: return null

        val declaredBefore = before[activityId] ?: return null
        val declaredAfter = after[activityId] ?: return null
        if (declaredBefore.key == declaredAfter.key) {
            return null
        }
        return "call activity '$activityId' is re-pointed from '$declaredBefore' to '$declaredAfter', which " +
            "version alignment carries with a building-block plan from the one key to the other"
    }

    /** [declaredBy], when it is a parent building block both versions still model. */
    private fun parentBlockThatSurvives(
        declaredBy: BlueprintId?,
        source: BlueprintId,
        target: BlueprintId,
    ): String? {
        val parent = declaredBy as? BuildingBlockDefinitionId ?: return null
        // The migrating blueprint declaring its own block — a building-block plan's first level.
        if (parent.key == source.getIdKey() || parent.key == target.getIdKey()) {
            return null
        }
        if (parent.key !in reachableKeys(source) || parent.key !in reachableKeys(target)) {
            return null
        }
        return "it is declared by '${parent.key}', which both versions model, so the change is that block's " +
            "own and belongs in its migration plan"
    }

    private fun reachableKeys(blueprintId: BlueprintId): Set<String> =
        linkedBuildingBlockVersionResolver.resolveCallActivityReachable(blueprintId).mapTo(mutableSetOf()) { it.key }
}
