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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.document.opensearch.handler

import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.domain.impl.event.JsonSchemaDocumentCreatedEvent
import com.ritense.document.event.DocumentAssigneeChangedEvent
import com.ritense.document.event.DocumentRetentionPeriodSetEvent
import com.ritense.document.opensearch.service.DocumentOpenSearchSyncService
import com.ritense.document.opensearch.service.SearchEngineToggle
import com.ritense.valtimo.contract.event.DocumentDeletedEvent
import org.assertj.core.api.Assertions.assertThatCode
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.timeout
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.UUID

class DocumentOpenSearchEventListenerTest {

    private val syncService: DocumentOpenSearchSyncService = mock()
    private val toggle = SearchEngineToggle(SearchEngineToggle.Engine.OPENSEARCH)
    private lateinit var listener: DocumentOpenSearchEventListener

    @BeforeEach
    fun setUp() {
        listener = DocumentOpenSearchEventListener(syncService, toggle)
    }

    @AfterEach
    fun tearDown() {
        listener.destroy()
    }

    @Test
    fun `created event enqueues an upsert of the document id`() {
        val id = UUID.randomUUID()
        val event: JsonSchemaDocumentCreatedEvent = mock()
        whenever(event.documentId()).thenReturn(JsonSchemaDocumentId.existingId(id))

        listener.onCreated(event)

        verify(syncService, timeout(TIMEOUT_MS)).upsertById(id)
    }

    @Test
    fun `assignee-changed event enqueues an upsert of the document id`() {
        val id = UUID.randomUUID()
        val event: DocumentAssigneeChangedEvent = mock()
        whenever(event.documentId).thenReturn(id)

        listener.onAssigneeChanged(event)

        verify(syncService, timeout(TIMEOUT_MS)).upsertById(id)
    }

    @Test
    fun `retention-set event enqueues an upsert of the document id`() {
        val id = UUID.randomUUID()
        val event: DocumentRetentionPeriodSetEvent = mock()
        whenever(event.getDocumentId()).thenReturn(id)

        listener.onRetentionSet(event)

        verify(syncService, timeout(TIMEOUT_MS)).upsertById(id)
    }

    @Test
    fun `deleted event enqueues a delete of the document id`() {
        val id = UUID.randomUUID()

        listener.onDeleted(DocumentDeletedEvent(id))

        verify(syncService, timeout(TIMEOUT_MS)).delete(id)
    }

    @Test
    fun `no sync happens when the engine is toggled off`() {
        toggle.set(SearchEngineToggle.Engine.POSTGRES)
        val id = UUID.randomUUID()
        val event: JsonSchemaDocumentCreatedEvent = mock()
        whenever(event.documentId()).thenReturn(JsonSchemaDocumentId.existingId(id))

        // The engine gate is checked synchronously before the task is submitted, so no upsert is ever enqueued.
        listener.onCreated(event)

        verify(syncService, never()).upsertById(any())
    }

    @Test
    fun `a failing sync task never propagates to the caller`() {
        val id = UUID.randomUUID()
        val event: JsonSchemaDocumentCreatedEvent = mock()
        whenever(event.documentId()).thenReturn(JsonSchemaDocumentId.existingId(id))
        whenever(syncService.upsertById(any())).thenThrow(RuntimeException("OpenSearch is down"))

        assertThatCode { listener.onCreated(event) }.doesNotThrowAnyException()
        verify(syncService, timeout(TIMEOUT_MS)).upsertById(id)
    }

    companion object {
        private const val TIMEOUT_MS = 2000L
    }
}
