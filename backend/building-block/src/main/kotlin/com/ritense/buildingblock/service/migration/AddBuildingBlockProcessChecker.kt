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
import com.ritense.processdocument.migration.ProcessDefinitionBlueprintResolver
import com.ritense.processdocument.migration.ProcessMigrationActivityValidator
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId

/**
 * Checks that every `addBuildingBlock` entry names a process migration that can actually hijack
 * something — the companion to [AddBuildingBlockLinkChecker], which checks the block *version*.
 *
 * `addBuildingBlock` does not start a process; it takes over one the owner is already running
 * (G19). Everything an entry does therefore hangs off its `processMigration`: the executor resolves
 * the processes to hijack first and, finding none, skips the entry whole — no document, no
 * instance. That skip is correct for a case with nothing running (a closed case has no process to
 * take over), but it is indistinguishable, from the outside, from an entry that can never hijack
 * anything at all. A plan whose every entry is in the second state migrates every case, creates
 * nothing and reports success, which is exactly what it looks like when it works.
 *
 * Two states are never a runtime condition and always a mistake in the plan, so they are refused
 * rather than skipped:
 *
 * - **no `processMigration` at all.** The field defaults to an empty list, so an entry naming only a
 *   building block key and version parses cleanly and is unconditionally a no-op — for every case,
 *   on every run, forever.
 * - **a `sourceProcessDefinitionKey` or `targetProcessDefinitionKey` no deployed blueprint has.** No
 *   running process can ever match a key that does not exist, and no block can be handed a process
 *   definition its version does not carry.
 *
 * The first needs nothing but the entries and is checked on the save path *and* at execution — the
 * latter being what catches a plan deployed from a file, which never passes the save path (the same
 * argument as D12). The second needs the deployed blueprints on both ends and is checked on the save
 * path only; at execution the block's own missing process definition already fails the case loudly
 * in [AddBuildingBlockMigrationComponentExecutor], and a missing *source* key is left to the
 * (now-warned) skip, since by then the plan cannot be corrected anyway.
 */
class AddBuildingBlockProcessChecker(
    private val processDefinitionBlueprintResolvers: List<ProcessDefinitionBlueprintResolver>,
    private val activityValidator: ProcessMigrationActivityValidator,
) {

    /**
     * Entries that can never hijack a process, whatever the state of the running system; empty when
     * they all name one. Needs no deployed blueprint, so it holds at execution time too.
     */
    fun findEntriesWithoutProcessMigration(instructions: List<AddBuildingBlockInstruction>): List<String> =
        instructions.filter { it.processMigration.isEmpty() }.map { instruction ->
            "adds building block '${blockOf(instruction)}' without a 'processMigration'. Adding a " +
                "building block hands it a process the owner is already running, so an entry with no " +
                "process migration has nothing to do and is silently skipped for every case. Name the " +
                "owner's running process and the block's process to take it over with, or drop the entry."
        }

    /**
     * @throws IllegalStateException when any of [instructions] has no `processMigration`. Fatal on
     * purpose, like the D12 link check: the alternative is a plan that reports success on every case
     * and creates nothing.
     */
    fun assertHijacksSomething(target: BlueprintId, instructions: List<AddBuildingBlockInstruction>) {
        val problems = findEntriesWithoutProcessMigration(instructions)
        check(problems.isEmpty()) {
            "Migration plan for '$target' ${problems.joinToString("; and ")}"
        }
    }

    /**
     * Problems with the process definitions each entry names, resolved against the deployed
     * blueprints: an unknown process key on either end, or an activity mapping Operaton refuses.
     *
     * The owner's process is looked for on **both** the plan's [source] and [target] versions,
     * because by the time `addBuildingBlock` runs (@300) the plan's own `processMigration` (@200)
     * may already have moved it onto the target — and a plan with no `processMigration` of its own
     * leaves it on the source. A key present on neither is a typo either way.
     */
    fun findUnresolvableProcesses(
        source: BlueprintId,
        target: BlueprintId,
        instructions: List<AddBuildingBlockInstruction>,
    ): List<String> {
        if (instructions.isEmpty()) {
            return emptyList()
        }
        // Target last, so a key both versions carry resolves to the target's deployment — the one the
        // owner's process is most likely already on when the hijack runs.
        val ownerProcesses = processDefinitionsOf(source).orEmpty() + processDefinitionsOf(target).orEmpty()
        if (ownerProcesses.isEmpty()) {
            return emptyList() // neither end resolvable (an undeployed or unsupported blueprint type)
        }

        return instructions.flatMap { instruction ->
            val block = blockOf(instruction)
            // Empty, not just null: a block version that is not deployed yet resolves to no processes
            // at all, which is not the same as "deploys none of the one you named". Saying so would be
            // a second, confusing message on top of the link check's, which already refuses that plan.
            val blockProcesses = processDefinitionsOf(block)?.takeIf { it.isNotEmpty() }
                ?: return@flatMap emptyList()
            instruction.processMigration.flatMap { entry ->
                val ownerDefinitionId = ownerProcesses[entry.sourceProcessDefinitionKey]
                val blockDefinitionId = blockProcesses[entry.targetProcessDefinitionKey]
                when {
                    ownerDefinitionId == null -> listOf(
                        "adds building block '$block' by taking over process " +
                            "'${entry.sourceProcessDefinitionKey}', which neither '$source' nor '$target' " +
                            "deploys. No running process can match a key nothing deploys, so the entry " +
                            "would be skipped for every case. Available: " +
                            "${ownerProcesses.keys.sorted().joinToString { "'$it'" }}."
                    )

                    blockDefinitionId == null -> listOf(
                        "adds building block '$block' by migrating into process " +
                            "'${entry.targetProcessDefinitionKey}', which '$block' does not deploy. " +
                            "Available: ${blockProcesses.keys.sorted().joinToString { "'$it'" }}."
                    )

                    else -> activityValidator
                        .findInvalidActivityMappings(ownerDefinitionId, blockDefinitionId, entry.mapActivities)
                        .flatMap { (activityId, failures) ->
                            failures.map { failure ->
                                "adds building block '$block': '${entry.sourceProcessDefinitionKey}' -> " +
                                    "'${entry.targetProcessDefinitionKey}', activity '$activityId': $failure"
                            }
                        }
                }
            }
        }
    }

    private fun blockOf(instruction: AddBuildingBlockInstruction) =
        BuildingBlockDefinitionId.of(instruction.buildingBlockKey, instruction.buildingBlockVersionTag)

    /** Process definition key -> definition id for [blueprintId], or null when no resolver handles it. */
    private fun processDefinitionsOf(blueprintId: BlueprintId): Map<String, String>? =
        processDefinitionBlueprintResolvers
            .firstOrNull { it.supports(blueprintId.blueprintType()) }
            ?.resolveProcessDefinitions(blueprintId)
}
