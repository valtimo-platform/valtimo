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

/** What is wrong with a `dataMigration` patch, read off the raw JSON. Shared, because a building-block entry carries its own copies of this section and they reach no other validator. */
object DataMigrationPatchChecker {

    /** Every problem in [component]'s patches, already phrased. [knownPrefixes] is what the deployment's value resolvers answer to. */
    fun findProblems(component: JsonNode?, knownPrefixes: Collection<String>): List<String> =
        component
            ?.filter { it.isObject }
            ?.flatMap { patch ->
                val target = patch.get("target")?.takeIf { it.isTextual }?.asText().orEmpty()
                listOfNotNull(
                    describeUnresolvableTarget(target, knownPrefixes),
                    describeSourceAndValue(patch, target),
                )
            }
            .orEmpty()

    /** An unknown prefix saves and then fails every case at run, with a message about resolver factories rather than about the plan. */
    private fun describeUnresolvableTarget(target: String, knownPrefixes: Collection<String>): String? {
        if (target.isBlank()) {
            return "a patch names no 'target', so there is nothing for it to write to."
        }
        val prefix = target.substringBefore(':', missingDelimiterValue = "")
        if (prefix.isNotBlank() && knownPrefixes.contains(prefix)) {
            return null
        }
        val known = knownPrefixes.distinct().sorted().joinToString { "'$it:'" }
        return if (prefix.isBlank()) {
            "the patch for '$target' has no value-resolver prefix, so nothing can be written to it. " +
                "Known prefixes are $known."
        } else {
            "the patch for '$target' targets '$prefix:', which no value resolver handles, so it would " +
                "fail every case. Known prefixes are $known."
        }
    }

    /** Both set is an authoring mistake with a silent winner: the executor prefers `source` and drops `value` without a word. */
    private fun describeSourceAndValue(patch: JsonNode, target: String): String? {
        val hasSource = patch.get("source")?.takeUnless { it.isNull }?.asText()?.isNotBlank() == true
        val hasValue = patch.get("value")?.takeUnless { it.isNull } != null
        return if (hasSource && hasValue) {
            "the patch for '$target' sets both 'source' and 'value'. A patch either copies from a path " +
                "or writes a literal; keep the one that was meant."
        } else {
            null
        }
    }
}
