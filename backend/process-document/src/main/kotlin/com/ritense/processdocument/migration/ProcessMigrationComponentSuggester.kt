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
import com.ritense.valtimo.contract.blueprint.migration.BlueprintProcessOwnership
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
 * who accepts it migrates the tokens of a whole running process onto an unrelated one.
 *
 * How "does not have" is decided depends on which two blueprints are being compared:
 *
 * - **Two versions of the same blueprint** — the ordinary version upgrade. A process that survives into
 *   the new version keeps its key, so the counterpart is the target with the *same key* and nothing
 *   else qualifies. No similarity, no threshold. A source key the target does not own is then either
 *   *relocated* — a building block the target declares owns it, so adoption handles it and there is
 *   nothing to say — or genuinely unaccounted for, in which case it is suggested **with no target** for
 *   the author to complete or delete. See [unmapped].
 * - **Two different blueprints** — an owner and its building block, or a cross-key case migration. Keys
 *   have nothing in common by nature there, so the nearest match is kept whatever it scores: the author
 *   declared that pairing by writing the entry, and there is no better signal to go on.
 *
 * **Why matching by similarity within one blueprint had to go.** It replaced a rule with no threshold
 * at all, and a threshold turned out not to exist. Calibrated on one case definition, 0.7 sat in a wide
 * gap between unrelated pairs (39–50%) and renames (79–98%). On the next case definition measured,
 * `aanvraag-ioaw-uitkering-dcm`, eight wrong pairings scored **0.70 to 0.80** — inside the band the
 * first configuration classified as renames — and two of them failed 14 of 20 cases with Operaton
 * `ENGINE-23004`. They score highly because the names describe the same business step, which is exactly
 * why that step's process was moved out of the case and into a building block: `0.1.0-migrated` links
 * 102 processes and `1.0.0` links 13, so 89 sources have no case-level counterpart by construction and
 * read as near-matches of the case process that now starts them. String similarity cannot tell a
 * renamed process from a relocated one, so within a blueprint it is not asked to.
 */
