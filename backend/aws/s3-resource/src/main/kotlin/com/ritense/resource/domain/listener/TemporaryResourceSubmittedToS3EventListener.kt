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

package com.ritense.resource.domain.listener

import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.resource.domain.TemporaryResourceSubmittedEvent
import com.ritense.resource.service.S3Service
import com.ritense.resource.service.TemporaryResourceStorageService
import com.ritense.resource.service.request.TempResourceFileUploadRequest
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.event.EventListener
import java.util.UUID

class TemporaryResourceSubmittedToS3EventListener(
    private val temporaryResourceStorageService: TemporaryResourceStorageService,
    private val s3Service: S3Service,
    private val documentService: DocumentService
) {

    init {
        logger.info { "TemporaryResourceSubmittedToS3EventListener bean created" }
    }

    @EventListener(TemporaryResourceSubmittedEvent::class)
    fun handle(event: TemporaryResourceSubmittedEvent) {
        logger.info { "Handling TemporaryResourceSubmittedEvent for resource '${event.resourceId}' to document '${event.documentId}'" }

        try {
            val metadata = temporaryResourceStorageService.getResourceMetadata(event.resourceId)
            val inputStream = temporaryResourceStorageService.getResourceContentAsInputStream(event.resourceId)
            val fileUploadRequest = TempResourceFileUploadRequest.from(metadata, inputStream)

            val s3Key = buildS3Key(
                event.documentDefinitionName,
                event.documentId.toString(),
                fileUploadRequest.getName()
            )

            val s3Resource = s3Service.store(s3Key, fileUploadRequest)
            logger.info { "Stored resource '${event.resourceId}' to S3 with key '$s3Key'" }

            documentService.assignResource(
                JsonSchemaDocumentId.existingId(event.documentId),
                s3Resource.id(),
                metadata
            )
            logger.info { "Linked S3 resource '${s3Resource.id()}' to document '${event.documentId}'" }

            val deleted = temporaryResourceStorageService.deleteResource(event.resourceId)
            if (deleted) {
                logger.debug { "Deleted temporary resource '${event.resourceId}'" }
            } else {
                logger.warn { "Failed to delete temporary resource '${event.resourceId}'" }
            }
        } catch (e: Exception) {
            logger.error(e) {
                "Failed to transfer temporary resource '${event.resourceId}' to S3 for document '${event.documentId}'"
            }
            throw e
        }
    }

    private fun buildS3Key(
        documentDefinitionName: String,
        documentId: String,
        filename: String
    ): String {
        val uniqueFilename = "${UUID.randomUUID()}-$filename"
        return "$documentDefinitionName/$documentId/$uniqueFilename"
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
