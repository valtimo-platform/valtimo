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
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.domain.migration.RemoveBuildingBlockInstruction
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.case_.domain.migration.DataMigrationPatch
import com.ritense.case_.service.migration.DataMigrationComponentSuggester
import com.ritense.processdocument.migration.ProcessMigrationComponentSuggester
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentSuggester
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction

/**
 * Best-effort `removeBuildingBlock` suggestion: the building blocks the [source] owner modelled that the
 * [target] owner no longer does — the blocks an owner *loses* across the version bump — each pre-filled the
 * same way the standalone suggesters do:
 *
 * - `dataMigration` — field-name matched copy patches transferring data back out of the block;
 * - `processMigration` — the block's process(es) mapped back onto its owner's, with activity mappings.
 *
 * **The whole subtree, not the first level.** A case that stops modelling a block stops modelling everything
 * that block declared below it, and every one of those needs its own entry: the executor dissolves only what
 * an entry names, and a block left below a dissolved parent is orphaned (G25). So the lost set is computed
 * over [LinkedBuildingBlockVersionResolver.resolveCallActivityDeclarers] — the transitive call-activity
 * closure — mirroring [AddBuildingBlockMigrationComponentSuggester] on the way in. Startable-item links are
 * included for the owner's own level, since a case can lose a block it only ever offered as a startable item.
 *
 * **Each entry is aimed at the owner that block actually hands back to**, which for a nested block is its
 * **parent block**, not the migrating case — the executor transfers one level, so suggesting patches against
 * the case would propose moving data to a document that never receives it.
 *
 * Every entry names a version, because [RemoveBuildingBlockInstruction] requires one and the patches only
 * make sense against the version they were derived from. Suggestions are advisory — the user edits before
 * saving.
 */
class RemoveBuildingBlockMigrationComponentSuggester(
    private val objectMapper: ObjectMapper,
    private val caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
    private val dataMigrationComponentSuggester: DataMigrationComponentSuggester,
    private val processMigrationComponentSuggester: ProcessMigrationComponentSuggester,
) : MigrationComponentSuggester {

    override fun componentKey() = RemoveBuildingBlockMigrationComponentDeployer.REMOVE_BUILDING_BLOCK_COMPONENT_KEY

    override fun suggest(source: BlueprintId, target: BlueprintId): Any? {
        val kept = modelledBy(target).keys.map { it.key }.toSet()

        val instructions = modelledBy(source)
            .filterKeys { it.key !in kept }
            .entries
            // Sorted like the add suggester, so both components read in the same order and a plan
            // re-suggested for the same two versions comes back identical.
            .sortedBy { it.key.toString() }
            .map { (lost, declaredBy) ->
                RemoveBuildingBlockInstruction(
                    buildingBlockKey = lost.key,
                    buildingBlockVersionTag = lost.versionTag.toString(),
                    // Back to the blueprint that declared it — the parent block for a nested one, the owner
                    // itself for a block at the first level. `declaredBy` is `source` in that second case,
                    // and `target` is the version the owner will be on, so the owner's side of the mapping
                    // is resolved against the target where that is what it means.
                    dataMigration = toDataPatches(
                        dataMigrationComponentSuggester.suggest(lost, ownerSideOf(declaredBy, source, target))
                    ),
                    processMigration = toProcessInstructions(
                        processMigrationComponentSuggester.suggest(lost, ownerSideOf(declaredBy, source, target))
                    ),
                )
            }

        return instructions.ifEmpty { null }
    }

    /**
     * Every building block version [owner] models, mapped to the blueprint that declares it: its own
     * startable-item links (which [owner] declares itself) plus the transitive call-activity closure.
     */
    private fun modelledBy(owner: BlueprintId): Map<BuildingBlockDefinitionId, BlueprintId> {
        val startable = startableItemLinks(owner).associateWith { owner }
        // Call-activity declarers win on a clash: that is the relationship a running tree nests through,
        // and therefore the owner the executor hands the block back to.
        return startable + linkedBuildingBlockVersionResolver.resolveCallActivityDeclarers(owner)
    }

    /**
     * The blueprint to compute the owner half of a mapping against. For a block declared by the migrating
     * owner itself, that is [target] — the version the owner ends up on, whose processes and schema the
     * block's state is transferred into. For a nested block it is the declaring parent block, which this
     * migration does not move.
     */
    private fun ownerSideOf(declaredBy: BlueprintId, source: BlueprintId, target: BlueprintId): BlueprintId =
        if (declaredBy == source) target else declaredBy

    /** The building blocks [owner] offers as startable items; case definitions only. */
    private fun startableItemLinks(owner: BlueprintId): List<BuildingBlockDefinitionId> = when (owner) {
        is CaseDefinitionId -> caseDefinitionBuildingBlockLinkRepository
            .findAllByCaseDefinitionId(owner)
            .map { it.buildingBlockDefinitionId }

        else -> emptyList()
    }

    // Keep only the copy patches; the standalone suggester's `value: null` removals clear stale
    // fields on a verbatim-copied document, which does not apply when transferring to a separate one.
    private fun toDataPatches(suggestion: Any?): List<DataMigrationPatch> =
        if (suggestion == null) emptyList()
        else objectMapper.convertValue(suggestion, object : TypeReference<List<DataMigrationPatch>>() {})
            .filter { it.source != null }

    /**
     * Entries with no target are dropped before conversion. The process suggester leaves a target blank
     * when it cannot work one out, and [ProcessMigrationInstruction] has no room for that — but a block
     * and its owner are two *different* blueprints, and across blueprints the suggester always names its
     * nearest match, so this is a guard against a shape that does not arise here rather than a case that
     * does. It matters because the alternative is a deserialization failure inside a suggestion.
     */
    private fun toProcessInstructions(suggestion: Any?): List<ProcessMigrationInstruction> {
        if (suggestion == null) return emptyList()
        val node = objectMapper.valueToTree<JsonNode>(suggestion)
        val named = node.filter { it.hasNonNull("targetProcessDefinitionKey") }
        return named.map { objectMapper.convertValue(it, ProcessMigrationInstruction::class.java) }
    }
}
