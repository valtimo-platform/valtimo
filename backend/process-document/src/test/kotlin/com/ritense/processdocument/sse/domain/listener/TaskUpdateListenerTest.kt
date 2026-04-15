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

package com.ritense.processdocument.sse.domain.listener

import com.ritense.document.domain.Document
import com.ritense.document.domain.DocumentDefinition
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processdocument.sse.event.TaskUpdateSseEvent
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.contract.event.TaskTeamAssignedEvent
import com.ritense.valtimo.operaton.domain.OperatonTask
import com.ritense.valtimo.service.OperatonTaskService
import com.ritense.valtimo.web.sse.service.SseSubscriptionService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.spring.boot.starter.event.TaskEvent
import java.util.UUID
import kotlin.test.assertEquals

class TaskUpdateListenerTest {

    lateinit var sseSubscriptionService: SseSubscriptionService
    lateinit var processDocumentService: ProcessDocumentService
    lateinit var caseDocumentResolver: CaseDocumentResolver
    lateinit var documentService: DocumentService
    lateinit var operatonTaskService: OperatonTaskService
    lateinit var taskUpdateListener: TaskUpdateListener

    @BeforeEach
    fun setUp() {
        sseSubscriptionService = mock()
        processDocumentService = mock()
        caseDocumentResolver = mock()
        documentService = mock()
        operatonTaskService = mock()
        taskUpdateListener = TaskUpdateListener(
            sseSubscriptionService,
            processDocumentService,
            caseDocumentResolver,
            documentService,
            operatonTaskService,
        )
    }

    @Test
    fun `should send SSE event with case document id for case task`() {
        val caseDocumentId = UUID.randomUUID()
        val taskId = UUID.randomUUID().toString()
        val processInstanceId = UUID.randomUUID().toString()
        val caseDefinitionKey = "house"

        val taskEvent = mock<TaskEvent>()
        whenever(taskEvent.id).thenReturn(taskId)
        whenever(taskEvent.processInstanceId).thenReturn(processInstanceId)

        val document = mockDocument(caseDocumentId, caseDefinitionKey)
        whenever(processDocumentService.getDocument(any(), anyOrNull())).thenReturn(document)
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)

        taskUpdateListener.handle(taskEvent)

        val eventCaptor = argumentCaptor<TaskUpdateSseEvent>()
        verify(sseSubscriptionService).notifySubscribers(eventCaptor.capture())

        val event = eventCaptor.firstValue
        assertEquals(taskId, event.taskId)
        assertEquals(caseDocumentId.toString(), event.documentId)
        assertEquals(caseDefinitionKey, event.caseDefinitionKey)
    }

    @Test
    fun `should send SSE event with case document id for building block task`() {
        val bbDocumentId = UUID.randomUUID()
        val caseDocumentId = UUID.randomUUID()
        val taskId = UUID.randomUUID().toString()
        val processInstanceId = UUID.randomUUID().toString()
        val bbDefinitionKey = "bezwaar"
        val caseDefinitionKey = "house"

        val taskEvent = mock<TaskEvent>()
        whenever(taskEvent.id).thenReturn(taskId)
        whenever(taskEvent.processInstanceId).thenReturn(processInstanceId)

        val bbDocument = mockDocument(bbDocumentId, bbDefinitionKey)
        val caseDocument = mockDocument(caseDocumentId, caseDefinitionKey)
        whenever(processDocumentService.getDocument(any(), anyOrNull())).thenReturn(bbDocument)
        whenever(caseDocumentResolver.resolveCaseDocumentId(bbDocumentId)).thenReturn(caseDocumentId)
        whenever(documentService[caseDocumentId.toString()]).thenReturn(caseDocument)

        taskUpdateListener.handle(taskEvent)

        val eventCaptor = argumentCaptor<TaskUpdateSseEvent>()
        verify(sseSubscriptionService).notifySubscribers(eventCaptor.capture())

        val event = eventCaptor.firstValue
        assertEquals(taskId, event.taskId)
        assertEquals(caseDocumentId.toString(), event.documentId)
        assertEquals(caseDefinitionKey, event.caseDefinitionKey)
    }

    @Test
    fun `should send SSE event when team is assigned to task`() {
        val caseDocumentId = UUID.randomUUID()
        val taskId = UUID.randomUUID().toString()
        val processInstanceId = UUID.randomUUID().toString()
        val caseDefinitionKey = "house"

        val task = mock<OperatonTask>()
        whenever(task.getProcessInstanceId()).thenReturn(processInstanceId)
        whenever(operatonTaskService.findTaskById(taskId)).thenReturn(task)

        val document = mockDocument(caseDocumentId, caseDefinitionKey)
        whenever(processDocumentService.getDocument(any(), anyOrNull())).thenReturn(document)
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)

        val event = TaskTeamAssignedEvent(taskId, null, null, "INTAKE_TEAM", "Intake Team")
        taskUpdateListener.handleTeamAssignment(event)

        val eventCaptor = argumentCaptor<TaskUpdateSseEvent>()
        verify(sseSubscriptionService).notifySubscribers(eventCaptor.capture())

        val sseEvent = eventCaptor.firstValue
        assertEquals(taskId, sseEvent.taskId)
        assertEquals(caseDocumentId.toString(), sseEvent.documentId)
        assertEquals(caseDefinitionKey, sseEvent.caseDefinitionKey)
    }

    @Test
    fun `should send SSE event when team is unassigned from task`() {
        val caseDocumentId = UUID.randomUUID()
        val taskId = UUID.randomUUID().toString()
        val processInstanceId = UUID.randomUUID().toString()
        val caseDefinitionKey = "house"

        val task = mock<OperatonTask>()
        whenever(task.getProcessInstanceId()).thenReturn(processInstanceId)
        whenever(operatonTaskService.findTaskById(taskId)).thenReturn(task)

        val document = mockDocument(caseDocumentId, caseDefinitionKey)
        whenever(processDocumentService.getDocument(any(), anyOrNull())).thenReturn(document)
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)

        val event = TaskTeamAssignedEvent(taskId, "INTAKE_TEAM", "Intake Team", null, null)
        taskUpdateListener.handleTeamAssignment(event)

        val eventCaptor = argumentCaptor<TaskUpdateSseEvent>()
        verify(sseSubscriptionService).notifySubscribers(eventCaptor.capture())

        val sseEvent = eventCaptor.firstValue
        assertEquals(taskId, sseEvent.taskId)
        assertEquals(caseDocumentId.toString(), sseEvent.documentId)
        assertEquals(caseDefinitionKey, sseEvent.caseDefinitionKey)
    }

    private fun mockDocument(documentId: UUID, definitionName: String): Document {
        val docId = mock<Document.Id>()
        whenever(docId.id).thenReturn(documentId)
        whenever(docId.toString()).thenReturn(documentId.toString())

        val definitionId = mock<DocumentDefinition.Id>()
        whenever(definitionId.name()).thenReturn(definitionName)

        val document = mock<Document>()
        whenever(document.id()).thenReturn(docId)
        whenever(document.definitionId()).thenReturn(definitionId)
        return document
    }
}