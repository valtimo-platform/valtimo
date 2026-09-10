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

package com.ritense.assistant.tool

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.assistant.service.AttachmentTextExtractor
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import dev.langchain4j.agent.tool.P
import dev.langchain4j.agent.tool.Tool
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.security.access.AccessDeniedException
import java.util.UUID

open class CaseAttachmentTools(
    private val documentService: DocumentService,
    private val textExtractor: AttachmentTextExtractor,
    private val objectMapper: ObjectMapper,
    private val resourceProvider: ResourceContentProvider?,
    private val zgwDocumentProvider: ZgwDocumentContentProvider?,
    private val maxFileSizeBytes: Long = DEFAULT_MAX_FILE_SIZE
) {
    private val logger = KotlinLogging.logger {}

    @Tool("List attachments for a case. Returns file names, sizes, and IDs you can use to read content.")
    fun listCaseAttachments(
        @P("Document ID (UUID). If omitted, uses current case from page context.") documentId: String?
    ): String {
        logger.info { "listCaseAttachments called with documentId=$documentId" }
        val docId = resolveDocumentId(documentId) ?: return "No document ID provided and not viewing a case."

        val document = getDocument(docId) ?: return "Document not found or access denied."

        val attachments = mutableListOf<Map<String, Any?>>()

        (document as? JsonSchemaDocument)?.relatedFiles()?.forEach { file ->
            attachments.add(mapOf(
                "id" to file.fileId.toString(),
                "name" to file.fileName,
                "sizeInBytes" to file.sizeInBytes,
                "createdOn" to file.createdOn?.toString(),
                "source" to "s3"
            ))
        }

        zgwDocumentProvider?.let { provider ->
            try {
                provider.listDocuments(docId).forEach { doc ->
                    attachments.add(mapOf(
                        "id" to doc.id,
                        "name" to doc.fileName,
                        "sizeInBytes" to doc.sizeInBytes,
                        "createdOn" to doc.createdOn,
                        "source" to "zgw",
                        "pluginConfigurationId" to doc.pluginConfigurationId,
                        "canView" to doc.canView
                    ))
                }
            } catch (e: AccessDeniedException) {
                logger.debug { "Access denied to ZGW documents for case $docId" }
            } catch (e: Exception) {
                logger.warn(e) { "Failed to list ZGW documents for case $docId" }
            }
        }

        if (attachments.isEmpty()) {
            return "No attachments found for this case."
        }

        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(attachments)
    }

    @Tool("Read text content from a case attachment. Extracts text from PDF, DOCX, TXT, etc.")
    fun readAttachmentContent(
        @P("Document ID (UUID). If omitted, uses current case from page context.") documentId: String?,
        @P("Attachment ID from listCaseAttachments result.") attachmentId: String,
        @P("Source type: 's3' or 'zgw'. Default 's3'.") source: String?,
        @P("Plugin configuration ID (required for ZGW documents).") pluginConfigurationId: String?
    ): String {
        logger.info { "readAttachmentContent called: documentId=$documentId, attachmentId=$attachmentId, source=$source" }
        val docId = resolveDocumentId(documentId) ?: return "No document ID provided and not viewing a case."

        getDocument(docId) ?: return "Document not found or access denied."

        val sourceType = source?.lowercase() ?: "s3"

        return when (sourceType) {
            "s3" -> readS3Attachment(attachmentId)
            "zgw" -> readZgwAttachment(docId, attachmentId, pluginConfigurationId)
            else -> "Unknown source type: $sourceType. Use 's3' or 'zgw'."
        }
    }

    private fun readS3Attachment(attachmentId: String): String {
        val provider = resourceProvider ?: return "S3 resource reading not available."

        val fileId = try {
            UUID.fromString(attachmentId)
        } catch (e: IllegalArgumentException) {
            return "Invalid attachment ID format."
        }

        return try {
            val content = provider.getContent(fileId)
            if (content == null) {
                return "Attachment not found."
            }

            if (content.sizeInBytes != null && content.sizeInBytes > maxFileSizeBytes) {
                return "File too large to extract (${content.sizeInBytes} bytes, max $maxFileSizeBytes)."
            }

            val text = content.inputStream.use { stream ->
                textExtractor.extractText(stream, content.fileName ?: attachmentId, content.mimeType)
            }

            text ?: "Could not extract text from this file type."
        } catch (e: AccessDeniedException) {
            "You don't have permission to view this attachment."
        } catch (e: Exception) {
            logger.warn(e) { "Failed to read S3 attachment $attachmentId" }
            "Error reading attachment: ${e.message}"
        }
    }

    private fun readZgwAttachment(docId: UUID, attachmentId: String, pluginConfigurationId: String?): String {
        val provider = zgwDocumentProvider ?: return "ZGW document reading not available."

        if (pluginConfigurationId == null) {
            return "Plugin configuration ID is required for ZGW documents."
        }

        return try {
            val content = provider.getContent(pluginConfigurationId, docId, attachmentId)
            if (content == null) {
                return "Attachment not found."
            }

            if (content.sizeInBytes != null && content.sizeInBytes > maxFileSizeBytes) {
                return "File too large to extract (${content.sizeInBytes} bytes, max $maxFileSizeBytes)."
            }

            val text = content.inputStream.use { stream ->
                textExtractor.extractText(stream, content.fileName ?: attachmentId, content.mimeType)
            }

            text ?: "Could not extract text from this file type."
        } catch (e: AccessDeniedException) {
            "You don't have permission to view this attachment."
        } catch (e: Exception) {
            logger.warn(e) { "Failed to read ZGW attachment $attachmentId" }
            "Error reading attachment: ${e.message}"
        }
    }

    private fun resolveDocumentId(documentId: String?): UUID? {
        if (documentId != null) {
            return try {
                UUID.fromString(documentId)
            } catch (e: IllegalArgumentException) {
                null
            }
        }

        val pageContext = ToolContextHolder.getOrNull()?.pageContext ?: return null
        if (pageContext.page == "case-detail" && pageContext.resourceId != null) {
            return try {
                UUID.fromString(pageContext.resourceId)
            } catch (e: IllegalArgumentException) {
                null
            }
        }
        return null
    }

    private fun getDocument(docId: UUID): JsonSchemaDocument? {
        return try {
            documentService.findBy(JsonSchemaDocumentId.existingId(docId))
                .orElse(null) as? JsonSchemaDocument
        } catch (e: AccessDeniedException) {
            logger.debug { "Access denied for document $docId" }
            null
        }
    }

    companion object {
        const val DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024L
    }
}

interface ResourceContentProvider {
    fun getContent(resourceId: UUID): AttachmentContent?
}

interface ZgwDocumentContentProvider {
    fun listDocuments(caseDocumentId: UUID): List<ZgwDocumentInfo>
    fun getContent(pluginConfigurationId: String, caseDocumentId: UUID, documentId: String): AttachmentContent?
}

data class AttachmentContent(
    val inputStream: java.io.InputStream,
    val fileName: String?,
    val mimeType: String?,
    val sizeInBytes: Long?
)

data class ZgwDocumentInfo(
    val id: String,
    val fileName: String?,
    val sizeInBytes: Long?,
    val createdOn: String?,
    val pluginConfigurationId: String,
    val canView: Boolean
)
