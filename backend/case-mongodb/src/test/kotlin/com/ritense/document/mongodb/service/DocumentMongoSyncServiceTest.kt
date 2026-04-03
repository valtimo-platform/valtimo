/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.document.mongodb.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.document.mongodb.domain.JsonSchemaDocumentDocument
import com.ritense.document.mongodb.repository.JsonSchemaDocumentMongoRepository
import com.ritense.inbox.ValtimoEvent
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.kotlin.any
import org.mockito.kotlin.capture
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.LocalDateTime

class DocumentMongoSyncServiceTest {

    private val repository: JsonSchemaDocumentMongoRepository = mock()
    private val objectMapper: ObjectMapper = mock()
    private lateinit var service: DocumentMongoSyncService

    @BeforeEach
    fun setUp() {
        service = DocumentMongoSyncService(repository, objectMapper)
    }

    @Test
    fun `upsert with null result skips repository save`() {
        val event = valtimoEvent(result = null)

        service.upsert(event)

        verify(repository, never()).save(any())
    }

    @Test
    fun `upsert populates contentText with leaf values from content`() {
        val realMapper = ObjectMapper()
        val content = realMapper.createObjectNode().apply {
            put("firstName", "John")
            put("city", "Amsterdam")
        }
        val docDocument = buildDocument(id = "test-id", content = content)
        val event = valtimoEvent(result = realMapper.createObjectNode())
        whenever(objectMapper.treeToValue(any(), any<Class<JsonSchemaDocumentDocument>>())).thenReturn(docDocument)

        val captor = ArgumentCaptor.forClass(JsonSchemaDocumentDocument::class.java)
        service.upsert(event)
        verify(repository).save(capture(captor))

        val saved = captor.value
        assertThat(saved.contentText).contains("John")
        assertThat(saved.contentText).contains("Amsterdam")
    }

    @Test
    fun `upsert with null content stores null contentText`() {
        val realMapper = ObjectMapper()
        val docDocument = buildDocument(id = "no-content-id", content = null)
        val event = valtimoEvent(result = realMapper.createObjectNode())
        whenever(objectMapper.treeToValue(any(), any<Class<JsonSchemaDocumentDocument>>())).thenReturn(docDocument)

        val captor = ArgumentCaptor.forClass(JsonSchemaDocumentDocument::class.java)
        service.upsert(event)
        verify(repository).save(capture(captor))

        assertThat(captor.value.contentText).isNull()
    }

    @Test
    fun `upsert with nested content extracts all leaf values`() {
        val realMapper = ObjectMapper()
        val content = realMapper.createObjectNode().apply {
            putObject("address").apply {
                put("street", "Main Street")
                put("number", "42")
            }
        }
        val docDocument = buildDocument(id = "nested-id", content = content)
        val event = valtimoEvent(result = realMapper.createObjectNode())
        whenever(objectMapper.treeToValue(any(), any<Class<JsonSchemaDocumentDocument>>())).thenReturn(docDocument)

        val captor = ArgumentCaptor.forClass(JsonSchemaDocumentDocument::class.java)
        service.upsert(event)
        verify(repository).save(capture(captor))

        val contentText = captor.value.contentText
        assertThat(contentText).contains("Main Street")
        assertThat(contentText).contains("42")
    }

    private fun buildDocument(
        id: String,
        content: com.fasterxml.jackson.databind.node.ObjectNode?,
    ) = JsonSchemaDocumentDocument(
        id = id,
        content = content,
        definitionId = null,
        createdOn = null,
        modifiedOn = null,
        createdBy = null,
        sequence = null,
        version = null,
        assigneeId = null,
        assigneeFullName = null,
        internalStatus = null,
        caseTags = null,
        relations = null,
        relatedFiles = null,
        retentionDate = null,
    )

    private fun valtimoEvent(
        result: com.fasterxml.jackson.databind.node.ContainerNode<*>?,
    ) = ValtimoEvent(
        id = "event-id",
        type = "DOCUMENT_CREATED",
        date = LocalDateTime.now(),
        userId = null,
        roles = null,
        resultType = null,
        resultId = "doc-id",
        result = result,
    )
}
