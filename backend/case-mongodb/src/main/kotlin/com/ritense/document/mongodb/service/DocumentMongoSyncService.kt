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

package com.ritense.document.mongodb.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.document.mongodb.domain.JsonSchemaDocumentDocument
import com.ritense.document.mongodb.repository.JsonSchemaDocumentMongoRepository
import com.ritense.inbox.ValtimoEvent
import io.github.oshai.kotlinlogging.KotlinLogging

class DocumentMongoSyncService(
    private val repository: JsonSchemaDocumentMongoRepository,
    private val objectMapper: ObjectMapper,
) {

    fun upsert(event: ValtimoEvent) {
        val result = event.result
        if (result == null) {
            logger.warn { "Received document event ${event.type} for id=${event.resultId} with null result — skipping upsert" }
            return
        }
        val doc = objectMapper.treeToValue(result, JsonSchemaDocumentDocument::class.java)
        repository.save(doc.copy(contentText = extractLeafValues(doc.content)))
        logger.debug { "Upserted document ${doc.id} in MongoDB (event: ${event.type})" }
    }

    fun delete(documentId: String) {
        repository.deleteById(documentId)
        logger.debug { "Deleted document $documentId from MongoDB" }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
