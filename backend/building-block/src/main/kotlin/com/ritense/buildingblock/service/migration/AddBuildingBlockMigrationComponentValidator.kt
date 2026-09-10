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
import com.ritense.buildingblock.domain.migration.AddBuildingBlockInstruction
import com.ritense.processdocument.migration.ProcessMigrationTargetChecker
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentValidator

/** Validates `addBuildingBlock` before save: the version must be linked (D12) and the process must be one that can exist. Also the only place an entry's nested `processMigration` is checked — validators dispatch on top-level keys. */
class AddBuildingBlockMigrationComponentValidator(
    private val objectMapper: ObjectMapper,
    private val addBuildingBlockLinkChecker: AddBuildingBlockLinkChecker,
    private val addBuildingBlockProcessChecker: AddBuildingBlockProcessChecker,
) : MigrationComponentValidator {

    override fun componentKey() = AddBuildingBlockMigrationComponentDeployer.ADD_BUILDING_BLOCK_COMPONENT_KEY

    override fun validate(source: BlueprintId, target: BlueprintId, component: JsonNode): List<String> {
        // Before `convertValue`, which is what a nested null target answers 500 from (G47).
        val missingTarget = nestedInstructionsWithoutTarget(component)
        if (missingTarget.isNotEmpty()) {
            return missingTarget
        }

        val instructions: List<AddBuildingBlockInstruction> = objectMapper.convertValue(
            component,
            object : TypeReference<List<AddBuildingBlockInstruction>>() {},
        )
        return addBuildingBlockLinkChecker.findUnlinked(target, instructions) +
            addBuildingBlockProcessChecker.findEntriesWithoutProcessMigration(target, instructions) +
            addBuildingBlockProcessChecker.findUnresolvableProcesses(source, target, instructions)
    }

    /** Every nested instruction naming no target, said in terms of its entry. No `Available:` list — resolving the block's processes needs a lookup this check runs before. */
    private fun nestedInstructionsWithoutTarget(component: JsonNode): List<String> =
        component.filter { it.isObject }.flatMap { entry ->
            val block = entry.get("buildingBlockKey")?.takeIf { it.isTextual }?.asText() ?: "?"
            ProcessMigrationTargetChecker.sourcesWithoutTarget(entry.get("processMigration"))
                .map { sourceKey -> "adds building block '$block': ${ProcessMigrationTargetChecker.describe(sourceKey)}" }
        }
}
