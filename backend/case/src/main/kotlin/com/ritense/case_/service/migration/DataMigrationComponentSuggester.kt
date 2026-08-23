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
 *
 * An object container node is itself a resolvable path (`doc:/applicant` alongside
 * `doc:/applicant/name`), so a whole subtree the target version dropped used to yield one clearing
 * patch per node in it — the object *and* every descendant. Only the object's own patch does any
 * work: it removes the subtree, after which each descendant patch either finds nothing left or
 * re-creates the object it was just removed from. So the clearing patches are collapsed to the
 * **shallowest** removed path, which is what an author reads as "this object is gone".
 *
 * The patches come out **sorted by target path**, so the same two versions always suggest the same
 * document, related fields sit together, and a plan is reviewable and diffable rather than ordered by
 * however the schema walk happened to enumerate. Sorting is safe here even though the patches are
 * applied in order: a copy targets a path the target version *has* and a clear targets one it has
 * **not**, and a version cannot model `…/a/b` without modelling `…/a`, so neither can ever be an
 * ancestor of the other and clearing can never undo a copy. Where an ancestor relation *is* possible —
 * two copies into one new subtree — a lexicographic sort keeps the ancestor first (a prefix always
 * sorts before its extensions), which is the order that leaves the more specific patch winning.
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

        val removals = collapseToRemovedRoots(
            sourcePaths.filter { sourcePath -> sourcePath !in targetPathSet && sourcePath !in matchedSources }
        ).map { removedPath -> DataMigrationPatch(value = null, target = removedPath) }

        return (copies + removals).sortedBy { it.target }.ifEmpty { null }
    }

    /**
     * Keeps only the removed paths no removed *ancestor* already covers, so a dropped object is
     * cleared once instead of once per node beneath it.
     *
     * This is safe because a path is only removed when the target version does not have it, and the
     * target cannot have `…/applicant/name` without having `…/applicant` — object containers are
     * always offered as options too. So no patch, and nothing the target version still models, lives
     * under a path collapsed away here. A descendant matched as the *source* of a copy is not in this
     * list to begin with, and its value survives the surviving ancestor patch regardless: every source
     * is resolved before any target is written.
     */
    private fun collapseToRemovedRoots(removedPaths: List<String>): List<String> {
        val removed = removedPaths.toSet()
        return removedPaths.filter { path -> ancestorsOf(path).none { it in removed } }
    }

    /** The `/`-separated paths above [path], nearest first, e.g. `doc:/a/b/c` -> `doc:/a/b`, `doc:/a`. */
    private fun ancestorsOf(path: String): Sequence<String> =
        generateSequence(path) { it.substringBeforeLast('/', "") }
            .drop(1)
            .takeWhile { it.isNotEmpty() }

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
    private fun similarity(a: String, b: String): Double =
        LcsDistance.similarityOf(a.lowercase(), b.lowercase())

    private companion object {
        const val DOCUMENT_PREFIX = "doc"

        /** Field-name delimiters, tried in priority order to isolate the segment after the last one. */
        val NAME_DELIMITERS = listOf('/', '.', ':')

        /** Minimum field-name similarity for a source to be considered a rename of a target. */
        const val SIMILARITY_THRESHOLD = 0.9
    }
}
