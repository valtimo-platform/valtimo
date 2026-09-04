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
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintProcessOwnership
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentSuggester
import com.ritense.valtimo.contract.utils.LcsDistance
import com.ritense.valtimo.migration.ProcessMigrationComponentDeployer
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlin.math.roundToInt

/** Best-effort `processMigration` suggestion. Within one blueprint a counterpart must share the key exactly — string similarity cannot tell a renamed process from one relocated into a building block (G46). */
class ProcessMigrationComponentSuggester(
    private val processDefinitionBlueprintResolvers: List<ProcessDefinitionBlueprintResolver>,
    private val processActivityMapper: ProcessActivityMapper,
    /** Tells a process the target relocated into a building block from one it simply no longer has. Optional. */
    private val blueprintProcessOwnerships: List<BlueprintProcessOwnership> = emptyList(),
) : MigrationComponentSuggester {

    /** A suggested entry whose target could not be worked out. Only ever a suggestion — the plan format keeps the target non-null and the validator refuses a blank one on save. */
    private data class UnmappedProcess(
        val sourceProcessDefinitionKey: String,
        val targetProcessDefinitionKey: String? = null,
        val mapActivities: Map<String, String> = emptyMap(),
    )

    override fun componentKey() = ProcessMigrationComponentDeployer.PROCESS_MIGRATION_COMPONENT_KEY

    /** A plan migrating instances between two blueprint versions — the ordinary case. */
    override fun suggest(source: BlueprintId, target: BlueprintId): Any? =
        suggest(source, target, buildingBlockEntry = false)

    /** The `processMigration` of an add/removeBuildingBlock entry — a hijack. Told rather than inferred: a nested entry and a cross-key block plan are both `block -> block`. */
    override fun suggestForBuildingBlockEntry(
        source: BlueprintId,
        target: BlueprintId,
        running: BlueprintId,
    ): Any? = suggest(source, target, buildingBlockEntry = true, running = running)

    private fun suggest(
        source: BlueprintId,
        target: BlueprintId,
        buildingBlockEntry: Boolean,
        /** Whose processes may be taken over. Only an `add` entry parts the two: an owner is hijacked as its instances still have it, while [source] stays the version that declares the block. */
        running: BlueprintId = source,
    ): Any? {
        val sourceProcessDefinitions = resolveProcessDefinitions(running) ?: return null
        val targetProcessDefinitions = resolveProcessDefinitions(target)?.map { (key, definitionId) ->
            ProcessDefinitionRef(key, processActivityMapper.processDefinitionName(definitionId) ?: key, definitionId)
        } ?: return null
        if (targetProcessDefinitions.isEmpty()) {
            return null
        }

        val sameBlueprint = isSameBlueprint(source, target)
        if (buildingBlockEntry && adoptionAccountsFor(source, target, targetProcessDefinitions)) {
            logger.info {
                "'$target' is a building block '$source' declares on a call activity, so `addBuildingBlock` " +
                    "adopts the running sub-process the link already names and no 'processMigration' is " +
                    "suggested for the entry. An author who means a *hijack* — a process the owner runs " +
                    "outside that link — adds the instruction by hand; that case cannot be told apart from " +
                    "the outside."
            }
            return null
        }

        val targetsByKey = targetProcessDefinitions.associateBy { it.key }
        // Resolved once per suggestion rather than per source process: it walks the whole link graph.
        val relocated = if (sameBlueprint) processesReachableFrom(target) else emptySet()
        val entryPairs = if (buildingBlockEntry) {
            pairForEntry(sourceProcessDefinitions, targetProcessDefinitions, targetsByKey, running, target)
        } else {
            emptyMap()
        }

        // Sorted, so the same two versions always suggest the same plan whatever order the resolver answered in.
        val instructions = sourceProcessDefinitions.entries
            .sortedBy { it.key }
            .mapNotNull { (sourceKey, sourceDefinitionId) ->
                val sourceName = processActivityMapper.processDefinitionName(sourceDefinitionId) ?: sourceKey

                val counterpart = if (buildingBlockEntry) {
                    entryPairs[sourceKey] ?: return@mapNotNull unpairedEntryProcess(sourceKey, running, target)
                } else if (sameBlueprint) {
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

    /** A source the target does not own: nothing when a block the target reaches owns it, otherwise a blank-target row for the author. The closest candidate is logged either way. */
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

    /** A blank-target row when the entry dissolves the blueprint owning the process — the executor refuses to dissolve a block whose process was not handed back — and nothing otherwise. */
    private fun unpairedEntryProcess(
        sourceKey: String,
        source: BlueprintId,
        target: BlueprintId,
    ): UnmappedProcess? {
        if (source.blueprintType() != BlueprintType.BUILDING_BLOCK) {
            return null
        }
        logger.info {
            "No process of '$target' could be paired with '$sourceKey' of '$source', which this entry " +
                "dissolves, so it is suggested with no target. A building block whose process is not " +
                "handed back cannot be dissolved, so this is work the plan needs rather than a blank to " +
                "leave: name the owner process it should be migrated onto, or drop the entry."
        }
        return UnmappedProcess(sourceProcessDefinitionKey = sourceKey)
    }

    /** Pairs an entry's processes only on an exact key match or a forced 1-to-1 choice; a hijack takes over one process, so nearest match is not a rough edge here but the whole error. */
    private fun pairForEntry(
        sources: Map<String, String>,
        targets: List<ProcessDefinitionRef>,
        targetsByKey: Map<String, ProcessDefinitionRef>,
        source: BlueprintId,
        target: BlueprintId,
    ): Map<String, ProcessDefinitionRef> {
        val byKey = sources.keys.mapNotNull { sourceKey -> targetsByKey[sourceKey]?.let { sourceKey to it } }
        if (byKey.isNotEmpty()) {
            return byKey.toMap()
        }
        if (sources.size == 1 && targets.size == 1) {
            return mapOf(sources.keys.single() to targets.single())
        }

        sources.forEach { (sourceKey, sourceDefinitionId) ->
            val sourceName = processActivityMapper.processDefinitionName(sourceDefinitionId) ?: sourceKey
            val nearest = bestMatchFor(sourceKey, sourceName, targets)
                ?.let { (best, score) -> "the closest is '${best.key}' at ${percentage(score)} similarity" }
                ?: "it owns no processes at all"
            logger.info {
                "No process of '$target' has the key '$sourceKey', and '$source' has ${sources.size} " +
                    "process(es) against ${targets.size} on the other side, so which one this entry takes " +
                    "over cannot be worked out and no instruction is suggested for it ($nearest). Name the " +
                    "pair by hand if this process is the one the entry hijacks; left as it is, instances " +
                    "running it stay where they are."
            }
        }
        return emptyMap()
    }

    /** Whether [target] is a block [owner] already reaches by call activity, so adoption gives it its process and the honest suggestion is none. Only asked where the target is the block. */
    private fun adoptionAccountsFor(
        owner: BlueprintId,
        target: BlueprintId,
        targets: List<ProcessDefinitionRef>,
    ): Boolean {
        if (target.blueprintType() != BlueprintType.BUILDING_BLOCK) {
            return false
        }
        val adopted = processesReachableFrom(owner)
        return adopted.isNotEmpty() && targets.all { it.key in adopted }
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
