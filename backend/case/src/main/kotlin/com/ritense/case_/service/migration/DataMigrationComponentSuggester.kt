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

import com.fasterxml.jackson.annotation.JsonInclude
import com.ritense.case_.domain.migration.DataMigrationPatch
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentSuggester
import com.ritense.valtimo.contract.blueprint.migration.MigrationRunCache
import com.ritense.valtimo.contract.utils.LcsDistance
import com.ritense.valueresolver.ValueResolverOption
import com.ritense.valueresolver.ValueResolverOptionRequest
import com.ritense.valueresolver.ValueResolverOptionType
import com.ritense.valueresolver.ValueResolverService
import io.github.oshai.kotlinlogging.KotlinLogging

/** A clearing patch as it is suggested, with `value: null` written out — otherwise it is indistinguishable on the wire from a copy patch whose source is still missing. */
internal data class ClearingPatch(
    val target: String,
    @get:JsonInclude(JsonInclude.Include.ALWAYS) val value: Any? = null,
)

/** Best-effort `dataMigration` suggestion: name-matched copies above [SIMILARITY_THRESHOLD], bare targets for what found no source, clears for what found no target. Collapsed to the shallowest path and sorted by target. */
class DataMigrationComponentSuggester(
    private val valueResolverService: ValueResolverService,
) : MigrationComponentSuggester {

    override fun componentKey() = DataMigrationComponentDeployer.DATA_MIGRATION_COMPONENT_KEY

    /** A plan migrating one document between two blueprint versions — the ordinary case. */
    override fun suggest(source: BlueprintId, target: BlueprintId): Any? =
        suggest(source, target, separateDocument = false)

    /** The `dataMigration` of an add/removeBuildingBlock entry, which fills a second document rather than carrying one over. Told, not inferred: a nested entry and a cross-key block plan are both `block -> block`. */
    override fun suggestForBuildingBlockEntry(source: BlueprintId, target: BlueprintId): Any? =
        suggest(source, target, separateDocument = true)

    private fun suggest(source: BlueprintId, target: BlueprintId, separateDocument: Boolean): Any? {
        val sourcePaths = fieldPathsOf(source)
        val targetPaths = fieldPathsOf(target)

        // A source resolving no path would yield only bare targets, which the applier writes as literal nulls — emptying the document field by field. Nothing is the honest answer.
        if (sourcePaths.isEmpty()) {
            logger.info {
                "'$source' resolves no document path, so no 'dataMigration' is suggested for '$target'. " +
                    "Either it is not deployed — a plan that names it migrates nothing (G16) — or its " +
                    "schema is empty, and either way there is no value to carry over."
            }
            return null
        }

        val sourcePathSet = sourcePaths.toSet()
        val targetPathSet = targetPaths.toSet()

        // A shared path is free with one document and the whole job with two; either way it consumes its source.
        val matchedSourceByTarget = matchByName(
            targets = targetPaths.filterNot { it in sourcePathSet },
            sources = sourcePaths.filterNot { it in targetPathSet },
        )
        val matchedSources = matchedSourceByTarget.values.toSet()

        // Collapsed among the shared paths only — a name-matched copy into a collapsed subtree reads a different source and has to survive.
        val identityCopies = if (!separateDocument) {
            emptyList()
        } else {
            collapseToRoots(targetPaths.filter { targetPath -> targetPath in sourcePathSet })
                .map { sharedPath -> DataMigrationPatch(source = sharedPath, target = sharedPath) }
        }

        val copies = targetPaths
            .filter { targetPath -> targetPath !in sourcePathSet }
            .map { targetPath -> DataMigrationPatch(source = matchedSourceByTarget[targetPath], target = targetPath) }

        // A separate document starts empty, so there is no carried-over value to clear.
        val removals = if (separateDocument) {
            emptyList()
        } else {
            collapseToRoots(
                sourcePaths.filter { sourcePath -> sourcePath !in targetPathSet && sourcePath !in matchedSources }
            ).map { removedPath -> ClearingPatch(target = removedPath) }
        }

        // Carried with their target rather than sorted as one list: a clearing patch is a different shape on the wire.
        val suggested = identityCopies.map { it.target to it } +
            copies.map { it.target to it } +
            removals.map { it.target to it }
        return suggested.sortedBy { (target, _) -> target }.map { (_, patch) -> patch }.ifEmpty { null }
    }


    /** Keeps only paths no ancestor in the same list already covers, so a subtree is patched once instead of once per node beneath it. */
    private fun collapseToRoots(paths: List<String>): List<String> {
        val all = paths.toSet()
        return paths.filter { path -> ancestorsOf(path).none { it in all } }
    }

    /** The `/`-separated paths above [path], nearest first, e.g. `doc:/a/b/c` -> `doc:/a/b`, `doc:/a`. */
    private fun ancestorsOf(path: String): Sequence<String> =
        generateSequence(path) { it.substringBeforeLast('/', "") }
            .drop(1)
            .takeWhile { it.isNotEmpty() }

    /** Greedily pairs each target with the most similar unmatched source, strongest first, keeping only pairs clearing [SIMILARITY_THRESHOLD]. */
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

    /** Every `doc:` field path [blueprintId]'s version models, memoized for the run — a whole-plan suggestion asks for the same blueprint once per entry, and each ask walks the whole everit schema. */
    private fun fieldPathsOf(blueprintId: BlueprintId): List<String> =
        MigrationRunCache.computeIfAbsent(FieldPathsKey(blueprintId)) {
            fieldPaths(valueResolverService.getResolvableKeys(FIELD_OPTIONS, blueprintId))
        }

    /** Private, so nothing else sharing [MigrationRunCache]'s keyspace can collide. */
    private data class FieldPathsKey(val blueprintId: BlueprintId)

    private fun fieldPaths(options: List<ValueResolverOption>): List<String> =
        options.flatMap { option -> listOf(option.path) + fieldPaths(option.children ?: emptyList()) }

    /** The path's field name: everything after the last `/`, `.` or `:`, else the whole path. */
    private fun fieldName(path: String): String {
        val delimiter = NAME_DELIMITERS.firstOrNull { it in path } ?: return path
        return path.substringAfterLast(delimiter)
    }

    /** LCS-based name similarity in `[0, 1]`; `1` is identical, `0` shares no subsequence. */
    private fun similarity(a: String, b: String): Double =
        LcsDistance.similarityOf(a.lowercase(), b.lowercase())

    private companion object {
        val logger = KotlinLogging.logger {}

        const val DOCUMENT_PREFIX = "doc"

        /** The one request this suggester ever makes: every `doc:` field of a blueprint version. */
        val FIELD_OPTIONS = ValueResolverOptionRequest(
            prefixes = listOf(DOCUMENT_PREFIX),
            type = ValueResolverOptionType.FIELD,
        )

        /** Field-name delimiters, tried in priority order to isolate the segment after the last one. */
        val NAME_DELIMITERS = listOf('/', '.', ':')

        /** Minimum field-name similarity for a source to be considered a rename of a target. */
        const val SIMILARITY_THRESHOLD = 0.9
    }
}
