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
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlin.math.roundToInt

/**
 * Best-effort `processMigration` suggestion, independent of blueprint type. The source and target
 * process definitions are resolved separately through the matching [ProcessDefinitionBlueprintResolver]
 * (so it works for case↔case, block↔block, and mixed case↔block plans alike). Every source process
 * definition is paired with the target whose process key or name is most similar — a target may back
 * several sources, and targets without a source are left unmapped. For each pair it then suggests an
 * activity mapping, giving the user a sensible starting point to tweak.
 *
 * **A source process the target version does not have is left unmapped**, because the alternative is
 * worse than an empty suggestion: the editor pre-fills the plan with what is suggested, so an author
 * who accepts it migrates the tokens of a whole running process onto an unrelated one. That is only
 * decidable when both sides are the *same blueprint* — a new version of it is expected to carry its
 * process keys over, so [MINIMUM_SIMILARITY] is required of the best candidate and anything below it
 * is dropped with a log line. Across blueprints (an owner and its building block, or a cross-key case
 * migration) the keys have nothing in common by nature, so the nearest match is kept whatever it
 * scores: the author declared that pairing themselves, and there is no better signal to go on.
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

        val counterpartRequired = isSameBlueprint(source, target)

        // Sorted, so the same two versions always suggest the same plan whatever order the resolver
        // happened to answer in, and a 16-instruction component stays reviewable.
        val instructions = sourceProcessDefinitions.entries
            .sortedBy { it.key }
            .mapNotNull { (sourceKey, sourceDefinitionId) ->
            val sourceName = processActivityMapper.processDefinitionName(sourceDefinitionId) ?: sourceKey
            val (best, score) = bestMatchFor(sourceKey, sourceName, targetProcessDefinitions)
                ?: return@mapNotNull null

            if (counterpartRequired && score < MINIMUM_SIMILARITY) {
                logger.info {
                    "Process '$sourceKey' has no counterpart in '$target' (the closest, '${best.key}', is only " +
                        "${percentage(score)} similar and ${percentage(MINIMUM_SIMILARITY)} is needed), so no " +
                        "'processMigration' instruction is suggested for it. Instances running it are left where " +
                        "they are unless an instruction is added by hand."
                }
                return@mapNotNull null
            }

            ProcessMigrationInstruction(
                sourceProcessDefinitionKey = sourceKey,
                targetProcessDefinitionKey = best.key,
                mapActivities = processActivityMapper.suggestActivityMapping(sourceDefinitionId, best.definitionId),
            )
        }

        return instructions.ifEmpty { null }
    }

    /** The most similar target and how similar it is, or null when there is nothing to choose from. */
    private fun bestMatchFor(
        sourceKey: String,
        sourceName: String,
        targets: List<ProcessDefinitionRef>,
    ): Pair<ProcessDefinitionRef, Double>? =
        targets.map { it to score(sourceKey, sourceName, it) }.maxByOrNull { (_, score) -> score }

    /** max( similarity(source key, target key), similarity(source name, target name) ) — 0.0..1.0. */
    private fun score(sourceKey: String, sourceName: String, target: ProcessDefinitionRef): Double = maxOf(
        LcsDistance.similarityOf(sourceKey.lowercase(), target.key.lowercase()),
        LcsDistance.similarityOf(sourceName.lowercase(), target.name.lowercase()),
    )

    /** Two versions of one blueprint, i.e. the case where a process is expected to keep its key. */
    private fun isSameBlueprint(source: BlueprintId, target: BlueprintId): Boolean =
        source.blueprintType() == target.blueprintType() && source.getIdKey() == target.getIdKey()

    private fun percentage(score: Double): String = "${(score * 100).roundToInt()}%"

    /** Process key -> definition id for the blueprint, or null when no resolver handles its type. */
    private fun resolveProcessDefinitions(blueprintId: BlueprintId): Map<String, String>? =
        processDefinitionBlueprintResolvers
            .firstOrNull { it.supports(blueprintId.blueprintType()) }
            ?.resolveProcessDefinitions(blueprintId)

    private data class ProcessDefinitionRef(val key: String, val name: String, val definitionId: String)

    private companion object {
        /**
         * How similar the best candidate has to be before a new version of the same blueprint is taken
         * to hold the same process. Measured on the configuration that produced the wrong suggestions:
         * unrelated pairs scored 39%, 40% and 50%, while a renamed process scores 79% and up (a suffix
         * change such as `…-plugin-v2` → `…-plugin-v3` scores 98%). 70% sits in the gap, well clear of
         * both.
         */
        const val MINIMUM_SIMILARITY = 0.7

        val logger = KotlinLogging.logger {}
    }
}
