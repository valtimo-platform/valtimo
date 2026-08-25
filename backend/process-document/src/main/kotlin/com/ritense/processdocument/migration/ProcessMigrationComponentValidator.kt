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

package com.ritense.processdocument.migration

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentValidator
import com.ritense.valtimo.migration.ProcessMigrationComponentDeployer
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction

/**
 * Validates the `processMigration` component of a plan before it is saved. For each instruction it
 * resolves the source and target process definition ids (via the matching
 * [ProcessDefinitionBlueprintResolver], so it works for case↔case, block↔block and mixed plans) and
 * asks the engine ([ProcessMigrationActivityValidator]) whether the activity mapping is a valid
 * migration — the same check that runs at execution — so an incompatible mapping is rejected on save.
 *
 * It also rejects a process definition key neither blueprint deploys. That is not something the
 * engine can catch later: at execution an unknown source key simply matches no running process and
 * the instruction is skipped in silence, which is indistinguishable from a case that has nothing
 * running. Save is the last point at which the plan can still be corrected.
 */
class ProcessMigrationComponentValidator(
    private val processDefinitionBlueprintResolvers: List<ProcessDefinitionBlueprintResolver>,
    private val activityValidator: ProcessMigrationActivityValidator,
    private val objectMapper: ObjectMapper,
) : MigrationComponentValidator {

    override fun componentKey() = ProcessMigrationComponentDeployer.PROCESS_MIGRATION_COMPONENT_KEY

    override fun validate(source: BlueprintId, target: BlueprintId, component: JsonNode): List<String> {
        val sourceProcessDefinitions = resolveProcessDefinitions(source) ?: return emptyList()
        val targetProcessDefinitions = resolveProcessDefinitions(target) ?: return emptyList()

        // Refused before the component is deserialized, and shared with the two building-block validators
        // so the copies nested in their entries are refused the same way — see [ProcessMigrationTargetChecker].
        val missingTarget = ProcessMigrationTargetChecker.sourcesWithoutTarget(component)
        if (missingTarget.isNotEmpty()) {
            return missingTarget.map { sourceKey ->
                ProcessMigrationTargetChecker.describe(sourceKey, targetProcessDefinitions.keys)
            }
        }

        val instructions: List<ProcessMigrationInstruction> = objectMapper.convertValue(
            component,
            object : TypeReference<List<ProcessMigrationInstruction>>() {},
        )

        return instructions.flatMap { instruction ->
            val sourceDefinitionId = sourceProcessDefinitions[instruction.sourceProcessDefinitionKey]
            val targetDefinitionId = targetProcessDefinitions[instruction.targetProcessDefinitionKey]
            // A key neither end deploys used to be left "to the run-time guard", but there is no such
            // guard: at execution an unmatched source key finds no process instances and the
            // instruction is skipped without a word, so a mistyped key migrates every case's document
            // and none of its processes. Save is the last moment it is free to fix.
            if (sourceDefinitionId == null) {
                listOf(
                    "'${instruction.sourceProcessDefinitionKey}' is not a process of '$source', so no " +
                        "running process will ever match it and the instruction would be skipped for " +
                        "every case. Available: ${sourceProcessDefinitions.keys.sorted().joinToString { "'$it'" }}."
                )
            } else if (targetDefinitionId == null) {
                listOf(
                    "'${instruction.targetProcessDefinitionKey}' is not a process of '$target', so there " +
                        "is nothing to migrate '${instruction.sourceProcessDefinitionKey}' onto. " +
                        "Available: ${targetProcessDefinitions.keys.sorted().joinToString { "'$it'" }}."
                )
            } else {
                activityValidator
                    .findInvalidActivityMappings(sourceDefinitionId, targetDefinitionId, instruction.mapActivities)
                    .flatMap { (activityId, failures) ->
                        failures.map { failure ->
                            "'${instruction.sourceProcessDefinitionKey}' -> " +
                                "'${instruction.targetProcessDefinitionKey}', activity '$activityId': $failure"
                        }
                    }
            }
        }
    }

    /** Process key -> definition id for the blueprint, or null when no resolver handles its type. */
    private fun resolveProcessDefinitions(blueprintId: BlueprintId): Map<String, String>? =
        processDefinitionBlueprintResolvers
            .firstOrNull { it.supports(blueprintId.blueprintType()) }
            ?.resolveProcessDefinitions(blueprintId)

}
