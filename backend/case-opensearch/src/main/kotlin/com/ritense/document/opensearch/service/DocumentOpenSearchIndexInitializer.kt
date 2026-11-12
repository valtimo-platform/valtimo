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

package com.ritense.document.opensearch.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case.service.CaseDefinitionService
import com.ritense.document.opensearch.OpenSearchProperties
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.data.client.orhlc.NativeSearchQueryBuilder
import org.opensearch.index.query.QueryBuilders
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.document.Document
import org.springframework.data.elasticsearch.core.index.AliasAction
import org.springframework.data.elasticsearch.core.index.AliasActionParameters
import org.springframework.data.elasticsearch.core.index.AliasActions
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import java.time.Duration

/**
 * Owns the per-definition OpenSearch index topology and its lifecycle.
 *
 * Each (case-definition key, version tag) has one concrete index — `<writeAlias>_initial`, or
 * `<writeAlias>_<epochMillis>` after a rebuild — fronted by three aliases: the version write alias, the
 * per-definition read alias spanning every version, and the shared read alias
 * ([OpenSearchIndexNameResolver.READ_ALIAS]) behind "All cases". Writers and readers only use aliases, so a
 * rebuild (see [prepareRebuildIndex] + [swapInRebuiltIndex]) swaps the concrete without a gap.
 *
 * Objects under `content` map to one `flat_object` field each and strings to `text` with a `keyword` sub-field,
 * so a blob such as `openzaakgegevens` cannot explode the field count and one path may hold an object in one case
 * and a scalar in another. The mapping is not derived from search-field configuration, so editing search fields
 * never needs a mapping change or reindex. Startup never drops the legacy single index — a legacy or stale
 * topology is reported by [isLegacyOrStale] and repaired by an operator-initiated migrate reindex.
 */
