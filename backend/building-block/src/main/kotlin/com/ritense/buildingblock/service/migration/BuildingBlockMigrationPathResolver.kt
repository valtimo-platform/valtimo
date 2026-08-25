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

/**
 * Works out which migration plans a building block instance has to be put through to get from the
 * building block version it is on to the version its owner now links.
 *
 * **The deployed plans are the graph.** Every plan declares the version it migrates instances *from*
 * and is deployed under the version it migrates them *to*, so a plan is an edge between two building
 * block versions and this walks those edges. An owner may link a version several versions ahead of the
 * instance, so the answer is generally a chain rather than a single hop — and because a plan's source
 * is explicit, a chain may be collapsed into one plan that declares the whole jump, and an edge may
 * cross from one building block *key* to another.
 *
 * Two failures, both loud, both for the same reason: a running building block is being moved, and
 * moving it the wrong way is worse than not moving it.
 *
 * - **No path.** Nothing connects the two versions. A *running* instance cannot be brought up to what
 *   its owner links, so the migration fails rather than leaving it behind on a version the owner no
 *   longer knows about. A version the instance would only travel *through* still needs its own plan: it
 *   deploys its own document schema and its own BPMN under its own `BB:<key>:<versionTag>` version tag,
 *   so there is a token to move and possibly a document to fit — and inferring that work would mean
 *   guessing. Whether that refusal is the right answer is the *caller's* to decide, because it rests on
 *   there being a token at all: [resolvePath] refuses, [findPath] answers null and lets a caller that
 *   knows nothing is running tolerate it (G49).
 * - **More than one path.** Two chains of plans lead to the same place. Which transformations an
 *   instance goes through would then depend on a tie-break nobody chose, so it is a configuration
 *   error to be resolved by removing an edge, not something to pick a winner for. Fatal either way:
 *   unlike a missing path, an ambiguous one is wrong for every instance on every run, and it decides
 *   which patches reach a document whether or not a process is running.
 */
class BuildingBlockMigrationPathResolver(
    private val caseDefinitionMigrationRepository: CaseDefinitionMigrationRepository,
) {

    /**
     * One hop of an upgrade: the plan to apply, and the building block version it lands the instance
     * on (the version that plan is deployed under).
     */
    data class MigrationStep(
        val planId: BlueprintMigrationId,
        val target: BuildingBlockDefinitionId,
    )

    /**
     * The plans to apply, in order, to get an instance from [current] to [target] — for a caller that
     * cannot do without them.
     *
     * Empty when [current] and [target] are the same version — there is nothing to do.
     *
     * @throws IllegalStateException when no chain of deployed plans connects the two versions, or when
     * more than one does.
     */
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

    /**
     * The same chain as [resolvePath], but **null** rather than a refusal when nothing connects the two
     * versions.
     *
     * For the caller that can live without a plan: a building block with no running process. The whole
     * force of the "no path" refusal is that a version owns its BPMN exclusively, so a token left on the
     * old definition is a token nobody will ever move — and a block that has finished, or never started,
     * has no token. Failing its case there fails a migration over work that does not exist, so the
     * decision belongs to whoever knows whether anything is running ([BuildingBlockVersionAlignmentExecutor]).
     *
     * Ambiguity is *not* softened the same way, and still throws: two chains reaching one version is a
     * configuration error rather than a property of this instance.
     *
     * @throws IllegalStateException when more than one chain of deployed plans connects the two versions.
     */
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

    /**
     * Whether any chain of deployed plans leads from [current] to [target] — without caring how many,
     * or which. Used to work out which of an owner's links an instance is actually able to follow.
     */
    fun isReachable(current: BuildingBlockDefinitionId, target: BuildingBlockDefinitionId): Boolean {
        return current == target || findPaths(current, target, stopAfter = 1).isNotEmpty()
    }

    /**
     * Depth-first search for the plan chains from [from] to [to], abandoning the search once
     * [stopAfter] of them have been found.
     *
     * The cap is what keeps this cheap: enumerating *every* path through a graph is exponential, but no
     * caller needs more than "none", "exactly one", or "more than one", so two is the most that is ever
     * collected. [MAX_CHAIN_LENGTH] is a runaway backstop for a pathological configuration rather than
     * a budget — real chains are one to three plans — and the visited set makes a cycle in the plan
     * graph terminate instead of looping.
     */
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
            // Sorted so the order of a resolved chain, and the wording of an ambiguity failure, do not
            // depend on how the database happened to return the rows.
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
