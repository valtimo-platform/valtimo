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
 * Creates the OpenSearch index and mappings if they do not yet exist. Invoked before the engine toggle
 * switches to OpenSearch — failure prevents the swap, keeping queries on Postgres until the cluster is healthy.
 * [ensureIndex] is idempotent, so repeated calls are safe.
 */
open class DocumentOpenSearchIndexInitializer(
    private val elasticsearchOperations: ElasticsearchOperations,
) {

    open fun ensureIndex() {
        val indexOps = elasticsearchOperations.indexOps(JsonSchemaDocumentOsDocument::class.java)
        if (!indexOps.exists()) {
            val settings = Document.create()
            settings["index.number_of_replicas"] = 0
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
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}