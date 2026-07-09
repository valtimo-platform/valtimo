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

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.case_.domain.migration.MigrationTriggers
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationCandidateProvider
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentSuggester

/**
 * Builds a best-effort, pre-filled migration plan for a [target] blueprint version, so the UI can
 * show a sensible starting point when a user adds a new plan.
 *
 * The [target] is the version the plan is created under; the source defaults to the target's
 * `basedOnVersionTag` (its predecessor). When there is no predecessor only the skeleton (title, key,
 * target, default trigger) is returned. Each registered [MigrationComponentSuggester] contributes
 * its own component (`dataMigration`, `processMigration`, ...).
 */
class MigrationPlanSuggestionService(
    private val objectMapper: ObjectMapper,
    private val candidateProviders: List<MigrationCandidateProvider>,
    private val componentSuggesters: List<MigrationComponentSuggester>,
) {

    fun suggestPlan(target: BlueprintId): ObjectNode {
        val sourceVersionTag = candidateProviders
            .firstOrNull { it.supports(target.blueprintType()) }
            ?.basedOnVersionTag(target)
        val source = sourceVersionTag?.let {
            BlueprintMigrationId.blueprintIdOf(target.blueprintType(), target.getIdKey(), it)
        }

        val plan = objectMapper.createObjectNode()

        source?.let {
            plan.put("sourceBlueprintType", it.blueprintType().name)
            plan.put("sourceKey", it.getIdKey())
            plan.put("sourceVersionTag", it.blueprintVersionTag().toString())
        }

        plan.put("targetBlueprintType", target.blueprintType().name)
        plan.put("targetKey", target.getIdKey())
        plan.put("targetVersionTag", target.blueprintVersionTag().toString())

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
}
