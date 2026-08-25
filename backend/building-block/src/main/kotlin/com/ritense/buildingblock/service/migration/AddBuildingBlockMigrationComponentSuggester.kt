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

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.domain.migration.AddBuildingBlockInstruction
import com.ritense.case_.domain.migration.DataMigrationPatch
import com.ritense.case_.service.migration.DataMigrationComponentSuggester
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentSuggester
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId

/**
 * Suggests the `addBuildingBlock` component: an entry per building block the [target] version models
 * that the [source] version did not.
 *
 * This exists because the entry became **required**. Adoption (D14) creates a block only where the plan
 * names it, so a version that newly declares blocks on call activities needs an entry per block or
 * nothing is adopted and every case reports a warning instead. Before this suggester there was no
 * `addBuildingBlock` suggestion at all — only `removeBuildingBlock` had one — so the pre-filled plan was
 * silently missing the one component the new behaviour depends on.
 *
 * Two deliberate choices:
 *
 * - **The whole subtree, not the first level.** Blocks are collected with
 *   [LinkedBuildingBlockVersionResolver.resolveCallActivityReachable], so a nested block declared by
 *   another block is suggested too. That is exactly the set adoption can reach in one run, and exactly
 *   what D12 now accepts, so the suggestion cannot propose an entry the checkers would refuse.
 * - **No `processMigration`.** Adoption finds the running sub-process from the call activity and the
 *   running tree, so an entry needs no process definition key — naming one would only repeat the link,
 *   and `AddBuildingBlockProcessChecker` accepts the omission precisely for this shape. An author who
 *   means a *hijack* (a top-level process, or a renamed process key) adds it themselves; that case
 *   cannot be told apart from the outside, and guessing it would produce a plan that quietly fails the
 *   D13 process check.
 *
 * Startable-item links are not suggested: nothing adopts those, so an entry for one would need a
 * hijack this cannot infer.
 */
class AddBuildingBlockMigrationComponentSuggester(
    private val objectMapper: ObjectMapper,
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
    private val dataMigrationComponentSuggester: DataMigrationComponentSuggester,
) : MigrationComponentSuggester {

    override fun componentKey() = AddBuildingBlockMigrationComponentDeployer.ADD_BUILDING_BLOCK_COMPONENT_KEY

    override fun suggest(source: BlueprintId, target: BlueprintId): Any? {
        // Compared by **key**, not by key and version. A block whose key the source already models is not
        // being added — it is being *version-bumped*, which is version alignment's job (R2) and needs a
        // building-block plan from the old version to the new one (R3), not an `addBuildingBlock` entry.
        // Suggesting one would propose an entry the walk finds already satisfied (the child is a block with a
        // process, so it descends rather than creating), leaving a no-op entry that now also warns for having
        // reached nothing. Symmetric with the remove suggester, which drops a lost block by key for the same
        // reason.
        val keysBefore = linkedBuildingBlockVersionResolver.resolveCallActivityReachable(source)
            .map { it.key }
            .toSet()
        val instructions = linkedBuildingBlockVersionResolver.resolveCallActivityReachable(target)
            .filter { it.key !in keysBefore }
            .sortedBy { it.toString() }
            .map { block ->
                AddBuildingBlockInstruction(
                    buildingBlockKey = block.key,
                    buildingBlockVersionTag = block.versionTag.toString(),
                    // Data flows owner -> block on the way in, the mirror of removal's block -> owner.
                    dataMigration = toDataPatches(
                        dataMigrationComponentSuggester.suggestForBuildingBlockEntry(source, block)
                    ),
                )
            }

        return instructions.ifEmpty { null }
    }

    /**
     * Copy patches only. The standalone suggester's `value: null` removals clear stale fields on a
     * verbatim-copied document, which does not apply when filling a separate one — the same reasoning as
     * [RemoveBuildingBlockMigrationComponentSuggester].
     */
    private fun toDataPatches(suggestion: Any?): List<DataMigrationPatch> =
        if (suggestion == null) emptyList()
        else objectMapper.convertValue(suggestion, object : TypeReference<List<DataMigrationPatch>>() {})
            .filter { it.source != null }
}
