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

/** Validates `removeBuildingBlock` on save: every entry must name the version it dissolves, and a key [source] links no version of cannot be dissolved. Which versions the fleet is actually on is a runtime fact the executor catches. */
class RemoveBuildingBlockMigrationComponentValidator(
    private val removeBuildingBlockVersionChecker: RemoveBuildingBlockVersionChecker,
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
    private val valueResolverFactories: List<ValueResolverFactory>,
) : MigrationComponentValidator {

    override fun componentKey() = RemoveBuildingBlockMigrationComponentDeployer.REMOVE_BUILDING_BLOCK_COMPONENT_KEY

    override fun validate(source: BlueprintId, target: BlueprintId, component: JsonNode): List<String> {
        return removeBuildingBlockVersionChecker.findVersionless(component) +
            findKeysNotOn(source, component) +
            nestedInstructionsWithoutTarget(component)
    }

    /** Key, not version: alignment leaves a block it cannot move on its old version, and the executor then demands an entry for exactly that version. */
    private fun findKeysNotOn(source: BlueprintId, component: JsonNode): List<String> {
        val linkedKeys = linkedBuildingBlockVersionResolver.resolveCarried(source).map { it.key }.toSet()
        // Fail open: resolving nothing means the tree could not be read, not that the case carries nothing.
        if (linkedKeys.isEmpty()) {
            return emptyList()
        }

        return component.filter { it.isObject }.mapNotNull { entry ->
            val key = entry.get("buildingBlockKey")?.takeIf { it.isTextual }?.asText()
                ?.takeUnless { it.isBlank() || it in linkedKeys }
                ?: return@mapNotNull null
            "removes building block '$key', but '$source' links no version of it, so no case on '$source' " +
                "carries one. Available: ${linkedKeys.sorted().joinToString { "'$it'" }}."
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
