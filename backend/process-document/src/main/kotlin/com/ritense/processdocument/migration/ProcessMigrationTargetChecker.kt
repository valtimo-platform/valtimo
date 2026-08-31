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

/** Finds `processMigration` instructions naming no target, on the raw JSON before deserialization — a null target fails Jackson and answers 500 for the likeliest hand-edit mistake (G47). Blank counts as none. */
object ProcessMigrationTargetChecker {

    const val SOURCE_KEY = "sourceProcessDefinitionKey"
    const val TARGET_KEY = "targetProcessDefinitionKey"

    /** The `sourceProcessDefinitionKey` of every instruction in [component] that names no target; `?` for one that names neither. */
    fun sourcesWithoutTarget(component: JsonNode?): List<String> =
        component
            ?.filter { instruction -> instruction.isObject && !instruction.namesATarget() }
            ?.map { instruction -> instruction.get(SOURCE_KEY)?.takeIf { it.isTextual }?.asText() ?: "?" }
            .orEmpty()

    /** Why a missing target stops the save, said in both directions — deleting the row is the correct way to say "not decided yet". */
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
