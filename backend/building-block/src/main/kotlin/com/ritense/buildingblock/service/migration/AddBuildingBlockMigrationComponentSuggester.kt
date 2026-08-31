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
import io.github.oshai.kotlinlogging.KotlinLogging

/** Suggests an entry per building block [target] models and [source] did not, over the whole call-activity subtree and with no `processMigration` — adoption finds the process from the link and the running tree. */
class AddBuildingBlockMigrationComponentSuggester(
    private val objectMapper: ObjectMapper,
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
    private val buildingBlockEntryLevel: BuildingBlockEntryLevel,
    private val dataMigrationComponentSuggester: DataMigrationComponentSuggester,
) : MigrationComponentSuggester {

    override fun componentKey() = AddBuildingBlockMigrationComponentDeployer.ADD_BUILDING_BLOCK_COMPONENT_KEY

    override fun suggest(source: BlueprintId, target: BlueprintId): Any? {
        // Compared by key, not key and version: a block whose key the source already models is being version-bumped, which is alignment's job (R2), not an `addBuildingBlock` entry.
        val keysBefore = linkedBuildingBlockVersionResolver.resolveCallActivityReachable(source)
            .map { it.key }
            .toSet()
        val declaredBy = linkedBuildingBlockVersionResolver.resolveCallActivityDeclarers(target)
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
                AddBuildingBlockInstruction(
                    buildingBlockKey = block.key,
                    buildingBlockVersionTag = block.versionTag.toString(),
                    // Data flows owner -> block on the way in, the mirror of removal's block -> owner.
                    dataMigration = toDataPatches(
                        dataMigrationComponentSuggester.suggestForBuildingBlockEntry(
                            ownerSideOf(declaredBy[block], target), block
                        )
                    ),
                )
            }

        return instructions.ifEmpty { null }
    }

    /** The blueprint whose document this block is filled from: the parent block when nested, the migrating owner at its target version otherwise — `dataMigration` runs at @100, this at @300. */
    private fun ownerSideOf(declaredBy: BlueprintId?, target: BlueprintId): BlueprintId =
        declaredBy?.takeIf { it is BuildingBlockDefinitionId } ?: target

    /** Copy patches only — a `value: null` removal clears a verbatim-copied document, not a separate one. */
    private fun toDataPatches(suggestion: Any?): List<DataMigrationPatch> =
        if (suggestion == null) emptyList()
        else objectMapper.convertValue(suggestion, object : TypeReference<List<DataMigrationPatch>>() {})
            .filter { it.source != null }

    private companion object {
        val logger = KotlinLogging.logger {}
    }
}
