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

import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentSuggester
import com.ritense.valtimo.contract.utils.LcsDistance
import com.ritense.valtimo.migration.ProcessMigrationComponentDeployer
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction

/**
 * Best-effort `processMigration` suggestion, independent of blueprint type. The source and target
 * process definitions are resolved separately through the matching [ProcessDefinitionBlueprintResolver]
 * (so it works for case↔case, block↔block, and mixed case↔block plans alike). Every source process
 * definition is paired with the target whose process key is most similar (LCS distance) — a target
 * may back several sources, and targets without a source are left unmapped. For each pair it then
 * suggests an activity mapping, giving the user a sensible starting point to tweak.
 */
class ProcessMigrationComponentSuggester(
    private val processDefinitionBlueprintResolvers: List<ProcessDefinitionBlueprintResolver>,
    private val processActivityMapper: ProcessActivityMapper,
) : MigrationComponentSuggester {

    override fun componentKey() = ProcessMigrationComponentDeployer.PROCESS_MIGRATION_COMPONENT_KEY

    override fun suggest(source: BlueprintId, target: BlueprintId): Any? {
        val sourceProcessDefinitions = resolveProcessDefinitions(source) ?: return null
        val targetProcessDefinitions = resolveProcessDefinitions(target)?.map { (key, definitionId) ->
            ProcessDefinitionRef(key, processActivityMapper.processDefinitionName(definitionId) ?: key, definitionId)
        } ?: return null
        if (targetProcessDefinitions.isEmpty()) {
            return null
        }

        val instructions = sourceProcessDefinitions.map { (sourceKey, sourceDefinitionId) ->
            val sourceName = processActivityMapper.processDefinitionName(sourceDefinitionId) ?: sourceKey
            val target = targetProcessDefinitions.minByOrNull { score(sourceKey, sourceName, it) }!!
            ProcessMigrationInstruction(
                sourceProcessDefinitionKey = sourceKey,
                targetProcessDefinitionKey = target.key,
                mapActivities = processActivityMapper.suggestActivityMapping(sourceDefinitionId, target.definitionId),
            )
        }

        return instructions.ifEmpty { null }
    }

    /** min( LCS(source key, target key), LCS(source name, target name) ) — lower is more similar. */
    private fun score(sourceKey: String, sourceName: String, target: ProcessDefinitionRef): Int = minOf(
        LcsDistance.between(sourceKey.lowercase(), target.key.lowercase()),
        LcsDistance.between(sourceName.lowercase(), target.name.lowercase()),
    )

    /** Process key -> definition id for the blueprint, or null when no resolver handles its type. */
    private fun resolveProcessDefinitions(blueprintId: BlueprintId): Map<String, String>? =
        processDefinitionBlueprintResolvers
            .firstOrNull { it.supports(blueprintId.blueprintType()) }
            ?.resolveProcessDefinitions(blueprintId)

    private data class ProcessDefinitionRef(val key: String, val name: String, val definitionId: String)
}
