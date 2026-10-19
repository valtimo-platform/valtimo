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
 * Creates one OpenSearch index per case definition (plus the shared read alias) if they do not yet exist.
 * Invoked before the engine toggle switches to OpenSearch and when a new definition is deployed — failure
 * prevents the swap, keeping queries on Postgres until the cluster is healthy. Both [ensureIndex] and
 * [ensureAllIndices] are idempotent, so repeated calls are safe.
 *
 * Each definition's index carries the same dynamic `content` mapping as before (the `content_fields_as_text`
 * template); per-definition isolation — not the template — is what removes the cross-definition type
 * collisions. The template is deliberately not derived from search-field config, so editing search fields
 * never triggers a mapping change.
 */
open class DocumentOpenSearchIndexInitializer(
    private val elasticsearchOperations: ElasticsearchOperations,
    private val resolver: OpenSearchIndexNameResolver,
    private val caseDefinitionService: CaseDefinitionService,
) {

    open fun ensureAllIndices() {
        val definitionKeys = runWithoutAuthorization {
            caseDefinitionService.getCaseDefinitions(active = true).map { it.id.key }
        }
        definitionKeys.forEach { ensureIndex(it) }
    }

    open fun ensureIndex(definitionKey: String) {
        val name = resolver.indexNameFor(definitionKey)
        val indexOps = elasticsearchOperations.indexOps(IndexCoordinates.of(name))
        if (!indexOps.exists()) {
            val settings = Document.create()
            settings["index.number_of_replicas"] = 0
            // Drop a non-conforming scalar for one document instead of rejecting the whole document, covering
            // residual within-definition scalar type-drift. No-op for text/object, so it never alters the
            // behaviour the content_fields_as_text template already handles for strings.
            settings["index.mapping.ignore_malformed"] = true
            indexOps.create(settings)

            val annotatedMapping = indexOps.createMapping(JsonSchemaDocumentOsDocument::class.java)
            val dynamicTemplates = listOf(
                mapOf("content_fields_as_text" to mapOf(
                    "path_match" to "content.*",
                    "match_mapping_type" to "string",
                    "mapping" to mapOf(
                        "type" to "text",
                        "fields" to mapOf("keyword" to mapOf("type" to "keyword", "ignore_above" to 256))
                    )
                ))
            )
            annotatedMapping["dynamic_templates"] = dynamicTemplates
            indexOps.putMapping(annotatedMapping)

            addToReadAlias(name)
            logger.info { "Created OpenSearch index '$name' for definition '$definitionKey' and joined it to '${OpenSearchIndexNameResolver.READ_ALIAS}'" }
        }
    }

    private fun addToReadAlias(indexName: String) {
        val add = AliasAction.Add(
            AliasActionParameters.builder()
                .withIndices(indexName)
                .withAliases(OpenSearchIndexNameResolver.READ_ALIAS)
                .build()
        )
        elasticsearchOperations.indexOps(IndexCoordinates.of(indexName)).alias(AliasActions(add))
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
