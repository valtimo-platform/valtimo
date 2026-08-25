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
 *   declared that pairing by writing the entry, and there is no better signal to go on. Except where
 *   the answer is already known — see [adoptionAccountsFor].
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

    /** A plan migrating instances between two blueprint versions — the ordinary case. */
    override fun suggest(source: BlueprintId, target: BlueprintId): Any? =
        suggest(source, target, buildingBlockEntry = false)

    /**
     * The `processMigration` of an `addBuildingBlock` / `removeBuildingBlock` **entry** — a *hijack*: a
     * process one side is running, taken over by a process on the other. Nothing is suggested for a block
     * adoption already accounts for ([adoptionAccountsFor]), and what is left is paired strictly rather
     * than by nearest match ([pairForEntry]).
     *
     * **Told, not inferred**, for the same reason as
     * `DataMigrationComponentSuggester.suggestForBuildingBlockEntry`: a nested entry and a cross-key
     * building-block *plan* are both `block -> block`, and only the caller knows which it is asking for.
     * Inferring it from the ids would put a plan migrating a block onto its successor — an ordinary
     * migration, where nearest match is the right and only rule — through the entry rules instead.
     */
    override fun suggestForBuildingBlockEntry(source: BlueprintId, target: BlueprintId): Any? =
        suggest(source, target, buildingBlockEntry = true)

    private fun suggest(source: BlueprintId, target: BlueprintId, buildingBlockEntry: Boolean): Any? {
        val sourceProcessDefinitions = resolveProcessDefinitions(source) ?: return null
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
            pairForEntry(sourceProcessDefinitions, targetProcessDefinitions, targetsByKey, source, target)
        } else {
            emptyMap()
        }

        // Sorted, so the same two versions always suggest the same plan whatever order the resolver
        // happened to answer in, and a 16-instruction component stays reviewable.
        val instructions = sourceProcessDefinitions.entries
            .sortedBy { it.key }
            .mapNotNull { (sourceKey, sourceDefinitionId) ->
                val sourceName = processActivityMapper.processDefinitionName(sourceDefinitionId) ?: sourceKey

                val counterpart = if (buildingBlockEntry) {
                    entryPairs[sourceKey] ?: return@mapNotNull null
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

    /**
     * `sourceKey -> counterpart` for a building-block entry, pairing only where something says so. Empty
     * where nothing does, which is the answer an entry with no hijack should give.
     *
     * A hijack takes over **one** running process, so the fan-out nearest match produces is not a rough
     * edge here — it is the whole error. Measured on the customer configuration: dissolving
     * `uitvoeren-business-services` out of `aanvraag-ioaw-uitkering-dcm:1.0.0` suggested **44 instructions
     * onto 11 distinct targets**, 18 of the block's processes all aimed at
     * `ioaw-start-behandeling-gehele-aanvraag-opnieuw`, every one of which passes validation because both
     * keys resolve. That is the same class of guess G46 deleted *within* a blueprint after eight pairings
     * scored 0.70–0.80 and failed 14 of 20 cases with `ENGINE-23004`; across blueprints the argument for
     * keeping it was that the author declared the pairing by writing the entry, which is true of a 1→1
     * entry and says nothing about which of 13 owner processes a block takes over.
     *
     * So two rules, and no third:
     *
     * 1. **An exact key match.** A process relocated into a block keeps its key, which is the one signal
     *    that means something rather than resembling something.
     * 2. **A forced choice** — exactly one process on each side. Then there is nothing to guess: this is
     *    the 1→1 shape the entry endpoint was written for and the only one its tests ever covered.
     *
     * Anything else is left out and logged with the closest candidate and its score, so an author can add
     * by hand what the suggester would not invent — G46's rule, that refusing to guess is no use to an
     * author who cannot see what was refused.
     *
     * Note this cannot suggest two sources onto one target, which the executor does allow: `hijack` keeps
     * only the instructions whose source has a *running* process, so "whichever of these is running gets
     * taken over" is a legitimate hand-written pattern. It is legitimate and unguessable, which is why it
     * is left to the author rather than refused on save.
     */
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

    /**
     * Whether [target] is a building block [owner] already reaches through its **call-activity** links, so
     * an `addBuildingBlock` entry for it needs no `processMigration` at all and the honest suggestion is
     * none.
     *
     * A block gets its process by one of two mechanisms, and only one of them is written in the plan:
     *
     * - **adoption** — the owner's BPMN declares the block on a call activity, so the sub-process is
     *   *already running* and `AddBuildingBlockMigrationComponentExecutor` walks the running tree and gives
     *   it the block's identity. The link says which process; the entry does not have to.
     * - **hijack** — nothing declares it, so a process the owner runs has to be taken over, which is what
     *   the entry's `processMigration` is for.
     *
     * The executor decides between them on the **links**, never on what the plan names: a process started
     * by a call activity, for a block the target declares, is filtered out of the hijack
     * (`ownedByTheWalk`), because an entry naming a process key only to carry `mapActivities` for an
     * adopted node would flatten the block it was trying to configure. So a suggestion for an adopted block
     * is not merely a bad guess — most of it is discarded at execution, and the part that is not is worse
     * than the part that is: the owner's **top-level** process has no calling execution and so survives the
     * filter, which means an accepted suggestion hands the case's main process to a building block.
     *
     * Without this, the two suggesters contradicted each other on the same entry. The whole-plan
     * `AddBuildingBlockMigrationComponentSuggester` collects blocks from exactly this call-activity closure
     * and deliberately writes **no** `processMigration`; the per-entry endpoint behind the editor's
     * building-block tab (`MigrationSuggestionService.suggestBuildingBlockEntry`) came through here and got
     * one instruction per *owner* process, all pointing at the block's nearest process — on a case linking
     * 13 processes and a block deploying 1, thirteen rows with the same target, every one of which passes
     * validation. Suggest the plan and the entry is empty; add the same entry by hand and it is thirteen
     * hijacks.
     *
     * Note this does **not** mean a renamed process or activity needs no instruction. Adoption resolves the
     * link from the *running* caller at execution time, so it depends on the plan's **top-level**
     * `processMigration` having carried that caller onto the target definition and mapped the call
     * activity's id; left out, the child is walked past as a plain sub-process (G23). That instruction
     * belongs to the plan, not to this entry, which is why suggesting one here would not have fixed it.
     *
     * Read through the [BlueprintProcessOwnership] hook already used for `relocated`, whose implementation
     * is the same call-activity closure the executor authorises from — so this cannot suppress a suggestion
     * for a block adoption would not in fact reach.
     *
     * Only asked on the entry path, and only where the **target** is the block: that is the `add`
     * direction, where adoption is what would create it. Dissolving a block hands its process back to the
     * owner, which no link does for you, so `remove` goes on to [pairForEntry] like any other hijack.
     */
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
