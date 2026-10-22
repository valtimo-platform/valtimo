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
 * Each concrete index carries the same dynamic `content` mapping (the `content_fields_as_text` template);
 * per-definition isolation — not the template — is what removes the cross-definition type collisions. The
 * template is deliberately not derived from search-field config, so editing search fields never triggers a
 * mapping change.
 */
open class DocumentOpenSearchIndexInitializer(
    private val elasticsearchOperations: ElasticsearchOperations,
    private val resolver: OpenSearchIndexNameResolver,
    private val caseDefinitionService: CaseDefinitionService,
) {

    open fun ensureAllIndices() {
        activeDefinitionKeys().forEach { ensureIndex(it) }
    }

    open fun ensureIndex(definitionKey: String) {
        val alias = resolver.indexNameFor(definitionKey)
        if (exists(alias)) return

        val concrete = createConcreteIndex(alias)
        attachAliases(concrete, alias)
        logger.info {
            "Created OpenSearch index '$concrete' for definition '$definitionKey', fronted by alias '$alias' " +
                "and joined to '${OpenSearchIndexNameResolver.READ_ALIAS}'"
        }
    }

    /**
     * Builds a fresh concrete index for [definitionKey] with the production mapping, **not yet attached to
     * any alias**. The caller fills it and then atomically publishes it via [swapInRebuiltIndex]. Returns the
     * new concrete index name.
     */
    open fun prepareRebuildIndex(definitionKey: String): String =
        createConcreteIndex(resolver.indexNameFor(definitionKey))

    /**
     * Atomically repoints the per-definition alias and the shared read alias from the current backing
     * index(es) to [newConcrete], then drops the superseded index(es). A single alias action means readers
     * never see a gap. A no-op old set (first ever publish) just attaches the new index.
     */
    open fun swapInRebuiltIndex(definitionKey: String, newConcrete: String) {
        val alias = resolver.indexNameFor(definitionKey)
        val old = concretesBehind(alias).filter { it != newConcrete }

        val actions = buildList {
            old.forEach { index ->
                add(AliasAction.Remove(aliasParams(index, alias)))
                add(AliasAction.Remove(aliasParams(index, OpenSearchIndexNameResolver.READ_ALIAS)))
            }
            add(AliasAction.Add(aliasParams(newConcrete, alias)))
            add(AliasAction.Add(aliasParams(newConcrete, OpenSearchIndexNameResolver.READ_ALIAS)))
        }
        elasticsearchOperations.indexOps(IndexCoordinates.of(newConcrete)).alias(AliasActions(*actions.toTypedArray()))

        old.forEach { dropIndex(it) }
        logger.info { "Swapped definition '$definitionKey' onto rebuilt index '$newConcrete' (dropped ${old.size} old index(es))" }
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
        return activeDefinitionKeys().any { !exists(resolver.indexNameFor(it)) }
    }

    private fun createConcreteIndex(alias: String): String {
        val name = newConcreteName(alias)
        val indexOps = elasticsearchOperations.indexOps(IndexCoordinates.of(name))

        val settings = Document.create()
        settings["index.number_of_replicas"] = 0
        // Drop a non-conforming scalar for one document instead of rejecting the whole document, covering
        // residual within-definition scalar type-drift. No-op for text/object, so it never alters the
        // behaviour the content_fields_as_text template already handles for strings.
        settings["index.mapping.ignore_malformed"] = true
        indexOps.create(settings)

        val annotatedMapping = indexOps.createMapping(JsonSchemaDocumentOsDocument::class.java)
        annotatedMapping["dynamic_templates"] = listOf(
            mapOf("content_fields_as_text" to mapOf(
                "path_match" to "content.*",
                "match_mapping_type" to "string",
                "mapping" to mapOf(
                    "type" to "text",
                    "fields" to mapOf("keyword" to mapOf("type" to "keyword", "ignore_above" to 256))
                )
            ))
        )
        indexOps.putMapping(annotatedMapping)
        return name
    }

    private fun attachAliases(concrete: String, perDefinitionAlias: String) {
        val add = AliasActions(
            AliasAction.Add(aliasParams(concrete, perDefinitionAlias)),
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

    private fun activeDefinitionKeys(): List<String> =
        runWithoutAuthorization { caseDefinitionService.getCaseDefinitions(active = true).map { it.id.key } }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
