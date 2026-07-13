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

import com.ritense.case_.domain.migration.DataMigrationPatch
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentSuggester
import com.ritense.valtimo.contract.utils.LcsDistance
import com.ritense.valueresolver.ValueResolverOption
import com.ritense.valueresolver.ValueResolverOptionRequest
import com.ritense.valueresolver.ValueResolverOptionType
import com.ritense.valueresolver.ValueResolverService

/**
 * Best-effort `dataMigration` suggestion. The document JSON is copied verbatim from the source to
 * the target version by default, so fields present in both versions need no patch. Only the
 * differences are suggested:
 *
 * - a field that is **new** in the target (not in the source) gets a copy patch from the most
 *   similarly-named source field, as a best-effort starting point the user can repoint;
 * - a field that **only exists in the source** (removed in the target) gets a patch that sets it to
 *   `null`, clearing the stale value carried over by the verbatim copy.
 */
class DataMigrationComponentSuggester(
    private val valueResolverService: ValueResolverService,
) : MigrationComponentSuggester {

    override fun componentKey() = DataMigrationComponentDeployer.DATA_MIGRATION_COMPONENT_KEY

    override fun suggest(source: BlueprintId, target: BlueprintId): Any? {
        val request =
            ValueResolverOptionRequest(prefixes = listOf(DOCUMENT_PREFIX), type = ValueResolverOptionType.FIELD)
        val sourcePaths = fieldPaths(valueResolverService.getResolvableKeys(request, source))
        val targetPaths = fieldPaths(valueResolverService.getResolvableKeys(request, target))
        val sourcePathSet = sourcePaths.toSet()
        val targetPathSet = targetPaths.toSet()

        val usedSources = sourcePaths.filterTo(mutableSetOf()) { it in targetPathSet }

        val additions = targetPaths
            .filter { targetPath -> targetPath !in sourcePathSet }
            .map { targetPath ->
                val candidates = sourcePaths.filterNot { it in usedSources }.ifEmpty {
                    usedSources.clear()
                    sourcePaths
                }
                val source = mostSimilarPath(targetPath, candidates)?.also { usedSources.add(it) }
                DataMigrationPatch(source = source, target = targetPath)
            }

        val removals = sourcePaths
            .filter { sourcePath -> sourcePath !in targetPathSet }
            .map { removedPath -> DataMigrationPatch(value = null, target = removedPath) }

        return (additions + removals).ifEmpty { null }
    }

    private fun fieldPaths(options: List<ValueResolverOption>): List<String> =
        options.flatMap { option -> listOf(option.path) + fieldPaths(option.children ?: emptyList()) }

    /** The candidate whose name is closest (smallest edit distance) to [target], or null if none. */
    private fun mostSimilarPath(target: String, candidates: List<String>): String? =
        candidates.minByOrNull { candidate -> LcsDistance.between(candidate.lowercase(), target.lowercase()) }

    private companion object {
        const val DOCUMENT_PREFIX = "doc"
    }
}
