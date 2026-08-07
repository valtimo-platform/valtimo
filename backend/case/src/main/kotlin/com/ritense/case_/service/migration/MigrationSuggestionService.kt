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
import com.ritense.valtimo.contract.blueprint.migration.ActivityMappingSuggester
import com.ritense.valtimo.contract.blueprint.migration.ActivityMappingValidator
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintVersionLineage
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentSuggester
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentValidator

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
     * A best-effort, pre-filled plan for a [target] blueprint version. The source defaults to the
     * target's `basedOnVersionTag` (its predecessor); when there is no predecessor only the skeleton
     * (triggers, empty conditions) is returned. Each [MigrationComponentSuggester] fills its component.
     */
    fun suggestPlan(target: BlueprintId): ObjectNode {
        val source = resolveSource(target)

        val plan = objectMapper.createObjectNode()

        // Source/target are not part of the plan format (they always resolve from the plan's own
        // definition version); [source] is only used to drive the component suggesters below.
        plan.set<ObjectNode>(
            "migrationTriggers",
            objectMapper.valueToTree(MigrationTriggers(triggeredByButton = true))
        )
        plan.set<ObjectNode>("conditions", objectMapper.createArrayNode())

        // Component suggestions only make sense when there is a predecessor to migrate from.
        if (source != null) {
            componentSuggesters.forEach { suggester ->
                suggester.suggest(source, target)?.let { suggestion ->
                    plan.set<ObjectNode>(suggester.componentKey(), objectMapper.valueToTree(suggestion))
                }
            }
        }

        return plan
    }

    /**
     * Descriptions of everything in [plan] that would make it invalid to migrate a [target]
     * blueprint's instances from their predecessor, aggregated across every [MigrationComponentValidator]
     * (empty when the plan is valid, or when [target] has no predecessor to migrate from). Lets the
     * management API reject an invalid plan on save instead of only failing when the migration runs.
     */
    fun findPlanProblems(target: BlueprintId, plan: JsonNode): List<String> {
        val source = resolveSource(target) ?: return emptyList()
        return componentValidators.flatMap { validator ->
            plan.get(validator.componentKey())
                ?.takeUnless { it.isNull }
                ?.let { component -> validator.validate(source, target, component) }
                ?: emptyList()
        }
    }

    /** The predecessor blueprint of [target] (its `basedOnVersionTag`), or null when there is none. */
    private fun resolveSource(target: BlueprintId): BlueprintId? =
        versionLineages
            .firstOrNull { it.supports(target.blueprintType()) }
            ?.basedOnVersionTag(target)
            ?.let { BlueprintMigrationId.blueprintIdOf(target.blueprintType(), target.getIdKey(), it) }

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
     * and process from [source] to [target] (add: owner case → building block; remove: the reverse).
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
