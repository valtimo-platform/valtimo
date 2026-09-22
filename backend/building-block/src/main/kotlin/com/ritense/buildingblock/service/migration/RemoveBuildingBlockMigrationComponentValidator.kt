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

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.case_.service.migration.DataMigrationComponentValidator
import com.ritense.case_.service.migration.DataMigrationPatchChecker
import com.ritense.processdocument.migration.ProcessMigrationTargetChecker
import com.ritense.processdocument.migration.ProcessVariableTargetChecker
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentValidator
import com.ritense.valueresolver.ValueResolverFactory
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId

/** Validates `removeBuildingBlock` on save: every entry must name the version it dissolves, and a block [source] never had cannot be dissolved. Whether the fleet is actually on those versions is a runtime fact the executor catches. */
class RemoveBuildingBlockMigrationComponentValidator(
    private val removeBuildingBlockVersionChecker: RemoveBuildingBlockVersionChecker,
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
    private val valueResolverFactories: List<ValueResolverFactory>,
) : MigrationComponentValidator {

    override fun componentKey() = RemoveBuildingBlockMigrationComponentDeployer.REMOVE_BUILDING_BLOCK_COMPONENT_KEY

    override fun validate(source: BlueprintId, target: BlueprintId, component: JsonNode): List<String> {
        val versionless = removeBuildingBlockVersionChecker.findVersionless(component)
        // Only once every entry names a version: "removes nothing" is the wrong complaint about "removes what?".
        val unknown = if (versionless.isEmpty()) findNotOn(source, component) else emptyList()
        return versionless + unknown + nestedInstructionsWithoutTarget(component)
    }

    /** The mirror of the add side's link check. A remove entry dissolves a block the migrating case carries, and the case carries what its *source* version links — so an entry naming anything else removes nothing on every case, which until now was only said per case at run time. */
    private fun findNotOn(source: BlueprintId, component: JsonNode): List<String> {
        val carried = carriedBy(source)
        // Fail open: resolving nothing means the tree could not be read, not that the case carries nothing.
        if (carried.isEmpty()) {
            return emptyList()
        }

        return component.filter { it.isObject }.mapNotNull { entry ->
            val key = entry.get("buildingBlockKey")?.takeIf { it.isTextual }?.asText() ?: return@mapNotNull null
            val versionTag = entry.get("buildingBlockVersionTag")?.takeIf { it.isTextual }?.asText()
                ?: return@mapNotNull null
            val removed = BuildingBlockDefinitionId.of(key, versionTag)
            if (carried.contains(removed)) {
                return@mapNotNull null
            }
            val sameKey = carried.filter { it.key == removed.key }
            val mismatch = if (sameKey.isEmpty()) {
                "'$source' links no version of '$key' at all"
            } else {
                "'$source' links ${sameKey.sortedBy { it.toString() }.joinToString { "'$it'" }} instead"
            }
            "removes building block '$removed', which no case on '$source' has: $mismatch. Point the " +
                "entry at a version '$source' does link, or drop it."
        }
    }

    /** Every block a case on [source] can be carrying, at any depth. The call-activity walk only enqueues call-activity links, so a block linked as a startable item is found but nothing nested under it is — and a remove entry may name a block at any depth. Each startable-linked block therefore seeds its own walk; below that it is call activities the whole way down. */
    private fun carriedBy(source: BlueprintId): Set<BuildingBlockDefinitionId> {
        val direct = linkedBuildingBlockVersionResolver.resolveLinkedVersions(source)
            .map { it.buildingBlockDefinitionId }
        return buildSet {
            addAll(direct)
            addAll(linkedBuildingBlockVersionResolver.resolveCallActivityReachable(source))
            direct.forEach { addAll(linkedBuildingBlockVersionResolver.resolveCallActivityReachable(it)) }
        }
    }

    /** Every nested instruction naming no target, said in terms of its entry — these copies reach no other validator, so a blank target would silently skip a process the entry is dissolving a block around. */
    private fun nestedInstructionsWithoutTarget(component: JsonNode): List<String> =
        component.filter { it.isObject }.flatMap { entry ->
            val block = entry.get("buildingBlockKey")?.takeIf { it.isTextual }?.asText() ?: "?"
            ProcessMigrationTargetChecker.sourcesWithoutTarget(entry.get("processMigration"))
                .map { sourceKey ->
                    "removes building block '$block': ${ProcessMigrationTargetChecker.describe(sourceKey)}"
                } +
                // Same control, same `doc:` hazard as the top-level section: these copies reach no other validator.
                ProcessVariableTargetChecker.findNonProcessVariableTargets(entry.get("processMigration"))
                    .map { problem -> "removes building block '$block': $problem" } +
                // The entry's own dataMigration copies, judged by the rule the top-level section is.
                DataMigrationPatchChecker
                    .findProblems(entry.get("dataMigration"), DataMigrationComponentValidator.knownPrefixes(valueResolverFactories))
                    .map { problem -> "removes building block '$block': $problem" }
        }
}
