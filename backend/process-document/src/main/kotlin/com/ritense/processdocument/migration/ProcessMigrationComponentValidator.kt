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

/** Validates `processMigration` on save: the engine judges every activity mapping, and a process key neither blueprint deploys is refused — at execution an unknown source key is skipped in silence. */
class ProcessMigrationComponentValidator(
    private val processDefinitionBlueprintResolvers: List<ProcessDefinitionBlueprintResolver>,
    private val activityValidator: ProcessMigrationActivityValidator,
    private val objectMapper: ObjectMapper,
) : MigrationComponentValidator {

    override fun componentKey() = ProcessMigrationComponentDeployer.PROCESS_MIGRATION_COMPONENT_KEY

    override fun validate(source: BlueprintId, target: BlueprintId, component: JsonNode): List<String> {
        val sourceProcessDefinitions = resolveProcessDefinitions(source) ?: return emptyList()
        val targetProcessDefinitions = resolveProcessDefinitions(target) ?: return emptyList()

        // Refused before deserialization, and shared with the building-block validators so their nested copies are refused the same way.
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
            // There is no run-time guard: an unmatched source key finds no instances and is skipped without a word, so a mistyped key migrates every document and no process.
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
