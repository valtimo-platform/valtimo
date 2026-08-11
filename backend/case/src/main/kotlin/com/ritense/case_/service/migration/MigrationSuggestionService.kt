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
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentSuggester
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentValidator
import org.semver4j.Semver

/**
 * Best-effort migration suggestions for the admin UI: a whole pre-filled plan for a new plan
 * ([suggestPlan]), and an on-the-fly activity mapping for a source/target process pair
 * ([suggestActivityMapping], used while the user edits the `processMigration` component).
 */
class MigrationSuggestionService(
    private val objectMapper: ObjectMapper,
    private val versionLineages: List<BlueprintVersionLineage>,
    private val componentSuggesters: List<MigrationComponentSuggester>,
    private val activityMappingSuggesters: List<ActivityMappingSuggester>,
    private val activityMappingValidators: List<ActivityMappingValidator>,
    private val componentValidators: List<MigrationComponentValidator>,
) {

    /**
     * A best-effort, pre-filled plan for a [target] blueprint version, migrating instances from
     * [source]. When [source] is null it defaults to the target's predecessor (`basedOnVersionTag`,
     * under the target's own key), which is the source an author wants most of the time; when there is
     * no predecessor either, only the skeleton is returned and the author has to name a source.
     *
     * The suggested `source` is written into the plan, because a plan's source is required and is never
     * re-derived once saved. Each [MigrationComponentSuggester] then fills its own component by
     * comparing that source with the target.
     */
    fun suggestPlan(target: BlueprintId, source: BlueprintId? = null): ObjectNode {
        val resolvedSource = source ?: predecessorOf(target)

        val plan = objectMapper.createObjectNode()

        resolvedSource?.let {
            plan.putObject("source")
                .put("key", it.getIdKey())
                .put("versionTag", it.blueprintVersionTag().toString())
        }
        // A building block plan carries neither: it runs when a case migration brings its building
        // block onto this version, so [MigrationPlanImporter] refuses both outright. Suggesting them
        // would hand the author a plan that cannot be saved.
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
                suggester.suggest(resolvedSource, target)?.let { suggestion ->
                    plan.set<ObjectNode>(suggester.componentKey(), objectMapper.valueToTree(suggestion))
                }
            }
        }

        return plan
    }

    /**
     * Descriptions of everything in [plan] that would stop it migrating instances from the source it
     * declares onto [target] — the source itself being unusable, plus whatever every
     * [MigrationComponentValidator] objects to. Empty when the plan is valid. Lets the management API
     * reject an invalid plan on save instead of only failing when the migration runs.
     *
     * The source is read from the plan, and its existence is checked *here* rather than in
     * [MigrationPlanImporter]: on this path every definition is already deployed, whereas file
     * auto-deploy visits definition folders in no guaranteed order and would reject a perfectly good
     * plan for arriving before the version it migrates from.
     */
    fun findPlanProblems(target: BlueprintId, plan: JsonNode): List<String> {
        val source = declaredSourceOf(target, plan)
            ?: return listOf(
                "the plan declares no valid 'source' (the blueprint version it migrates instances from)"
            )
        if (lineageOf(target)?.exists(source) == false) {
            return listOf("its source '$source' is not deployed, so the plan would migrate no instances")
        }
        return componentValidators.flatMap { validator ->
            plan.get(validator.componentKey())
                ?.takeUnless { it.isNull }
                ?.let { component -> validator.validate(source, target, component) }
                ?: emptyList()
        }
    }

    /**
     * The blueprint version [plan] declares as its source, or null when it declares none or an
     * unparseable one. The key defaults to [target]'s, mirroring [MigrationPlanImporter].
     */
    private fun declaredSourceOf(target: BlueprintId, plan: JsonNode): BlueprintId? {
        val source = plan.get("source")?.takeUnless { it.isNull } ?: return null
        val versionTag = source.get("versionTag")?.asText()?.takeUnless { it.isBlank() } ?: return null
        val version = Semver.parse(versionTag) ?: return null
        val key = source.get("key")?.asText()?.takeUnless { it.isBlank() } ?: target.getIdKey()
        return BlueprintMigrationId.blueprintIdOf(target.blueprintType(), key, version)
    }

    /** The predecessor blueprint of [target] (its `basedOnVersionTag`), or null when there is none. */
    private fun predecessorOf(target: BlueprintId): BlueprintId? =
        lineageOf(target)
            ?.basedOnVersionTag(target)
            ?.let { BlueprintMigrationId.blueprintIdOf(target.blueprintType(), target.getIdKey(), it) }

    private fun lineageOf(target: BlueprintId): BlueprintVersionLineage? =
        versionLineages.firstOrNull { it.supports(target.blueprintType()) }

    /**
     * A best-effort `sourceActivityId -> targetActivityId` mapping between two process definitions,
     * delegating to the first [ActivityMappingSuggester] that can produce one (empty when none can).
     */
    fun suggestActivityMapping(
        sourceProcessDefinitionId: String,
        targetProcessDefinitionId: String,
    ): Map<String, String> =
        activityMappingSuggesters.asSequence()
            .map { it.suggestActivityMapping(sourceProcessDefinitionId, targetProcessDefinitionId) }
            .firstOrNull { it.isNotEmpty() } ?: emptyMap()

    /**
     * The subset of [activityMapping] the engine rejects as incompatible for migrating
     * [sourceProcessDefinitionId] to [targetProcessDefinitionId], keyed by source activity id with the
     * engine's failure messages (empty when every mapping is valid). Lets the UI block incompatible
     * pairs and the API reject them, both using the engine as the single source of truth.
     */
    fun findInvalidActivityMappings(
        sourceProcessDefinitionId: String,
        targetProcessDefinitionId: String,
        activityMapping: Map<String, String>,
    ): Map<String, List<String>> =
        activityMappingValidators.firstOrNull()
            ?.findInvalidActivityMappings(sourceProcessDefinitionId, targetProcessDefinitionId, activityMapping)
            ?: emptyMap()

    /**
     * A best-effort `{ dataMigration, processMigration }` for one building-block entry, moving data
     * and process from [source] to [target] (add: owner → building block; remove: the reverse). The
     * owner is a case definition version or, for a nested block, a building block definition version.
     * Reuses the `dataMigration` / `processMigration` component suggesters; only copy patches are kept
     * (a `value: null` removal clears fields on a verbatim copy, which does not apply across documents).
     */
    fun suggestBuildingBlockEntry(source: BlueprintId, target: BlueprintId): ObjectNode {
        val node = objectMapper.createObjectNode()
        node.set<JsonNode>("dataMigration", copyPatches(suggestComponent(DATA_MIGRATION, source, target)))
        node.set<JsonNode>(
            "processMigration",
            objectMapper.valueToTree(suggestComponent(PROCESS_MIGRATION, source, target) ?: emptyList<Any>())
        )
        return node
    }

    private fun suggestComponent(componentKey: String, source: BlueprintId, target: BlueprintId): Any? =
        componentSuggesters.firstOrNull { it.componentKey() == componentKey }?.suggest(source, target)

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
    }
}