class ProcessMigrationComponentSuggester(
    private val processDefinitionBlueprintResolvers: List<ProcessDefinitionBlueprintResolver>,
    private val processActivityMapper: ProcessActivityMapper,
    /**
     * Tells a process the target *relocated* into a building block from one it simply no longer has.
     * Optional: with no implementation every unmatched source counts as unexplained, which is the
     * honest answer for a deployment that has no building blocks to relocate anything into.
     */
    private val blueprintProcessOwnerships: List<BlueprintProcessOwnership> = emptyList(),
) : MigrationComponentSuggester {

    /**
     * A `processMigration` entry whose target the suggester could not work out, carried as a `null`.
     *
     * It exists only in a *suggestion*. The plan format's own [ProcessMigrationInstruction] keeps a
     * non-null target, because that is what nine execution and checker sites read and none of them has
     * any business handling a placeholder; and `ProcessMigrationComponentValidator` refuses a null
     * target on save, so one can never be stored. What the author gets is a row in the editor with the
     * source filled in and the target empty — visible work, which they either complete or delete.
     */
    private data class UnmappedProcess(
        val sourceProcessDefinitionKey: String,
        val targetProcessDefinitionKey: String? = null,
        val mapActivities: Map<String, String> = emptyMap(),
    )

    override fun componentKey() = ProcessMigrationComponentDeployer.PROCESS_MIGRATION_COMPONENT_KEY

    override fun suggest(source: BlueprintId, target: BlueprintId): Any? {
        val sourceProcessDefinitions = resolveProcessDefinitions(source) ?: return null
        val targetProcessDefinitions = resolveProcessDefinitions(target)?.map { (key, definitionId) ->
            ProcessDefinitionRef(key, processActivityMapper.processDefinitionName(definitionId) ?: key, definitionId)
        } ?: return null
        if (targetProcessDefinitions.isEmpty()) {
            return null
        }

        val sameBlueprint = isSameBlueprint(source, target)
        val targetsByKey = targetProcessDefinitions.associateBy { it.key }
        // Resolved once per suggestion rather than per source process: it walks the whole link graph.
        val relocated = if (sameBlueprint) processesReachableFrom(target) else emptySet()

        // Sorted, so the same two versions always suggest the same plan whatever order the resolver
        // happened to answer in, and a 16-instruction component stays reviewable.
        val instructions = sourceProcessDefinitions.entries
            .sortedBy { it.key }
            .mapNotNull { (sourceKey, sourceDefinitionId) ->
                val sourceName = processActivityMapper.processDefinitionName(sourceDefinitionId) ?: sourceKey

                val counterpart = if (sameBlueprint) {
                    targetsByKey[sourceKey] ?: return@mapNotNull unmapped(
                        sourceKey, sourceName, target, targetProcessDefinitions, relocated,
                    )
                } else {
                    bestMatchFor(sourceKey, sourceName, targetProcessDefinitions)?.first
                        ?: return@mapNotNull null
                }

                ProcessMigrationInstruction(
                    sourceProcessDefinitionKey = sourceKey,
                    targetProcessDefinitionKey = counterpart.key,
                    mapActivities = processActivityMapper.suggestActivityMapping(
                        sourceDefinitionId,
                        counterpart.definitionId,
                    ),
                )
            }

        return instructions.ifEmpty { null }
    }

    /**
     * What to do with a source process the target version does not own: nothing, when a building block
     * the target reaches owns it, and otherwise an [UnmappedProcess] — a row with the target left blank
     * for the author to fill in or delete.
     *
     * The distinction is the whole point. A process the target *relocated* into a block is already
     * accounted for by the plan's `addBuildingBlock` entry, and an instruction for it would fight that
     * entry; on `aanvraag-ioaw-uitkering-dcm` that is 87 of the 89 processes the target no longer owns.
     * Surfacing those as work would bury the 2 that are genuinely unexplained — and since a blank target
     * is refused on save, it would also leave the author 87 rows to delete before the suggested plan
     * could be stored at all.
     *
     * The closest candidate and its score are logged either way. Refusing to guess is no use to an
     * author who cannot see what was refused, and a process genuinely *renamed* between two versions is
     * the one case the exact-key rule cannot serve, so the line says what came closest and how close.
     */
    private fun unmapped(
        sourceKey: String,
        sourceName: String,
        target: BlueprintId,
        targets: List<ProcessDefinitionRef>,
        relocated: Set<String>,
    ): UnmappedProcess? {
        val closest = bestMatchFor(sourceKey, sourceName, targets)
        val nearest = closest
            ?.let { (best, score) -> "the closest is '${best.key}' at ${percentage(score)} similarity" }
            ?: "it owns no processes at all"

        if (sourceKey in relocated) {
            logger.info {
                "Process '$sourceKey' is no longer a process of '$target' but belongs to a building block " +
                    "it declares, so it is adopted rather than migrated and no 'processMigration' " +
                    "instruction is suggested for it."
            }
            return null
        }

        logger.info {
            "Process '$sourceKey' has no counterpart in '$target' ($nearest) and no building block it " +
                "declares owns it either, so it is suggested with no target for the author to complete or " +
                "remove. Left as it is, instances running it stay where they are."
        }
        return UnmappedProcess(sourceProcessDefinitionKey = sourceKey)
    }

    /** Processes owned by the building blocks [blueprintId] reaches, via the first ownership that answers. */
    private fun processesReachableFrom(blueprintId: BlueprintId): Set<String> =
        blueprintProcessOwnerships
            .firstOrNull { it.supports(blueprintId.blueprintType()) }
            ?.processesOfReachableBlueprints(blueprintId)
            .orEmpty()

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
        val logger = KotlinLogging.logger {}
    }
}
