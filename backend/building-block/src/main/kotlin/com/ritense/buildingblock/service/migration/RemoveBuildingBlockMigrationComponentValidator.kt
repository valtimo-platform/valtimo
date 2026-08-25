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
import com.ritense.processdocument.migration.ProcessMigrationTargetChecker
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentValidator

/**
 * Validates the `removeBuildingBlock` component of a plan before it is saved: every entry has to name
 * the building block **version** it dissolves ([RemoveBuildingBlockVersionChecker]).
 *
 * The twin of [AddBuildingBlockMigrationComponentValidator], and for the same reason — a plan is only
 * free to fix before it runs. What cannot be checked here is whether the versions an entry names are the
 * ones the fleet is actually on: that is a per-instance runtime fact, and
 * [RemoveBuildingBlockMigrationComponentExecutor] is where it is caught.
 */
class RemoveBuildingBlockMigrationComponentValidator(
    private val removeBuildingBlockVersionChecker: RemoveBuildingBlockVersionChecker,
) : MigrationComponentValidator {

    override fun componentKey() = RemoveBuildingBlockMigrationComponentDeployer.REMOVE_BUILDING_BLOCK_COMPONENT_KEY

    override fun validate(source: BlueprintId, target: BlueprintId, component: JsonNode): List<String> {
        return removeBuildingBlockVersionChecker.findVersionless(component) +
            nestedInstructionsWithoutTarget(component)
    }

    /**
     * Every nested `processMigration` instruction naming no target, said in terms of the entry it belongs
     * to. The twin of the check in [AddBuildingBlockMigrationComponentValidator]: these copies reach no
     * other validator either, so a blank target would otherwise be stored and silently skip that process
     * for every case — a process the entry is dissolving a block around, which is worse than leaving it.
     */
    private fun nestedInstructionsWithoutTarget(component: JsonNode): List<String> =
        component.filter { it.isObject }.flatMap { entry ->
            val block = entry.get("buildingBlockKey")?.takeIf { it.isTextual }?.asText() ?: "?"
            ProcessMigrationTargetChecker.sourcesWithoutTarget(entry.get("processMigration"))
                .map { sourceKey ->
                    "removes building block '$block': ${ProcessMigrationTargetChecker.describe(sourceKey)}"
                }
        }
}
