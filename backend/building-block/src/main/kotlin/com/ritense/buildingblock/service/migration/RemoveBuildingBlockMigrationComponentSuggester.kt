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
import io.github.oshai.kotlinlogging.KotlinLogging

/** A suggested entry with its `processMigration` left as JSON, so a row whose target was not guessed survives to the editor. */
internal data class SuggestedRemoveBuildingBlockEntry(
    val buildingBlockKey: String,
    val buildingBlockVersionTag: String,
    val dataMigration: List<DataMigrationPatch>,
    val processMigration: List<JsonNode>,
)

/** Suggests an entry per building block the [source] owner modelled and [target] no longer does — over the whole call-activity subtree, each aimed at the owner that block actually hands back to. */
class RemoveBuildingBlockMigrationComponentSuggester(
    private val objectMapper: ObjectMapper,
    private val caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
    private val buildingBlockEntryLevel: BuildingBlockEntryLevel,
    private val dataMigrationComponentSuggester: DataMigrationComponentSuggester,
    private val processMigrationComponentSuggester: ProcessMigrationComponentSuggester,
) : MigrationComponentSuggester {

    override fun componentKey() = RemoveBuildingBlockMigrationComponentDeployer.REMOVE_BUILDING_BLOCK_COMPONENT_KEY

    override fun suggest(source: BlueprintId, target: BlueprintId): Any? {
        val kept = modelledBy(target).keys.map { it.key }.toSet()

        val instructions = modelledBy(source)
            .filterKeys { it.key !in kept }
            .entries
            // Sorted like the add suggester, so a plan re-suggested for the same two versions comes back identical.
            .sortedBy { it.key.toString() }
            .mapNotNull { (lost, declaredBy) ->
                // A key lost is not always this plan's to dissolve — see [BuildingBlockEntryLevel].
                buildingBlockEntryLevel.handledElsewhere(lost, declaredBy, source, target)?.let { reason ->
                    logger.info {
                        "No 'removeBuildingBlock' entry is suggested for '$lost' on the plan migrating " +
                            "'$source' to '$target': $reason."
                    }
                    return@mapNotNull null
                }
                SuggestedRemoveBuildingBlockEntry(
                    buildingBlockKey = lost.key,
                    buildingBlockVersionTag = lost.versionTag.toString(),
                    // Back to the blueprint that declared it — the parent block when nested, the owner at its target version otherwise.
                    dataMigration = toDataPatches(
                        dataMigrationComponentSuggester.suggestForBuildingBlockEntry(
                            lost, ownerSideOf(declaredBy, source, target)
                        )
                    ),
                    processMigration = toProcessRows(
                        processMigrationComponentSuggester.suggestForBuildingBlockEntry(
                            lost, ownerSideOf(declaredBy, source, target)
                        )
                    ),
                )
            }

        return instructions.ifEmpty { null }
    }

    /** Every block version [owner] models, mapped to the blueprint that declares it: its startable-item links plus the transitive call-activity closure. */
    private fun modelledBy(owner: BlueprintId): Map<BuildingBlockDefinitionId, BlueprintId> {
        val startable = startableItemLinks(owner).associateWith { owner }
        // Call-activity declarers win on a clash: that is the relationship the running tree nests through.
        return startable + linkedBuildingBlockVersionResolver.resolveCallActivityDeclarers(owner)
    }

    /** The blueprint to compute the owner half of a mapping against: [target] for a block the owner declares itself, the declaring parent block for a nested one. */
    private fun ownerSideOf(declaredBy: BlueprintId, source: BlueprintId, target: BlueprintId): BlueprintId =
        if (declaredBy == source) target else declaredBy

    /** The building blocks [owner] offers as startable items; case definitions only. */
    private fun startableItemLinks(owner: BlueprintId): List<BuildingBlockDefinitionId> = when (owner) {
        is CaseDefinitionId -> caseDefinitionBuildingBlockLinkRepository
            .findAllByCaseDefinitionId(owner)
            .map { it.buildingBlockDefinitionId }

        else -> emptyList()
    }

    // Copy patches only — a `value: null` removal clears a verbatim-copied document, not a separate one.
    private fun toDataPatches(suggestion: Any?): List<DataMigrationPatch> =
        if (suggestion == null) emptyList()
        else objectMapper.convertValue(suggestion, object : TypeReference<List<DataMigrationPatch>>() {})
            .filter { it.source != null }

    /** The suggested rows as they came, including those with no target: an unhanded-back process makes the executor refuse to dissolve, so dropping the row would turn a complete-looking entry into a failing case. */
    private fun toProcessRows(suggestion: Any?): List<JsonNode> {
        if (suggestion == null) return emptyList()
        return objectMapper.valueToTree<JsonNode>(suggestion).toList()
    }

    private companion object {
        val logger = KotlinLogging.logger {}
    }
}
