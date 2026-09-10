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
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.assistant.service.AttachmentTextExtractor
import com.ritense.assistant.web.rest.dto.PageContext
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.domain.impl.JsonSchemaRelatedFile
import com.ritense.document.service.DocumentService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.security.access.AccessDeniedException
import java.io.ByteArrayInputStream
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class CaseAttachmentToolsTest {

    private lateinit var documentService: DocumentService
    private lateinit var textExtractor: AttachmentTextExtractor
    private lateinit var objectMapper: ObjectMapper
    private lateinit var resourceProvider: ResourceContentProvider
    private lateinit var caseAttachmentTools: CaseAttachmentTools

    @BeforeEach
    fun setUp() {
        documentService = mock()
        textExtractor = mock()
        objectMapper = jacksonObjectMapper()
        resourceProvider = mock()

        caseAttachmentTools = CaseAttachmentTools(
            documentService,
            textExtractor,
            objectMapper,
            resourceProvider,
            null
        )
    }

    @Test
    fun `listCaseAttachments should return message when no document id`() {
        val result = caseAttachmentTools.listCaseAttachments(null)

        assertEquals("No document ID provided and not viewing a case.", result)
    }

    @Test
    fun `listCaseAttachments should return message when document not found`() {
        val docId = UUID.randomUUID()
        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.empty())

        val result = caseAttachmentTools.listCaseAttachments(docId.toString())

        assertEquals("Document not found or access denied.", result)
    }

    @Test
    fun `listCaseAttachments should return message when access denied`() {
        val docId = UUID.randomUUID()
        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenThrow(AccessDeniedException("Denied"))

        val result = caseAttachmentTools.listCaseAttachments(docId.toString())

        assertEquals("Document not found or access denied.", result)
    }

    @Test
    fun `listCaseAttachments should return attachments from document`() {
        val docId = UUID.randomUUID()
        val fileId = UUID.randomUUID()
        val document: JsonSchemaDocument = mock()
        val relatedFile = JsonSchemaRelatedFile(
            fileId,
            "test.pdf",
            1024L,
            LocalDateTime.now(),
            "user@test.com"
        )

        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.of(document))
        whenever(document.relatedFiles()).thenReturn(setOf(relatedFile))

        val result = caseAttachmentTools.listCaseAttachments(docId.toString())

        assertTrue(result.contains("test.pdf"))
        assertTrue(result.contains(fileId.toString()))
        assertTrue(result.contains("\"source\" : \"s3\""))
    }

    @Test
    fun `readAttachmentContent should return extracted text`() {
        val docId = UUID.randomUUID()
        val fileId = UUID.randomUUID()
        val document: JsonSchemaDocument = mock()

        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.of(document))
        whenever(resourceProvider.getContent(fileId)).thenReturn(
            AttachmentContent(
                inputStream = ByteArrayInputStream("test content".toByteArray()),
                fileName = "test.txt",
                mimeType = "text/plain",
                sizeInBytes = 12L
            )
        )
        whenever(textExtractor.extractText(any(), any(), any())).thenReturn("Extracted text content")

        val result = caseAttachmentTools.readAttachmentContent(docId.toString(), fileId.toString(), "s3", null)

        assertEquals("Extracted text content", result)
    }

    @Test
    fun `readAttachmentContent should return message when file too large`() {
        val docId = UUID.randomUUID()
        val fileId = UUID.randomUUID()
        val document: JsonSchemaDocument = mock()

        val tools = CaseAttachmentTools(
            documentService,
            textExtractor,
            objectMapper,
            resourceProvider,
            null,
            100L
        )

        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.of(document))
        whenever(resourceProvider.getContent(fileId)).thenReturn(
            AttachmentContent(
                inputStream = ByteArrayInputStream("test content".toByteArray()),
                fileName = "test.txt",
                mimeType = "text/plain",
                sizeInBytes = 200L
            )
        )

        val result = tools.readAttachmentContent(docId.toString(), fileId.toString(), "s3", null)

        assertTrue(result.contains("File too large"))
    }

    @Test
    fun `readAttachmentContent should use document id from page context`() {
        val docId = UUID.randomUUID()
        val fileId = UUID.randomUUID()
        val document: JsonSchemaDocument = mock()

        ToolContextHolder.withContext(
            ToolContext(
                userId = "user",
                userEmail = "user@test.com",
                userRoles = setOf("ROLE_USER"),
                authToken = "token",
                sessionId = UUID.randomUUID(),
                pageContext = PageContext(page = "case-detail", resourceId = docId.toString())
            )
        ) {
            whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.of(document))
            whenever(resourceProvider.getContent(fileId)).thenReturn(
                AttachmentContent(
                    inputStream = ByteArrayInputStream("test".toByteArray()),
                    fileName = "test.txt",
                    mimeType = "text/plain",
                    sizeInBytes = 4L
                )
            )
            whenever(textExtractor.extractText(any(), any(), any())).thenReturn("Text")

            val result = caseAttachmentTools.readAttachmentContent(null, fileId.toString(), "s3", null)

            assertEquals("Text", result)
        }
    }
}
