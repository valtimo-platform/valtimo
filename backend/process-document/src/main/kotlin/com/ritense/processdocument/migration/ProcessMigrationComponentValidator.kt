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

        val instructions: List<ProcessMigrationInstruction> = objectMapper.convertValue(
            component,
            object : TypeReference<List<ProcessMigrationInstruction>>() {},
        )

        return instructions.flatMap { instruction ->
            val sourceDefinitionId = sourceProcessDefinitions[instruction.sourceProcessDefinitionKey]
            val targetDefinitionId = targetProcessDefinitions[instruction.targetProcessDefinitionKey]
            if (sourceDefinitionId == null || targetDefinitionId == null) {
                emptyList() // cannot resolve one of the definitions; leave it to the run-time guard
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
