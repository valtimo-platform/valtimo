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
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentValidator
import com.ritense.valueresolver.ValueResolverFactory

/** Validates `dataMigration` on save. Read off the raw JSON, so a patch is judged as written rather than as Jackson made of it. */
class DataMigrationComponentValidator(
    private val valueResolverFactories: List<ValueResolverFactory>,
) : MigrationComponentValidator {

    override fun componentKey() = DataMigrationComponentDeployer.DATA_MIGRATION_COMPONENT_KEY

    override fun validate(source: BlueprintId, target: BlueprintId, component: JsonNode): List<String> =
        component.filter { it.isObject }.flatMap { patch ->
            val targetPath = patch.get("target")?.takeIf { it.isTextual }?.asText().orEmpty()
            listOfNotNull(
                describeUnresolvableTarget(targetPath),
                describeSourceAndValue(patch, targetPath),
            )
        }

    /** An unknown prefix saves and then fails every case at run, with a message about resolver factories rather than about the plan. */
    private fun describeUnresolvableTarget(targetPath: String): String? {
        if (targetPath.isBlank()) {
            return "a patch names no 'target', so there is nothing for it to write to."
        }
        val prefixes = valueResolverFactories.map { it.supportedPrefix() }.filter { it.isNotBlank() }
        val prefix = targetPath.substringBefore(':', missingDelimiterValue = "")
        if (prefix.isNotBlank() && prefixes.contains(prefix)) {
            return null
        }
        val known = prefixes.distinct().sorted().joinToString { "'$it:'" }
        return if (prefix.isBlank()) {
            "the patch for '$targetPath' has no value-resolver prefix, so nothing can be written to it. " +
                "Known prefixes are $known."
        } else {
            "the patch for '$targetPath' targets '$prefix:', which no value resolver handles, so it would " +
                "fail every case. Known prefixes are $known."
        }
    }

    /** Both set is an authoring mistake with a silent winner: the executor prefers `source` and drops `value` without a word. */
    private fun describeSourceAndValue(patch: JsonNode, targetPath: String): String? {
        val hasSource = patch.get("source")?.takeUnless { it.isNull }?.asText()?.isNotBlank() == true
        val hasValue = patch.get("value")?.takeUnless { it.isNull } != null
        return if (hasSource && hasValue) {
            "the patch for '$targetPath' sets both 'source' and 'value'. A patch either copies from a path " +
                "or writes a literal; keep the one that was meant."
        } else {
            null
        }
    }
}
