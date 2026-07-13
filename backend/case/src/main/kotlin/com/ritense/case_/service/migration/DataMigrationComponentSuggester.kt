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
 * the target version by default, so fields present at the **same path** in both versions need no
 * patch. Each remaining target is paired with the source whose **field name** (the segment after
 * the last `/`) is most similar — the full path may be restructured (`doc:/path/to/value` →
 * `doc:/path/to/new/value`), only the name is expected to survive a rename, so a source is only
 * considered a match when its name is at least [SIMILARITY_THRESHOLD] similar. The pairing is
 * one-to-one: every source is matched to at most one target. The leftovers are then suggested:
 *
 * - a target that **found no source** gets a copy patch with a `null` source, surfacing the field
 *   so the user can point it at the right source;
 * - a source that was **matched to no target** gets a patch that sets it to `null`, clearing the
 *   stale value carried over by the verbatim copy.
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

        // Identical paths are copied verbatim by the migration engine, so they need no patch. They
        // still consume their source, so it is not later cleared as an unmatched leftover.
        val matchedSourceByTarget = matchByName(
            targets = targetPaths.filterNot { it in sourcePathSet },
            sources = sourcePaths.filterNot { it in targetPathSet },
        )
        val matchedSources = matchedSourceByTarget.values.toSet()

        val copies = targetPaths
            .filter { targetPath -> targetPath !in sourcePathSet }
            .map { targetPath -> DataMigrationPatch(source = matchedSourceByTarget[targetPath], target = targetPath) }

        val removals = sourcePaths
            .filter { sourcePath -> sourcePath !in targetPathSet && sourcePath !in matchedSources }
            .map { removedPath -> DataMigrationPatch(value = null, target = removedPath) }

        return (copies + removals).ifEmpty { null }
    }

    /**
     * Greedily pairs each target with the still-unmatched source whose field name is most similar,
     * strongest match first, keeping only pairs that clear [SIMILARITY_THRESHOLD]. Returns the
     * resulting `target -> source` map; a target with no qualifying source is simply absent.
     */
    private fun matchByName(targets: List<String>, sources: List<String>): Map<String, String> {
        val candidates = targets
            .flatMap { target ->
                sources.map { source -> Triple(similarity(fieldName(source), fieldName(target)), source, target) }
            }
            .filter { (similarity, _, _) -> similarity >= SIMILARITY_THRESHOLD }
            .sortedByDescending { (similarity, _, _) -> similarity }

        val takenSources = mutableSetOf<String>()
        val matched = LinkedHashMap<String, String>()
        for ((_, source, target) in candidates) {
            if (target in matched || source in takenSources) continue
            matched[target] = source
            takenSources.add(source)
        }
        return matched
    }

    private fun fieldPaths(options: List<ValueResolverOption>): List<String> =
        options.flatMap { option -> listOf(option.path) + fieldPaths(option.children ?: emptyList()) }

    /**
     * The path's field name: everything after the last delimiter, trying `/`, then `.`, then `:`
     * in that order (e.g. `doc:/a/b/value` -> `value`, `pv:a.b.value` -> `value`, `pv:value` ->
     * `value`). Falls back to the whole path when none of the delimiters are present.
     */
    private fun fieldName(path: String): String {
        val delimiter = NAME_DELIMITERS.firstOrNull { it in path } ?: return path
        return path.substringAfterLast(delimiter)
    }

    /** LCS-based name similarity in `[0, 1]`; `1` is identical, `0` shares no subsequence. */
    private fun similarity(a: String, b: String): Double {
        if (a.isEmpty() && b.isEmpty()) return 1.0
        val distance = LcsDistance.between(a.lowercase(), b.lowercase())
        return 1.0 - distance.toDouble() / (a.length + b.length)
    }

    private companion object {
        const val DOCUMENT_PREFIX = "doc"

        /** Field-name delimiters, tried in priority order to isolate the segment after the last one. */
        val NAME_DELIMITERS = listOf('/', '.', ':')

        /** Minimum field-name similarity for a source to be considered a rename of a target. */
        const val SIMILARITY_THRESHOLD = 0.9
    }
}