open class DocumentOpenSearchIndexInitializer(
    private val elasticsearchOperations: ElasticsearchOperations,
    private val resolver: OpenSearchIndexNameResolver,
    private val caseDefinitionService: CaseDefinitionService,
    private val openSearchProperties: OpenSearchProperties,
) {

    @Volatile
    private var lastWriteFailureAt: Long = 0L

    open fun ensureAllIndices() {
        // Isolate per definition: one definition whose index can't be created (shard limit, read-only block,
        // mapping error) must not stop the others — otherwise a reconcile cycle aborts before indexing anything.
        activeDefinitionVersions().forEach { (key, versionTag) ->
            runCatching { ensureIndex(key, versionTag) }
                .onFailure { logger.error(it) { "Could not ensure OpenSearch index for '$key' v'$versionTag' — skipping this cycle" } }
        }
    }

    /**
     * Records that an OpenSearch write was rejected (e.g. a mapping conflict on the live-sync path). Surfaced
     * by the health indicator so a silently-dropped write becomes operator-visible. Self-clears after
     * [WRITE_FAILURE_TTL_MS] of no further failures.
     */
    open fun recordWriteFailure() {
        lastWriteFailureAt = System.currentTimeMillis()
    }

    /** Whether an OpenSearch write was rejected within the last [WRITE_FAILURE_TTL_MS]. */
    open fun hasRecentWriteFailures(): Boolean {
        val at = lastWriteFailureAt
        return at != 0L && System.currentTimeMillis() - at < WRITE_FAILURE_TTL_MS
    }

    open fun ensureIndex(definitionKey: String, versionTag: String) {
        val writeAlias = resolver.writeAliasFor(definitionKey, versionTag)
        if (exists(writeAlias)) return

        // Deterministic first-index name, created idempotently, so concurrent provisioning across nodes
        // converges on one concrete index. A unique (timestamped) name per node would let each node create its
        // own, leaving the alias spanning several indices with no write index — then every write fails.
        val concrete = "${writeAlias}_$INITIAL_INDEX_SUFFIX"
        createConcreteIndexIfAbsent(concrete)
        attachAliases(concrete, definitionKey, versionTag)
        logger.info {
            "Ensured OpenSearch index '$concrete' for definition '$definitionKey' version '$versionTag', fronted " +
                "by write alias '$writeAlias', read alias '${resolver.indexNameFor(definitionKey)}' and " +
                "'${OpenSearchIndexNameResolver.READ_ALIAS}'"
        }
    }

    /**
     * Builds a fresh concrete index for [definitionKey] version [versionTag] with the production mapping, **not
     * yet attached to any alias**. The caller fills it and then atomically publishes it via [swapInRebuiltIndex].
     * Returns the new concrete index name.
     */
    open fun prepareRebuildIndex(definitionKey: String, versionTag: String): String =
        createConcreteIndex(resolver.writeAliasFor(definitionKey, versionTag))

    /**
     * Atomically repoints the version write alias, the per-definition read alias and the shared read alias from
     * the current backing index(es) **of that version** to [newConcrete], then drops the superseded index(es).
     * Only this version's concrete is swapped — other versions stay attached to the per-definition read alias. A
     * single alias action means readers never see a gap.
     */
    open fun swapInRebuiltIndex(definitionKey: String, versionTag: String, newConcrete: String) {
        val writeAlias = resolver.writeAliasFor(definitionKey, versionTag)
        val readAlias = resolver.indexNameFor(definitionKey)
        val old = concretesBehind(writeAlias).filter { it != newConcrete }

        val actions = buildList {
            old.forEach { index ->
                add(AliasAction.Remove(aliasParams(index, writeAlias)))
                add(AliasAction.Remove(aliasParams(index, readAlias)))
                add(AliasAction.Remove(aliasParams(index, OpenSearchIndexNameResolver.READ_ALIAS)))
            }
            add(AliasAction.Add(aliasParams(newConcrete, writeAlias)))
            add(AliasAction.Add(aliasParams(newConcrete, readAlias)))
            add(AliasAction.Add(aliasParams(newConcrete, OpenSearchIndexNameResolver.READ_ALIAS)))
        }
        elasticsearchOperations.indexOps(IndexCoordinates.of(newConcrete)).alias(AliasActions(*actions.toTypedArray()))

        old.forEach { dropIndex(it) }
        logger.info { "Swapped definition '$definitionKey' version '$versionTag' onto rebuilt index '$newConcrete' (dropped ${old.size} old index(es))" }
    }

    /** Drops [name] (a concrete index) if it exists. A missing index is a no-op. */
    open fun dropIndex(name: String) {
        val indexOps = elasticsearchOperations.indexOps(IndexCoordinates.of(name))
        if (indexOps.exists()) {
            indexOps.delete()
            logger.info { "Dropped OpenSearch index '$name'" }
        }
    }

    /** Drops the single legacy `json_schema_document` index once migration has reindexed off it. */
    open fun dropLegacyIndex() = dropIndex(OpenSearchIndexNameResolver.LEGACY_INDEX)

    /**
     * Whether the live topology needs a rebuild/migration: the single legacy index is still present, or an
     * active definition has no per-definition index yet. Surfaced to the operator (health indicator + admin
     * screen) rather than auto-repaired on startup.
     */
    open fun isLegacyOrStale(): Boolean {
        val indicesByName = aliasesByIndex()
        if (OpenSearchIndexNameResolver.LEGACY_INDEX in indicesByName) return true
        // The pre-migration per-key-only topology has the read alias but no per-version write alias; flag it (and
        // any active definition whose current version has no index yet) so search falls back to the database.
        val aliases = indicesByName.values.flatten().toSet()
        return activeWriteAliases().any { it !in aliases }
    }

    /** The write aliases of the current version of every active definition. */
    open fun activeWriteAliases(): Set<String> =
        activeDefinitionVersions().map { (key, versionTag) -> resolver.writeAliasFor(key, versionTag) }.toSet()

    /**
     * Drops concrete indices of versions that are no longer active and hold no documents, so shards do not pile up
     * as definition versions accumulate. Never drops an active version's index, nor the last index of a
     * definition, so the read aliases survive. A later write to a pruned version re-creates its index.
     */
    open fun pruneEmptyVersionIndices() {
        val active = activeWriteAliases()
        aliasesByIndex()
            .filterValues { OpenSearchIndexNameResolver.READ_ALIAS in it }
            .entries
            .groupBy { (_, aliases) -> perDefinitionReadAlias(aliases) }
            .values
            .forEach { concretes ->
                val empty = concretes
                    .filter { (_, aliases) -> aliases.none { it in active } }
                    .map { it.key }
                    .filter { isEmpty(it) }
                val toDrop = if (empty.size < concretes.size) empty else empty.drop(1)
                toDrop.forEach { concrete ->
                    runCatching { dropIndex(concrete) }
                        .onFailure { logger.warn(it) { "Failed to prune empty OpenSearch version index '$concrete'" } }
                }
            }
    }

    /**
     * Drops per-definition indices that no alias points at: the unpublished target of a rebuild, or the replaced
     * index of a swap, left behind by a crash. Only safe while no rebuild runs, so the reindex calls it under its
     * lock; the age check spares an index that [ensureIndex] is attaching aliases to right now.
     */
    open fun dropOrphanedIndices(minAge: Duration = ORPHAN_MIN_AGE) {
        aliasesByIndex()
            .filter { (index, aliases) -> aliases.isEmpty() && index != OpenSearchIndexNameResolver.LEGACY_INDEX }
            .keys
            .filter { isOlderThan(it, minAge) }
            .forEach { orphan ->
                logger.warn { "Dropping orphaned OpenSearch index '$orphan' left behind by an interrupted rebuild" }
                dropIndex(orphan)
            }
    }

    private fun createConcreteIndex(alias: String): String {
        val name = newConcreteName(alias)
        writeConcreteIndex(name)
        return name
    }

    /**
     * Creates [name] with the production settings/mapping, treating a concurrent creation by another node as
     * success — the loser of the race simply reuses the index the winner created. Safe only because
     * [writeConcreteIndex] creates the index and its mapping atomically, so an existing index is always fully
     * mapped; do not widen this to swallow a mapping failure on a half-provisioned index.
     */
    private fun createConcreteIndexIfAbsent(name: String) {
        try {
            writeConcreteIndex(name)
        } catch (e: Exception) {
            if (!exists(name)) throw e
            logger.debug { "Concrete index '$name' already exists (created concurrently) — reusing it" }
        }
    }

    private fun writeConcreteIndex(name: String) {
        val indexOps = elasticsearchOperations.indexOps(IndexCoordinates.of(name))

        val settings = Document.create()
        settings["index.number_of_replicas"] = 0
        // Drop a non-conforming scalar for one document instead of rejecting the whole document, covering
        // residual within-definition scalar type-drift. No-op for text/object.
        settings["index.mapping.ignore_malformed"] = true
        // Raised so a wide case type is not rejected; each object under content is one flat_object field, so only
        // top-level leaves count toward this.
        settings["index.mapping.total_fields.limit"] = openSearchProperties.totalFieldsLimit

        val mapping = indexOps.createMapping(JsonSchemaDocumentOsDocument::class.java)
        mapping["dynamic_templates"] = listOf(
            // Objects first: any object under content maps to a single flat_object field, so unsearchable blobs
            // (e.g. openzaakgegevens) never explode the field count — yet their nested leaves stay queryable as
            // keywords (used by authorization conditions and group filters). Combined with ignore_malformed,
            // the same path can hold an object in one document and a scalar in another without rejecting either.
            mapOf("content_objects_flat" to mapOf(
                "path_match" to "content.*",
                "match_mapping_type" to "object",
                "mapping" to mapOf("type" to "flat_object")
            )),
            mapOf("content_fields_as_text" to mapOf(
                "path_match" to "content.*",
                "match_mapping_type" to "string",
                "mapping" to mapOf(
                    "type" to "text",
                    "fields" to mapOf("keyword" to mapOf("type" to "keyword", "ignore_above" to 256))
                )
            ))
        )

        // Single atomic create: the index never exists without its mapping, so a failure never leaves a
        // half-provisioned index and the concurrent-create fallback can safely reuse an index that exists.
        indexOps.create(settings, mapping)
    }

    private fun attachAliases(concrete: String, definitionKey: String, versionTag: String) {
        val add = AliasActions(
            AliasAction.Add(aliasParams(concrete, resolver.writeAliasFor(definitionKey, versionTag))),
            AliasAction.Add(aliasParams(concrete, resolver.indexNameFor(definitionKey))),
            AliasAction.Add(aliasParams(concrete, OpenSearchIndexNameResolver.READ_ALIAS)),
        )
        elasticsearchOperations.indexOps(IndexCoordinates.of(concrete)).alias(add)
    }

    private fun aliasParams(indexName: String, aliasName: String) =
        AliasActionParameters.builder().withIndices(indexName).withAliases(aliasName).build()

    /** Every index of this module (legacy included) with the names of its aliases, in a single request. */
    private fun aliasesByIndex(): Map<String, Set<String>> =
        elasticsearchOperations.indexOps(IndexCoordinates.of(INDEX_PATTERN))
            .getAliasesForIndex(INDEX_PATTERN)
            .mapValues { (_, aliases) -> aliases.map { it.alias }.toSet() }

    // The version write alias is "<readAlias>_v<tag>", so the shortest non-global alias is the per-definition one.
    private fun perDefinitionReadAlias(aliases: Set<String>): String? =
        aliases.filter { it != OpenSearchIndexNameResolver.READ_ALIAS }.minByOrNull { it.length }

    // Refreshed first, so a write that is not yet searchable does not count as empty.
    private fun isEmpty(concrete: String): Boolean {
        val coordinates = IndexCoordinates.of(concrete)
        elasticsearchOperations.indexOps(coordinates).refresh()
        val query = NativeSearchQueryBuilder().withQuery(QueryBuilders.matchAllQuery()).build()
        return elasticsearchOperations.count(query, JsonSchemaDocumentOsDocument::class.java, coordinates) == 0L
    }

    private fun isOlderThan(index: String, age: Duration): Boolean {
        val createdAt = elasticsearchOperations.indexOps(IndexCoordinates.of(index)).settings
            .getString(CREATION_DATE_SETTING)?.toLongOrNull()
            ?: return false
        return System.currentTimeMillis() - createdAt >= age.toMillis()
    }

    /** The concrete index names currently backing [alias] (resolved via the get-alias API). */
    private fun concretesBehind(alias: String): List<String> {
        if (!exists(alias)) return emptyList()
        return elasticsearchOperations.indexOps(IndexCoordinates.of(alias))
            .getAliasesForIndex(alias)
            .keys
            .toList()
    }

    private fun newConcreteName(alias: String): String {
        var candidate = "${alias}_${System.currentTimeMillis()}"
        while (exists(candidate)) {
            candidate = "${alias}_${System.currentTimeMillis()}_${(0..Int.MAX_VALUE).random()}"
        }
        return candidate
    }

    private fun exists(name: String): Boolean =
        elasticsearchOperations.indexOps(IndexCoordinates.of(name)).exists()

    /** Active case definitions as (key, current version tag) — the versions provisioned/read at startup. */
    open fun activeDefinitionVersions(): List<Pair<String, String>> =
        runWithoutAuthorization {
            caseDefinitionService.getCaseDefinitions(active = true).map { it.id.key to it.id.versionTag.toString() }
        }

    companion object {
        private val logger = KotlinLogging.logger {}

        /**
         * Deterministic suffix for the first concrete index behind a per-definition alias — see [ensureIndex].
         * Not a rollover counter: rebuilds mint timestamped names, so this never increments.
         */
        private const val INITIAL_INDEX_SUFFIX = "initial"

        /** How long a recorded write failure keeps the health indicator in a WARN state. */
        private const val WRITE_FAILURE_TTL_MS = 5 * 60 * 1000L

        private const val INDEX_PATTERN = "json_schema_document*"
        private const val CREATION_DATE_SETTING = "index.creation_date"
        private val ORPHAN_MIN_AGE: Duration = Duration.ofHours(1)
    }
}
