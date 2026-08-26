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

/**
 * Answers, for a building block one version models and the other does not, whether an
 * `addBuildingBlock` / `removeBuildingBlock` entry for it belongs in **this** plan — or to a plan one
 * level down, which would then be fighting it.
 *
 * Both suggesters compare the two versions' call-activity closures **by key**, which is the right
 * comparison for "is this block new" and too coarse for "is this plan the one that should act on it".
 * Two shapes come out of it as a gain or a loss while being neither:
 *
 * - **A call activity re-pointed at another building block.** `verhuizing-inspectie` 1.0.4 → 1.0.5
 *   keeps `CallInspectieFotosActivity` and moves it from `BB:inspectie-fotos:1.0.1` to
 *   `BB:inspectie-dossier:1.0.0`. By key that reads as one block lost and another gained, and the
 *   suggested plan says so — but a key change on one activity is exactly what version alignment
 *   carries, through a building-block plan from the old key to the new one
 *   ([LinkedBuildingBlockVersionResolver.resolveTarget] matches on the activity id so that it can).
 *   Acting on the entries instead is worse than redundant: `removeBuildingBlock` runs at @400 and
 *   alignment at @500, so the plan dissolves the running block *before* the thing that was going to
 *   carry it across ever looks, and `addBuildingBlock` then finds a call activity that is already a
 *   block and creates nothing.
 * - **A block gained or lost below a parent block that survives.** The case migrating from
 *   `woninginspectie` 1.0.4 to 1.0.5 keeps linking `verhuizing-inspectie`, whose own 1.0.6 drops the
 *   nested `inspectie-dossier`. That is the parent's change, it is written in the parent's own plan
 *   (`verhuizing-inspectie-dossier-opheffen`, with the four patches that hand the dossier's fields
 *   back), and alignment runs that plan at @500. A case-level entry for the same block gets there
 *   first with a worse answer: at @400 the parent is still on its old version, so the fields the data
 *   is meant to land in — the ones the *new* parent version added for it — do not exist yet and
 *   cannot even be suggested.
 *
 * A block the migrating blueprint declares **itself** is always this plan's work, whichever of the two
 * it is, and so is one whose parent block is not modelled by both versions: a parent that is itself
 * being added or dissolved cannot carry its children (G25's cascade warns about exactly that).
 */
class BuildingBlockEntryLevel(
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
) {

    /**
     * Why an entry for [block] belongs to another plan than the one migrating [source] to [target],
     * as a sentence to log; null when the entry belongs in this plan and should be suggested.
     *
     * [declaredBy] is the blueprint whose call activity names [block] — the migrating blueprint itself
     * for a block at the first level, a parent block for a nested one, and null for a startable-item
     * link, which nests nothing and is always the owner's own.
     */
    fun handledElsewhere(
        block: BuildingBlockDefinitionId,
        declaredBy: BlueprintId?,
        source: BlueprintId,
        target: BlueprintId,
    ): String? = rePointedCallActivity(block, source, target) ?: parentBlockThatSurvives(declaredBy, source, target)

    /**
     * The call activity that declares [block] in either version, when the *other* version has that same
     * activity declaring a **different** building block key.
     */
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
