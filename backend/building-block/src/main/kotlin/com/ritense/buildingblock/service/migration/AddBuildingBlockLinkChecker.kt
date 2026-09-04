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

import com.ritense.buildingblock.domain.migration.AddBuildingBlockInstruction
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId

/** Refuses an `addBuildingBlock` entry naming a block version [target] links nowhere — alignment would never find it again (R2). Checked on the save path and at execution, which catches a file-deployed plan. */
class AddBuildingBlockLinkChecker(
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
) {

    /** Descriptions of every instruction whose building block version [target] does not link; empty when they all check out. */
    fun findUnlinked(
        target: BlueprintId,
        instructions: List<AddBuildingBlockInstruction>,
        /** [target]'s call-activity closure when the caller already has it (G31); null means work it out — the save path, which checks one plan once. */
        callActivityReachable: Set<BuildingBlockDefinitionId>? = null,
    ): List<String> {
        if (instructions.isEmpty()) {
            return emptyList()
        }
        // Directly linked plus everything below: a nested block is declared by the block above it, and adoption reaches both in one run.
        val linked = (
            linkedBuildingBlockVersionResolver.resolveLinkedVersions(target).map { it.buildingBlockDefinitionId } +
                (callActivityReachable ?: linkedBuildingBlockVersionResolver.resolveCallActivityReachable(target))
            ).distinct()

        return instructions.mapNotNull { instruction ->
            val added = BuildingBlockDefinitionId.of(
                instruction.buildingBlockKey, instruction.buildingBlockVersionTag
            )
            if (linked.contains(added)) {
                return@mapNotNull null
            }
            val sameKey = linked.filter { it.key == added.key }
            val mismatch = if (sameKey.isEmpty()) {
                "'$target' links no version of '${added.key}' at all"
            } else {
                "'$target' links ${sameKey.sortedBy { it.toString() }.joinToString { "'$it'" }} instead"
            }
            "adds building block '$added', which is never used: $mismatch. A building block is only " +
                "kept up to date by later migrations if the blueprint version owning it links the " +
                "version it is on, as a startable item or as a call activity. Link '$added' on " +
                "'$target', or point this entry at a version '$target' does link."
        }
    }

    /** @throws IllegalStateException when [target] links none of the versions [instructions] would create — the alternative is an instance invisible to every later migration. */
    fun assertLinked(
        target: BlueprintId,
        instructions: List<AddBuildingBlockInstruction>,
        callActivityReachable: Set<BuildingBlockDefinitionId>? = null,
    ) {
        val problems = findUnlinked(target, instructions, callActivityReachable)
        check(problems.isEmpty()) {
            "Migration plan for '$target' ${problems.joinToString("; and ")}"
        }
    }
}
