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

import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.document.Document

/**
 * Creates the OpenSearch index and mappings if they do not yet exist. This is the only place that
 * provisions the index, and it is invoked exactly when OpenSearch becomes the active engine — at startup
 * when the engine is already active, and from [com.ritense.document.opensearch.web.SearchEngineResource]
 * the moment the engine is switched on at runtime — so a freshly enabled cluster is prepared on demand
 * rather than being touched unconditionally on every boot.
 *
 * All failures are swallowed with a warning: a missing/unreachable cluster must never break startup or the
 * toggle endpoint. [ensureIndex] is idempotent, so repeated calls (startup + later switch-ons) are safe.
 */
open class DocumentOpenSearchIndexInitializer(
    private val elasticsearchOperations: ElasticsearchOperations,
) {

    open fun ensureIndex() {
        try {
            val indexOps = elasticsearchOperations.indexOps(JsonSchemaDocumentOsDocument::class.java)
            if (!indexOps.exists()) {
                val settings = Document.create()
                settings["index.number_of_replicas"] = 0
                indexOps.create(settings)

                // Merge annotated mapping with a dynamic template that forces all
                // content.* fields to text+keyword — enables wildcard search on numbers too
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
            }
        } catch (e: Exception) {
            logger.warn(e) { "Failed to initialize OpenSearch index — is OpenSearch running?" }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}