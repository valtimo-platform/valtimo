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

/** Refuses an `addBuildingBlock` entry that can never hijack anything — no `processMigration` and no call-activity link, or a process key no deployed blueprint has. Otherwise the plan creates nothing and reports success. */
class AddBuildingBlockProcessChecker(
    private val processDefinitionBlueprintResolvers: List<ProcessDefinitionBlueprintResolver>,
    private val activityValidator: ProcessMigrationActivityValidator,
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
) {

    /** Entries that can never take over a process, whatever the running system looks like. An entry with no `processMigration` is fine where [target] declares the block on a call activity — the tree walk finds it. */
    fun findEntriesWithoutProcessMigration(
        target: BlueprintId,
        instructions: List<AddBuildingBlockInstruction>,
        /** [target]'s call-activity closure when the caller already has it — see the note in [AddBuildingBlockLinkChecker.findUnlinked]. */
        callActivityReachable: Set<BuildingBlockDefinitionId>? = null,
    ): List<String> {
        if (instructions.isEmpty()) {
            return emptyList()
        }
        val adoptable = callActivityReachable
            ?: linkedBuildingBlockVersionResolver.resolveCallActivityReachable(target)

        return instructions
            .filter { it.processMigration.isEmpty() && blockOf(it) !in adoptable }
            .map { instruction ->
                "adds building block '${blockOf(instruction)}' without a 'processMigration', and '$target' " +
                    "does not declare it on a call activity either. A building block takes over a process " +
                    "the owner is already running: either name that process and the block's process to " +
                    "take it over with, or declare the block on a call activity so it can be adopted from " +
                    "the running tree. As it stands the entry has nothing to do and is skipped for every case."
            }
    }

    /** @throws IllegalStateException when any of [instructions] can reach a process by neither route. */
    fun assertHijacksSomething(
        target: BlueprintId,
        instructions: List<AddBuildingBlockInstruction>,
        callActivityReachable: Set<BuildingBlockDefinitionId>? = null,
    ) {
        val problems = findEntriesWithoutProcessMigration(target, instructions, callActivityReachable)
        check(problems.isEmpty()) {
            "Migration plan for '$target' ${problems.joinToString("; and ")}"
        }
    }

    /** Problems with the process definitions each entry names. The owner's process is looked for on both versions: the plan's own `processMigration` (@200) may already have moved it. */
    fun findUnresolvableProcesses(
        source: BlueprintId,
        target: BlueprintId,
        instructions: List<AddBuildingBlockInstruction>,
    ): List<String> {
        if (instructions.isEmpty()) {
            return emptyList()
        }
        // Target last, so a key both versions carry resolves to the target's deployment.
        val ownerProcesses = processDefinitionsOf(source).orEmpty() + processDefinitionsOf(target).orEmpty()
        if (ownerProcesses.isEmpty()) {
            return emptyList() // neither end resolvable (an undeployed or unsupported blueprint type)
        }

        return instructions.flatMap { instruction ->
            val block = blockOf(instruction)
            // Empty, not just null: an undeployed block version resolves to no processes at all, which the link check already refuses.
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
