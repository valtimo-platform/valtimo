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

/** Refuses a `setProcessVariables` target that is not a process variable. Read off the raw JSON so the nested copies inside a building-block entry are checked by the same rule as the top-level section — `doc:` is the one that matters, because it succeeds, writing into the case document from a control labelled "target variable", and says nothing. */
object ProcessVariableTargetChecker {

    const val PROCESS_VARIABLE_PREFIX = "pv"

    /** Every `setProcessVariables` target in [component] that no `pv:` prefix covers, already phrased. */
    fun findNonProcessVariableTargets(component: JsonNode?): List<String> =
        component
            ?.filter { it.isObject }
            ?.flatMap { instruction ->
                val sourceKey = instruction.get(ProcessMigrationTargetChecker.SOURCE_KEY)
                    ?.takeIf { it.isTextual }?.asText() ?: "?"
                instruction.get("setProcessVariables")
                    ?.filter { it.isObject }
                    ?.mapNotNull { patch ->
                        patch.get("target")?.takeIf { it.isTextual }?.asText()
                            ?.let { describeIfNotProcessVariable(it, sourceKey) }
                    }
                    .orEmpty()
            }
            .orEmpty()

    private fun describeIfNotProcessVariable(target: String, sourceProcessKey: String): String? {
        if (target.startsWith("$PROCESS_VARIABLE_PREFIX:")) return null
        val what = if (target.contains(':')) {
            "targets '${target.substringBefore(':')}:'"
        } else {
            "has no value-resolver prefix"
        }
        return "'$sourceProcessKey' sets process variable '$target', which $what. A 'setProcessVariables' " +
            "target must start with '$PROCESS_VARIABLE_PREFIX:' — it sets a variable on the migrated " +
            "process, and nothing else."
    }
}
