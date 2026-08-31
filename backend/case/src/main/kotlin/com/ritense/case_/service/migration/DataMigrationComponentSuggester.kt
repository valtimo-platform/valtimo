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

/**
 * A clearing patch — "the target version does not have this field, so empty it" — as it is
 * *suggested*, with its `value: null` written out.
 *
 * [DataMigrationPatch] is `@JsonInclude(NON_NULL)`, so a clearing patch and a copy patch whose source
 * could not be worked out both serialise to `{"target": "doc:/x"}`, and neither the editor nor the
 * author can tell which one they are looking at. They read as opposites — one says "this field is
 * going away", the other "point me at the field this came from" — and only one of them is finished
 * work. The applier treats both as a literal null write (`MigrationDataPatchApplier` resolves a patch
 * with no `source` to its `value`), so an accepted suggestion does the right thing for a clear and
 * quietly writes a null for an unfinished copy.
 *
 * Suggestion-only, like `ProcessMigrationComponentSuggester.UnmappedProcess`: a saved plan
 * deserialises both back into [DataMigrationPatch], where the two are the same instruction and always
 * were.
 */
internal data class ClearingPatch(
    val target: String,
    @get:JsonInclude(JsonInclude.Include.ALWAYS) val value: Any? = null,
)

/**
 * Best-effort `dataMigration` suggestion. Where the migration keeps **one document** the JSON is
 * carried over verbatim, so fields present at the **same path** in both versions need no patch; where
 * it fills a **separate** document they are the whole job, and are suggested as identity copies — see
 * [suggestForBuildingBlockEntry]. Each remaining target is paired with the source whose **field name** (the segment after
 * the last `/`) is most similar — the full path may be restructured (`doc:/path/to/value` →
 * `doc:/path/to/new/value`), only the name is expected to survive a rename, so a source is only
 * considered a match when its name is at least [SIMILARITY_THRESHOLD] similar. The pairing is
 * one-to-one: every source is matched to at most one target. The leftovers are then suggested:
 *
 * - a target that **found no source** gets a copy patch with a `null` source, surfacing the field
 *   so the user can point it at the right source;
 * - a source that was **matched to no target** gets a patch that sets it to `null`, clearing the
 *   stale value carried over by the verbatim copy — written out as an explicit `value: null` so the
 *   two are not the same row on the wire, see [ClearingPatch].
 *
 * Nothing at all is suggested when the **source** resolves no path: the only patches left to make
 * would be bare targets, which the applier writes as nulls.
 *
 * An object container node is itself a resolvable path (`doc:/applicant` alongside
 * `doc:/applicant/name`), so a whole subtree the target version dropped used to yield one clearing
 * patch per node in it — the object *and* every descendant. Only the object's own patch does any
 * work: it removes the subtree, after which each descendant patch either finds nothing left or
 * re-creates the object it was just removed from. So the clearing patches are collapsed to the
 * **shallowest** removed path, which is what an author reads as "this object is gone".
 *
 * Identity copies are collapsed the same way and for the same reason: copying `doc:/applicant` carries
 * its whole subtree, so `doc:/applicant/name` beside it is a patch that re-does what the one above it
 * already did. On a real building block this is the difference between 1480 rows and 10.
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

    /** A plan migrating one document between two blueprint versions — the ordinary case. */
    override fun suggest(source: BlueprintId, target: BlueprintId): Any? =
        suggest(source, target, separateDocument = false)

    /**
     * The `dataMigration` of an `addBuildingBlock` / `removeBuildingBlock` **entry**, which moves data
     * between two documents rather than carrying one over: a building block has a document of its own, and
     * `MigrationDataPatchApplier.resolveToContent` builds it from the patches alone, returning a bare
     * object when there are none. So a path both sides have is the whole job here, where in [suggest] it
     * is free.
     *
     * **This has to be told, not inferred.** The first version of this read the blueprint ids — different
     * blueprints, one of them a building block — and that is wrong in both directions for the same pair.
     * A *nested* entry is `block -> block` with two documents; a cross-key building-block **plan** is also
     * `block -> block`, migrating one document from one key to another, and `DataMigrationComponentExecutor`
     * applies its patches with the document id as both source and target. Nothing in the two ids
     * distinguishes them — only the caller knows which it is asking for.
     */
    override fun suggestForBuildingBlockEntry(owner: BlueprintId, block: BlueprintId): Any? =
        suggest(owner, block, separateDocument = true)

    private fun suggest(source: BlueprintId, target: BlueprintId, separateDocument: Boolean): Any? {
        val sourcePaths = fieldPathsOf(source)
        val targetPaths = fieldPathsOf(target)

        // A source that offers no path at all has nothing to copy and nothing to clear, so every patch
        // that could be suggested would be a bare target — which the applier writes as a literal null.
        // For a plan naming a source version that was never deployed (`verhuizing:9.9.9`) that is a
        // suggestion which empties the document field by field, and the author cannot see it coming:
        // the rows look like the ordinary "fill this in" rows. Nothing is the honest answer.
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

        // A path both sides have is either free (one document, carried over verbatim) or the entire
        // point (a separate document, which starts empty). Either way it consumes its source, so it is
        // not later cleared as an unmatched leftover.
        val matchedSourceByTarget = matchByName(
            targets = targetPaths.filterNot { it in sourcePathSet },
            sources = sourcePaths.filterNot { it in targetPathSet },
        )
        val matchedSources = matchedSourceByTarget.values.toSet()

        // Collapsed among the shared paths only. A name-matched copy *into* a collapsed subtree reads a
        // different source and has to survive — `doc:/a` carrying the subtree, then `doc:/a/b` set from
        // `doc:/x/y` — which the lexicographic sort below already orders correctly.
        val identityCopies = if (!separateDocument) {
            emptyList()
        } else {
            collapseToRoots(targetPaths.filter { targetPath -> targetPath in sourcePathSet })
                .map { sharedPath -> DataMigrationPatch(source = sharedPath, target = sharedPath) }
        }

        val copies = targetPaths
            .filter { targetPath -> targetPath !in sourcePathSet }
            .map { targetPath -> DataMigrationPatch(source = matchedSourceByTarget[targetPath], target = targetPath) }

        // A separate document starts empty (`MigrationDataPatchApplier.resolveToContent` returns a bare
        // object when no patch targets `doc:`), so there is no carried-over value to clear and a removal
        // would be a patch that does nothing. Both building-block suggesters drop these anyway.
        val removals = if (separateDocument) {
            emptyList()
        } else {
            collapseToRoots(
                sourcePaths.filter { sourcePath -> sourcePath !in targetPathSet && sourcePath !in matchedSources }
            ).map { removedPath -> ClearingPatch(target = removedPath) }
        }

        // Sorted by target across all three kinds, which is why they are carried with their target
        // rather than sorted as one list: a clearing patch is a different shape on the wire.
        val suggested = identityCopies.map { it.target to it } +
            copies.map { it.target to it } +
            removals.map { it.target to it }
        return suggested.sortedBy { (target, _) -> target }.map { (_, patch) -> patch }.ifEmpty { null }
    }


    /**
     * Keeps only the paths no *ancestor* in the same list already covers, so a subtree is patched once
     * instead of once per node beneath it — a dropped object cleared once, a carried-over object copied
     * once.
     *
     * This is safe for a removal because a path is only removed when the target version does not have it,
     * and the target cannot have `…/applicant/name` without having `…/applicant` — object containers are
     * always offered as options too. So no patch, and nothing the target version still models, lives
     * under a path collapsed away here. A descendant matched as the *source* of a copy is not in this
     * list to begin with, and its value survives the surviving ancestor patch regardless: every source
     * is resolved before any target is written.
     *
     * It is safe for an identity copy for the mirror reason: the ancestor is present on **both** sides, so
     * copying it moves the whole subtree the descendants would each have moved a piece of.
     */
    private fun collapseToRoots(paths: List<String>): List<String> {
        val all = paths.toSet()
        return paths.filter { path -> ancestorsOf(path).none { it in all } }
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

    /**
     * Every `doc:` field path [blueprintId]'s version models, memoized for the caller's run.
     *
     * A whole-plan suggestion asks this for the same blueprint over and over: once for the plan's own
     * `dataMigration`, and again as the owner side of every `addBuildingBlock` / `removeBuildingBlock`
     * entry — 53 of them on the case definition this was measured against, all naming the same case
     * document. Each ask builds the resolvable options afresh by walking the whole everit schema, which
     * for a case definition with 1330 paths and a `$ref` graph over a hundred files is not free.
     * Deployment-time configuration, so it cannot go stale within a run; outside one [MigrationRunCache]
     * is transparent and this is the plain call it always was.
     */
    private fun fieldPathsOf(blueprintId: BlueprintId): List<String> =
        MigrationRunCache.computeIfAbsent(FieldPathsKey(blueprintId)) {
            fieldPaths(valueResolverService.getResolvableKeys(FIELD_OPTIONS, blueprintId))
        }

    /** Private, so no other user of [MigrationRunCache]'s shared keyspace can collide with this one. */
    private data class FieldPathsKey(val blueprintId: BlueprintId)

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
