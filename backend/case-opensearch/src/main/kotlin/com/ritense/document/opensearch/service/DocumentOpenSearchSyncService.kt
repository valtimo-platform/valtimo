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
import com.fasterxml.jackson.databind.node.ContainerNode
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.opensearch.repository.JsonSchemaDocumentOpenSearchRepository
import com.ritense.outbox.domain.BaseEvent
import io.github.oshai.kotlinlogging.KotlinLogging

class DocumentOpenSearchSyncService(
    private val repository: JsonSchemaDocumentOpenSearchRepository,
    private val objectMapper: ObjectMapper,
) {

    fun upsert(event: BaseEvent) {
        val result = event.result
        if (result == null) {
            logger.warn { "Received document event ${event.type} for id=${event.resultId} with null result — skipping upsert" }
            return
        }
        upsertFromResult(result, event.type)
    }

    private fun upsertFromResult(result: ContainerNode<*>, eventType: String) {
        val doc = objectMapper.treeToValue(result, JsonSchemaDocumentOsDocument::class.java)
        val contentText = extractLeafValues(result.get("content"))
        repository.save(doc.copy(contentText = contentText))
        logger.debug { "Upserted document ${doc.id} in OpenSearch (event: $eventType)" }
    }

    fun delete(documentId: String) {
        repository.deleteById(documentId)
        logger.debug { "Deleted document $documentId from OpenSearch" }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
