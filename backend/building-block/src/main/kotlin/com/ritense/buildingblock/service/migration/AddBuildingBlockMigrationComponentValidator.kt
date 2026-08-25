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

/**
 * Validates the `addBuildingBlock` component of a plan before it is saved, on two axes:
 *
 * - the building block **version** it creates has to be one the target blueprint version links
 *   (D12, [AddBuildingBlockLinkChecker]);
 * - the **process** it takes over has to be one that can exist ([AddBuildingBlockProcessChecker]).
 *
 * Both matter here rather than at execution because a plan is only free to fix before it runs: an
 * entry naming a version nobody links leaves instances behind that no later migration can see, and
 * an entry that can never hijack anything quietly does nothing to every case it is run against.
 *
 * Note that the nested `processMigration` of an `addBuildingBlock` entry reaches no other validator.
 * `MigrationSuggestionService.findPlanProblems` dispatches validators on **top-level** component
 * keys, so `ProcessMigrationComponentValidator` never sees these instructions — this is the only
 * place they are checked before they run.
 */
class AddBuildingBlockMigrationComponentValidator(
    private val objectMapper: ObjectMapper,
    private val addBuildingBlockLinkChecker: AddBuildingBlockLinkChecker,
    private val addBuildingBlockProcessChecker: AddBuildingBlockProcessChecker,
) : MigrationComponentValidator {

    override fun componentKey() = AddBuildingBlockMigrationComponentDeployer.ADD_BUILDING_BLOCK_COMPONENT_KEY

    override fun validate(source: BlueprintId, target: BlueprintId, component: JsonNode): List<String> {
        // Before `convertValue`, because that is what a nested null target answers 500 from — G47's fix
        // for the top-level component, which never reached these copies (see the class note above).
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

    /**
     * Every nested `processMigration` instruction naming no target, said in terms of the entry it belongs
     * to. No `Available:` list: resolving the block's processes needs a deployment lookup this check
     * deliberately runs before, and the author is being told the field is empty, not that it is wrong.
     */
    private fun nestedInstructionsWithoutTarget(component: JsonNode): List<String> =
        component.filter { it.isObject }.flatMap { entry ->
            val block = entry.get("buildingBlockKey")?.takeIf { it.isTextual }?.asText() ?: "?"
            ProcessMigrationTargetChecker.sourcesWithoutTarget(entry.get("processMigration"))
                .map { sourceKey -> "adds building block '$block': ${ProcessMigrationTargetChecker.describe(sourceKey)}" }
        }
}
