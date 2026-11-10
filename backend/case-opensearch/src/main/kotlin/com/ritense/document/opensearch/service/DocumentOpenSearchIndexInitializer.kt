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
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.document.Document
import org.springframework.data.elasticsearch.core.index.AliasAction
import org.springframework.data.elasticsearch.core.index.AliasActionParameters
import org.springframework.data.elasticsearch.core.index.AliasActions
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates

/**
 * Owns the per-definition OpenSearch index topology and its lifecycle.
 *
 * Each case definition is fronted by a **per-definition alias** named `json_schema_document_<key>`
 * (the value [OpenSearchIndexNameResolver.indexNameFor] returns) that points at a single concrete,
 * timestamped index `json_schema_document_<key>_<epochMillis>`. Every writer and single-definition reader
 * targets the alias, so the concrete index behind it can be rebuilt and swapped atomically without the
 * stable name ever pointing at a missing index. The concrete index also joins the shared read alias
 * ([OpenSearchIndexNameResolver.READ_ALIAS]) that serves the cross-definition "All cases" list.
 *
 * [ensureIndex]/[ensureAllIndices] are invoked before the engine toggle switches to OpenSearch and when a
 * new definition is deployed; both are idempotent. A rebuild (see [prepareRebuildIndex] + [swapInRebuiltIndex])
 * is the zero-downtime mechanism behind the admin "recreate index" reindex. Startup provisioning never drops
 * the legacy single index — a legacy/stale topology is surfaced via [isLegacyOrStale] and repaired by an
 * operator-initiated migrate reindex.
 *
 * Each concrete index carries the same dynamic `content` mapping: scalar fields are mapped dynamically (so
 * any content path remains searchable, including ad-hoc group-filter paths that are not declared search
 * fields), strings via the `content_fields_as_text` template, while any **object** under `content` is mapped
 * `enabled: false` (the `content_objects_disabled` template). Disabling objects stops unsearchable blobs such
 * as `openzaakgegevens` from exploding the field count, and lets the same path hold an object in one case and
 * a scalar in another without a mapping collision. `index.mapping.total_fields.limit` is raised accordingly.
 * Per-definition isolation — not the templates — removes the cross-definition type collisions, and the
 * mapping is deliberately not derived from search-field config, so editing search fields never triggers a
 * mapping change or reindex.
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
        activeDefinitions().forEach { (key, versionTag) -> ensureIndex(key, versionTag) }
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
        if (exists(OpenSearchIndexNameResolver.LEGACY_INDEX)) return true
        // The pre-migration per-key-only topology has the read alias but no per-version write alias; flag it (and
        // any active definition whose current version has no index yet) so search falls back to the database.
        return activeDefinitions().any { (key, versionTag) -> !exists(resolver.writeAliasFor(key, versionTag)) }
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
        // Raised so a case type with many content fields is never rejected; objects are enabled:false (one
        // field each), so only scalar leaves count toward this.
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
    private fun activeDefinitions(): List<Pair<String, String>> =
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
    }
}
