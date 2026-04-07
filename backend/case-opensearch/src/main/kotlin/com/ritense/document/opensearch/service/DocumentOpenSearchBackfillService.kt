/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.opensearch.repository.JsonSchemaDocumentOpenSearchRepository
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.domain.PageRequest
import org.springframework.transaction.annotation.Transactional

open class DocumentOpenSearchBackfillService(
    private val jpaRepository: JsonSchemaDocumentRepository,
    private val openSearchRepository: JsonSchemaDocumentOpenSearchRepository,
    private val objectMapper: ObjectMapper,
) {

    /**
     * Copies all existing [JsonSchemaDocument] rows from the relational database to OpenSearch.
     * Processes documents in pages of [pageSize] to avoid loading the entire table into memory.
     *
     * @return total number of documents migrated
     */
    @Transactional(readOnly = true)
    open fun backfill(pageSize: Int = DEFAULT_PAGE_SIZE): Long {
        var page = 0
        var total = 0L
        do {
            val slice = runWithoutAuthorization { jpaRepository.findAll(PageRequest.of(page++, pageSize)) }
            if (slice.isEmpty) break

            val docs = mutableListOf<JsonSchemaDocumentOsDocument>()
            for (jpaDoc in slice.content) {
                try {
                    val tree = objectMapper.valueToTree<com.fasterxml.jackson.databind.JsonNode>(jpaDoc)
                    val doc = objectMapper.treeToValue(tree, JsonSchemaDocumentOsDocument::class.java)
                    docs.add(doc.copy(contentText = extractLeafValues(tree.get("content"))))
                } catch (e: Exception) {
                    logger.warn(e) { "Failed to convert document to OpenSearch document — skipping" }
                }
            }
            openSearchRepository.saveAll(docs)
            total += docs.size
            logger.debug { "Backfilled page ${page - 1}: ${docs.size} documents (total so far: $total)" }
        } while (slice.hasNext())

        logger.info { "Backfill complete: $total documents migrated to OpenSearch" }
        return total
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        const val DEFAULT_PAGE_SIZE = 500
    }
}
