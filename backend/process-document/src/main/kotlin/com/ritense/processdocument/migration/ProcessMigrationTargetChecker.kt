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

import com.fasterxml.jackson.databind.JsonNode

/**
 * Finds `processMigration` instructions that name no target, on the **raw** JSON and before anything is
 * deserialized.
 *
 * That order is the whole point (G47). [ProcessMigrationInstruction.targetProcessDefinitionKey] is a
 * non-nullable Kotlin `String`, so a plan carrying `"targetProcessDefinitionKey": null` fails Jackson
 * instantiation and the save answers **HTTP 500** — an internal error for the single most likely mistake in
 * a hand-edited plan: an author who knows a process has to move but not yet where to.
 *
 * Shared because a `processMigration` appears in three places and only one of them was covered.
 * `MigrationSuggestionService.findPlanProblems` dispatches validators on **top-level** component keys, so
 * the copies nested inside an `addBuildingBlock` / `removeBuildingBlock` entry never reach
 * [ProcessMigrationComponentValidator] and kept the 500 after it was fixed for the top level.
 *
 * A **blank** target counts as no target, not only an absent or null one. `""` is never a valid process
 * definition key, and it is what the plan editor's empty select writes, so left to the checks downstream it
 * is reported as `'' is not a process of …` — a sentence about a key the author never typed.
 */
object ProcessMigrationTargetChecker {

    const val SOURCE_KEY = "sourceProcessDefinitionKey"
    const val TARGET_KEY = "targetProcessDefinitionKey"

    /**
     * The `sourceProcessDefinitionKey` of every instruction in [component] that names no target, in order;
     * empty when they all do. `?` stands in for an instruction that names neither.
     */
    fun sourcesWithoutTarget(component: JsonNode?): List<String> =
        component
            ?.filter { instruction -> instruction.isObject && !instruction.namesATarget() }
            ?.map { instruction -> instruction.get(SOURCE_KEY)?.takeIf { it.isTextual }?.asText() ?: "?" }
            .orEmpty()

    /**
     * Why a missing target stops the save. Says what to do about it in both directions — name a target, or
     * remove the instruction — because "I have not decided yet" is a legitimate state to be in and deleting
     * the row is the correct way to say so: the engine has nothing to migrate onto, and a stored plan
     * carrying one would silently skip that process for every case.
     */
    fun describe(sourceKey: String, availableTargets: Collection<String> = emptyList()): String {
        val available = availableTargets
            .takeIf { it.isNotEmpty() }
            ?.let { " Available: ${it.sorted().joinToString { target -> "'$target'" }}." }
            .orEmpty()
        return "the instruction for '$sourceKey' names no '$TARGET_KEY', so there is nothing to migrate it " +
            "onto. Every process this plan migrates has to name the process it migrates to; remove the " +
            "instruction to leave instances of '$sourceKey' where they are.$available"
    }

    private fun JsonNode.namesATarget(): Boolean =
        get(TARGET_KEY)?.takeIf { it.isTextual }?.asText()?.isNotBlank() == true
}
