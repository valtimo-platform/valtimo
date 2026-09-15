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

/** Validates `removeBuildingBlock` on save: every entry must name the version it dissolves. Whether the fleet is actually on those versions is a runtime fact the executor catches. */
class RemoveBuildingBlockMigrationComponentValidator(
    private val removeBuildingBlockVersionChecker: RemoveBuildingBlockVersionChecker,
) : MigrationComponentValidator {

    override fun componentKey() = RemoveBuildingBlockMigrationComponentDeployer.REMOVE_BUILDING_BLOCK_COMPONENT_KEY

    override fun validate(source: BlueprintId, target: BlueprintId, component: JsonNode): List<String> {
        return removeBuildingBlockVersionChecker.findVersionless(component) +
            nestedInstructionsWithoutTarget(component)
    }

    /** Every nested instruction naming no target, said in terms of its entry — these copies reach no other validator, so a blank target would silently skip a process the entry is dissolving a block around. */
    private fun nestedInstructionsWithoutTarget(component: JsonNode): List<String> =
        component.filter { it.isObject }.flatMap { entry ->
            val block = entry.get("buildingBlockKey")?.takeIf { it.isTextual }?.asText() ?: "?"
            ProcessMigrationTargetChecker.sourcesWithoutTarget(entry.get("processMigration"))
                .map { sourceKey ->
                    "removes building block '$block': ${ProcessMigrationTargetChecker.describe(sourceKey)}"
                }
        }
}
