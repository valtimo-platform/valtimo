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

/**
 * Checks that every building block version an `addBuildingBlock` component creates is one the plan's
 * target blueprint version actually **links** — as a startable item or as a call activity.
 *
 * A building block only ever moves to a newer version because the blueprint that owns it links that
 * newer version (R2); the links are the sole authority. So a plan that creates a block version its
 * target links nowhere creates something no later migration can ever see again: alignment asks the
 * target "which version of this block do you link?", gets no answer, and leaves the block where it is,
 * forever and silently. The same goes for a plan that creates `X:1.0.0` where the target links
 * `X:1.0.1` — the block is born on a version its owner does not want it on, and the next case
 * migration has to find a plan edge to correct it or fail the case outright.
 *
 * Neither is recoverable by editing the plan afterwards: the instances already exist. So this is
 * checked twice, once at each point where it can still be caught in time:
 *
 * - on the management save path, via [AddBuildingBlockMigrationComponentValidator], answering 400
 *   before the plan is stored at all;
 * - at execution, via [AddBuildingBlockMigrationComponentExecutor], which fails the case (and reports
 *   `WOULD_FAIL` on a dry run) — the guard that catches a plan deployed from a file, which never
 *   passes the save path.
 */
class AddBuildingBlockLinkChecker(
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
) {

    /**
     * Descriptions of every [instruction][instructions] whose building block version [target] does not
     * link; empty when they all check out.
     */
    fun findUnlinked(target: BlueprintId, instructions: List<AddBuildingBlockInstruction>): List<String> {
        if (instructions.isEmpty()) {
            return emptyList()
        }
        // Directly linked, plus everything reachable by following call activities down. A nested block is
        // declared by the block above it, never by the case: `bijstand:1.0.1` links `bijstand-uitvoeren`,
        // and `bijstand-besluit` is linked by `bijstand-uitvoeren`. An entry for the nested one is exactly
        // as legitimate as one for the level above — adoption reaches both in a single run — so the check
        // has to ask "does the target model this block anywhere below it", not "at the first level".
        val linked = (
            linkedBuildingBlockVersionResolver.resolveLinkedVersions(target).map { it.buildingBlockDefinitionId } +
                linkedBuildingBlockVersionResolver.resolveCallActivityReachable(target)
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

    /**
     * @throws IllegalStateException when [target] links none of the building block versions
     * [instructions] would create. Fatal on purpose: the alternative is creating an instance that is
     * invisible to every migration after this one.
     */
    fun assertLinked(target: BlueprintId, instructions: List<AddBuildingBlockInstruction>) {
        val problems = findUnlinked(target, instructions)
        check(problems.isEmpty()) {
            "Migration plan for '$target' ${problems.joinToString("; and ")}"
        }
    }
}
