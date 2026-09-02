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

package com.ritense.case_.service.migration

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.case_.domain.migration.MigrationTriggers
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.ActivityMappingSuggester
import com.ritense.valtimo.contract.blueprint.migration.ActivityMappingValidator
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintVersionLineage
import com.ritense.valtimo.contract.blueprint.migration.BuildingBlockEntryOwnership
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentSuggester
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentValidator
import com.ritense.valtimo.contract.blueprint.migration.MigrationRunCache
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.semver4j.Semver
import io.github.oshai.kotlinlogging.KotlinLogging

/** Best-effort suggestions for the admin UI: a whole pre-filled plan, and an on-the-fly activity mapping for a process pair. */
class MigrationSuggestionService(
    private val objectMapper: ObjectMapper,
    private val versionLineages: List<BlueprintVersionLineage>,
    private val componentSuggesters: List<MigrationComponentSuggester>,
    private val activityMappingSuggesters: List<ActivityMappingSuggester>,
    private val activityMappingValidators: List<ActivityMappingValidator>,
    private val componentValidators: List<MigrationComponentValidator>,
    private val buildingBlockEntryOwnerships: List<BuildingBlockEntryOwnership> = emptyList(),
) {

    /** A pre-filled plan for [target], migrating from [source] or, failing that, the target's predecessor. Scoped by [MigrationRunCache.inRun] — the suggesters re-ask the same tree walks per entry. */
    fun suggestPlan(target: BlueprintId, source: BlueprintId? = null): ObjectNode = MigrationRunCache.inRun {
        val resolvedSource = source ?: predecessorOf(target)

        val plan = objectMapper.createObjectNode()

        resolvedSource?.let {
            plan.putObject("source")
                .put("key", it.getIdKey())
                .put("versionTag", it.blueprintVersionTag().toString())
        }
        // A building block plan carries neither; the importer refuses both, so suggesting them would hand the author an unsaveable plan.
        if (target.blueprintType() != BlueprintType.BUILDING_BLOCK) {
            plan.set<ObjectNode>(
                "migrationTriggers",
                objectMapper.valueToTree(MigrationTriggers(triggeredByButton = true))
            )
            plan.set<ObjectNode>("conditions", objectMapper.createArrayNode())
        }

        // Component suggestions only make sense once there is a source to migrate from.
        if (resolvedSource != null) {
            componentSuggesters.forEach { suggester ->
                // Isolated per component: a suggestion is advisory, and one faulty schema used to cost the whole pre-filled plan and answer 500.
                runCatching { suggester.suggest(resolvedSource, target) }
                    .onFailure { e ->
                        logger.warn(e) {
                            "Suggesting '${suggester.componentKey()}' for '$target' failed; the rest of the " +
                                "plan is still suggested and that component is left out. This usually means " +
                                "configuration the suggester had to read is broken, not the plan."
                        }
                    }
                    .getOrNull()
                    ?.let { suggestion ->
                        plan.set<ObjectNode>(suggester.componentKey(), objectMapper.valueToTree(suggestion))
                    }
            }
        }

        plan
    }

    /** Everything that would stop [plan] migrating onto [target], so the management API can reject it on save. The source is checked here rather than in the importer, where deploy order is not guaranteed. */
    fun findPlanProblems(target: BlueprintId, plan: JsonNode): List<String> = MigrationRunCache.inRun {
        val source = declaredSourceOf(target, plan)
            ?: return@inRun listOf(
                "the plan declares no valid 'source' (the blueprint version it migrates instances from)"
            )
        if (lineageOf(target)?.exists(source) == false) {
            return@inRun listOf("its source '$source' is not deployed, so the plan would migrate no instances")
        }
        componentValidators.flatMap { validator ->
            plan.get(validator.componentKey())
                ?.takeUnless { it.isNull }
                ?.let { component -> validator.validate(source, target, component) }
                ?: emptyList()
        }
    }

    /** The blueprint version [plan] declares as its source, or null when it declares none or an unparseable one. */
    private fun declaredSourceOf(target: BlueprintId, plan: JsonNode): BlueprintId? {
        val source = plan.get("source")?.takeUnless { it.isNull } ?: return null
        val versionTag = source.get("versionTag")?.asText()?.takeUnless { it.isBlank() } ?: return null
        val version = Semver.parse(versionTag) ?: return null
        val key = source.get("key")?.asText()?.takeUnless { it.isBlank() } ?: target.getIdKey()
        return BlueprintMigrationId.blueprintIdOf(target.blueprintType(), key, version)
    }

    /** The version a new plan most likely migrates from: [target]'s recorded predecessor, else the newest deployed version below it by Semver — file-deployed and `-migrated` versions record none. */
    private fun predecessorOf(target: BlueprintId): BlueprintId? {
        val lineage = lineageOf(target) ?: return null
        val versionTag = lineage.basedOnVersionTag(target)
            ?: lineage.deployedVersionTags(target)
                .filter { it.isLowerThan(target.blueprintVersionTag()) }
                .maxOrNull()
            ?: return null
        return BlueprintMigrationId.blueprintIdOf(target.blueprintType(), target.getIdKey(), versionTag)
    }

    private fun lineageOf(target: BlueprintId): BlueprintVersionLineage? =
        versionLineages.firstOrNull { it.supports(target.blueprintType()) }

    /** A best-effort activity mapping, from the first [ActivityMappingSuggester] that can produce one. */
    fun suggestActivityMapping(
        sourceProcessDefinitionId: String,
        targetProcessDefinitionId: String,
    ): Map<String, String> =
        activityMappingSuggesters.asSequence()
            .map { it.suggestActivityMapping(sourceProcessDefinitionId, targetProcessDefinitionId) }
            .firstOrNull { it.isNotEmpty() } ?: emptyMap()

    /** The subset of [activityMapping] the engine rejects, with its failure messages — the engine as the single source of truth for both the UI and the API. */
    fun findInvalidActivityMappings(
        sourceProcessDefinitionId: String,
        targetProcessDefinitionId: String,
        activityMapping: Map<String, String>,
    ): Map<String, List<String>> =
        activityMappingValidators.firstOrNull()
            ?.findInvalidActivityMappings(sourceProcessDefinitionId, targetProcessDefinitionId, activityMapping)
            ?: emptyMap()

    /** A best-effort `{ dataMigration, processMigration }` for one building-block entry. Only copy patches are kept — a clearing patch does not apply across documents. [running] is [source] as the instances still have it; the components stage differently, so only `processMigration` reads it. */
    fun suggestBuildingBlockEntry(
        source: BlueprintId,
        target: BlueprintId,
        running: BlueprintId = source,
    ): ObjectNode = MigrationRunCache.inRun {
        val node = objectMapper.createObjectNode()
        node.set<JsonNode>("dataMigration", copyPatches(suggestEntryComponent(DATA_MIGRATION, source, target, source)))
        node.set<JsonNode>(
            "processMigration",
            objectMapper.valueToTree(
                suggestEntryComponent(PROCESS_MIGRATION, source, target, running) ?: emptyList<Any>()
            )
        )
        node
    }

    /** The blueprint an entry for [block] exchanges state with — the parent block when nested, [migratingOwner] otherwise. */
    fun entryOwnerOf(migratingOwner: BlueprintId, block: BuildingBlockDefinitionId): BlueprintId =
        buildingBlockEntryOwnerships
            .firstOrNull { it.supports(migratingOwner.blueprintType()) }
            ?.entryOwnerOf(migratingOwner, block)
            ?: migratingOwner

    /**
     * [owner] as the instances this plan migrates still have it. An `add` entry reads its owner off [migrating], the
     * version they have not reached yet: the blueprint itself is then simply [source], and a parent block is whichever
     * version [source]'s own tree declares. [owner] when the plan declares no source to read.
     */
    fun runningOwnerOf(owner: BlueprintId, migrating: BlueprintId, source: BlueprintId?): BlueprintId = when {
        source == null -> owner
        owner == migrating -> source
        else -> buildingBlockEntryOwnerships
            .firstOrNull { it.supports(source.blueprintType()) }
            ?.ownerAsDeclaredIn(source, owner)
            ?: owner
    }

    /** [entryOwnerOf] as the editor reads it: the type tells it which pickers to build. */
    fun describeEntryOwner(owner: BlueprintId): ObjectNode = objectMapper.createObjectNode()
        .put("type", owner.blueprintType().name)
        .put("key", owner.getIdKey())
        .put("versionTag", owner.blueprintVersionTag().toString())

    /** The same component asked for as an entry rather than a plan — the distinction cannot be derived from the two blueprint ids. */
    private fun suggestEntryComponent(
        componentKey: String,
        source: BlueprintId,
        target: BlueprintId,
        running: BlueprintId,
    ): Any? =
        componentSuggesters.firstOrNull { it.componentKey() == componentKey }
            ?.suggestForBuildingBlockEntry(source, target, running)

    /** Keep only the copy patches (those with a non-null `source`) from a data-migration suggestion. */
    private fun copyPatches(suggestion: Any?): ArrayNode {
        val result = objectMapper.createArrayNode()
        val tree = objectMapper.valueToTree<JsonNode>(suggestion ?: emptyList<Any>())
        if (tree is ArrayNode) tree.forEach { patch -> if (patch.hasNonNull("source")) result.add(patch) }
        return result
    }

    private companion object {
        // The plan component keys these suggestions fill (match the corresponding componentKey()s).
        const val DATA_MIGRATION = "dataMigration"
        const val PROCESS_MIGRATION = "processMigration"
        val logger = KotlinLogging.logger {}
    }
}
