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
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.case_.domain.migration.DataMigrationPatch
import com.ritense.case_.service.migration.DataMigrationComponentSuggester
import com.ritense.processdocument.migration.ProcessMigrationComponentSuggester
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentSuggester
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import io.github.oshai.kotlinlogging.KotlinLogging

/** A suggested entry with its `processMigration` left as JSON, so a row whose counterpart was not guessed survives to the editor. */
internal data class SuggestedAddBuildingBlockEntry(
    val buildingBlockKey: String,
    val buildingBlockVersionTag: String,
    val dataMigration: List<DataMigrationPatch>,
    val processMigration: List<JsonNode>,
)

/** Suggests an entry per building block [target] models and [source] did not — over both link kinds, each aimed at the owner that fills it. A call-activity block gets no `processMigration`: adoption finds the process from the link and the running tree. */
class AddBuildingBlockMigrationComponentSuggester(
    private val objectMapper: ObjectMapper,
    private val caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
    private val buildingBlockEntryLevel: BuildingBlockEntryLevel,
    private val dataMigrationComponentSuggester: DataMigrationComponentSuggester,
    private val processMigrationComponentSuggester: ProcessMigrationComponentSuggester,
) : MigrationComponentSuggester {

    override fun componentKey() = AddBuildingBlockMigrationComponentDeployer.ADD_BUILDING_BLOCK_COMPONENT_KEY

    override fun suggest(source: BlueprintId, target: BlueprintId): Any? {
        // Compared by key, not key and version: a block whose key the source already models is being version-bumped, which is alignment's job (R2), not an `addBuildingBlock` entry.
        val keysBefore = modelledBy(source).keys.map { it.key }.toSet()
        val declaredBy = modelledBy(target)
        val instructions = declaredBy.keys
            .filter { it.key !in keysBefore }
            .sortedBy { it.toString() }
            .mapNotNull { block ->
                // A key gained is not always this plan's to create — see [BuildingBlockEntryLevel].
                buildingBlockEntryLevel.handledElsewhere(block, declaredBy[block], source, target)?.let { reason ->
                    logger.info {
                        "No 'addBuildingBlock' entry is suggested for '$block' on the plan migrating " +
                            "'$source' to '$target': $reason."
                    }
                    return@mapNotNull null
                }
                val owner = ownerSideOf(declaredBy[block], target)
                SuggestedAddBuildingBlockEntry(
                    buildingBlockKey = block.key,
                    buildingBlockVersionTag = block.versionTag.toString(),
                    // Data flows owner -> block on the way in, the mirror of removal's block -> owner.
                    dataMigration = toDataPatches(
                        dataMigrationComponentSuggester.suggestForBuildingBlockEntry(owner, block)
                    ),
                    // Empty for a call-activity block, which adoption serves; a hijack is only paired where the keys say so.
                    processMigration = toProcessRows(
                        processMigrationComponentSuggester.suggestForBuildingBlockEntry(
                            owner, block, runningSideOf(owner, source, target)
                        )
                    ),
                )
            }

        return instructions.ifEmpty { null }
    }

    /** Every block version [owner] models, mapped to the blueprint that declares it: its startable-item links plus the transitive call-activity closure — the same set [AddBuildingBlockLinkChecker] accepts (D12), so an entry this misses is one the save path would have taken. */
    private fun modelledBy(owner: BlueprintId): Map<BuildingBlockDefinitionId, BlueprintId> {
        val startable = startableItemLinks(owner).associateWith { owner }
        // Call-activity declarers win on a clash: that is the relationship the running tree nests through, and adoption then serves it.
        return startable + linkedBuildingBlockVersionResolver.resolveCallActivityDeclarers(owner)
    }

    /** The building blocks [owner] offers as startable items; case definitions only. */
    private fun startableItemLinks(owner: BlueprintId): List<BuildingBlockDefinitionId> = when (owner) {
        is CaseDefinitionId -> caseDefinitionBuildingBlockLinkRepository
            .findAllByCaseDefinitionId(owner)
            .map { it.buildingBlockDefinitionId }

        else -> emptyList()
    }

    /** The blueprint whose document this block is filled from: the parent block when nested, the migrating owner at its target version otherwise — `dataMigration` runs at @100, this at @300. */
    private fun ownerSideOf(declaredBy: BlueprintId?, target: BlueprintId): BlueprintId =
        declaredBy?.takeIf { it is BuildingBlockDefinitionId } ?: target

    /** [owner] as the instances still have it, which is whose process a hijack takes over: [source] for the migrating blueprint itself. A parent block is passed as it is — a nested block is call-activity declared, so adoption answers and no row is suggested at all. */
    private fun runningSideOf(owner: BlueprintId, source: BlueprintId, target: BlueprintId): BlueprintId =
        if (owner == target) source else owner

    /** The suggested rows as they came, including any with a half left blank: an entry that hijacks nothing and is not call-activity declared is refused on save, so dropping the row would hide the work the plan still needs. */
    private fun toProcessRows(suggestion: Any?): List<JsonNode> {
        if (suggestion == null) return emptyList()
        return objectMapper.valueToTree<JsonNode>(suggestion).toList()
    }

    /** Copy patches only — a `value: null` removal clears a verbatim-copied document, not a separate one. */
    private fun toDataPatches(suggestion: Any?): List<DataMigrationPatch> =
        if (suggestion == null) emptyList()
        else objectMapper.convertValue(suggestion, object : TypeReference<List<DataMigrationPatch>>() {})
            .filter { it.source != null }

    private companion object {
        val logger = KotlinLogging.logger {}
    }
}
