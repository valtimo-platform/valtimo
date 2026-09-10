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

import com.ritense.case_.domain.migration.CaseDefinitionMigration
import com.ritense.case_.repository.CaseDefinitionMigrationRepository
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId

/** Walks the deployed plans as a graph — each declares the version it migrates from and is deployed under the one it migrates to — to chain an instance onto the version its owner links. No path refuses or answers null depending on the caller; two paths always refuse. */
class BuildingBlockMigrationPathResolver(
    private val caseDefinitionMigrationRepository: CaseDefinitionMigrationRepository,
) {

    /** One hop of an upgrade: the plan to apply, and the version it lands the instance on. */
    data class MigrationStep(
        val planId: BlueprintMigrationId,
        val target: BuildingBlockDefinitionId,
    )

    /** The plans to apply, in order, to get from [current] to [target]; empty when they are the same version. @throws IllegalStateException when no chain connects them, or more than one does. */
    fun resolvePath(
        current: BuildingBlockDefinitionId,
        target: BuildingBlockDefinitionId,
    ): List<MigrationStep> {
        return findPath(current, target)
            ?: throw IllegalStateException(
                "No migration plan connects building block version '$current' to '$target', which its " +
                    "owner links. Every version an instance travels through needs a plan, including one " +
                    "that changes nothing: a building block version deploys its own BPMN under its own " +
                    "version tag, so a running process has to be migrated onto it explicitly. Deploy a " +
                    "'*.building-block-migration.json' whose 'source' leads from '$current' to '$target' " +
                    "— either one plan declaring the whole jump, or one per step."
            )
    }

    /** As [resolvePath], but null rather than a refusal when nothing connects the two versions — for a block with no running process (G49). Ambiguity still throws. */
    fun findPath(
        current: BuildingBlockDefinitionId,
        target: BuildingBlockDefinitionId,
    ): List<MigrationStep>? {
        if (current == target) {
            return emptyList()
        }

        val paths = findPaths(current, target, stopAfter = 2)
        if (paths.isEmpty()) {
            return null
        }
        if (paths.size > 1) {
            throw IllegalStateException(
                "Building block version '$current' can reach '$target' along more than one chain of " +
                    "migration plans (${paths.joinToString(" and ") { path -> "'${describe(path)}'" }}). " +
                    "Which of them a running instance goes through would decide which data and process " +
                    "transformations are applied to it, so it is not something to pick for you: remove or " +
                    "re-source one of the plans so exactly one chain remains."
            )
        }
        return paths.single()
    }

    /** Whether any chain leads from [current] to [target] — used to work out which of an owner's links an instance can follow. */
    fun isReachable(current: BuildingBlockDefinitionId, target: BuildingBlockDefinitionId): Boolean {
        return current == target || findPaths(current, target, stopAfter = 1).isNotEmpty()
    }

    /** DFS for the chains from [from] to [to], abandoned after [stopAfter] — no caller needs more than "none", "one" or "more than one", which is what keeps this cheap. */
    private fun findPaths(
        from: BuildingBlockDefinitionId,
        to: BuildingBlockDefinitionId,
        stopAfter: Int,
    ): List<List<MigrationStep>> {
        val found = mutableListOf<List<MigrationStep>>()
        walk(from, to, mutableListOf(), mutableSetOf(from), found, stopAfter)
        return found
    }

    private fun walk(
        node: BuildingBlockDefinitionId,
        destination: BuildingBlockDefinitionId,
        path: MutableList<MigrationStep>,
        visited: MutableSet<BuildingBlockDefinitionId>,
        found: MutableList<List<MigrationStep>>,
        stopAfter: Int,
    ) {
        if (found.size >= stopAfter || path.size >= MAX_CHAIN_LENGTH) {
            return
        }
        outgoingSteps(node).forEach { step ->
            if (step.target == destination) {
                found += path + step
                if (found.size >= stopAfter) return
            } else if (visited.add(step.target)) {
                path += step
                walk(step.target, destination, path, visited, found, stopAfter)
                path.removeLast()
                visited.remove(step.target)
            }
        }
    }

    /** The plans that migrate instances away from [node], each paired with the version it lands them on. */
    private fun outgoingSteps(node: BuildingBlockDefinitionId): List<MigrationStep> {
        return caseDefinitionMigrationRepository
            .findAllByIdBlueprintTypeAndSourceKeyAndSourceVersionTag(
                BlueprintType.BUILDING_BLOCK, node.key, node.versionTag
            )
            // Sorted so a resolved chain and an ambiguity message do not depend on how the database returned the rows.
            .sortedBy { it.id.migrationKey }
            .map { plan -> MigrationStep(plan.id, targetOf(plan)) }
    }

    private fun targetOf(plan: CaseDefinitionMigration) =
        BuildingBlockDefinitionId(plan.id.key, plan.id.versionTag)

    private fun describe(path: List<MigrationStep>) = path.joinToString(" -> ") { it.planId.migrationKey }

    private companion object {
        const val MAX_CHAIN_LENGTH = 100
    }
}
