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

package com.ritense.processdocument.listener

import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.event.DocumentAssigneeChangedEvent
import com.ritense.document.event.DocumentUnassignedEvent
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.valtimo.contract.authentication.Team
import com.ritense.valtimo.contract.authentication.TeamManagementService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.event.OperatonTaskEvent
import com.ritense.valtimo.operaton.domain.OperatonTask
import com.ritense.valtimo.service.OperatonTaskService
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.delegate.DelegateTask
import org.operaton.bpm.engine.task.IdentityLink
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID

class CaseTaskTeamAutoAssignListenerTest {

    private val operatonTaskService: OperatonTaskService = mock()
    private val documentService: DocumentService = mock()
    private val caseDefinitionService: CaseDefinitionService = mock()
    private val processDocumentService: ProcessDocumentService = mock()
    private val teamManagementService: TeamManagementService = mock()
    private val caseDocumentResolver: CaseDocumentResolver = mock()

    private lateinit var listener: CaseTaskTeamAutoAssignListener

    private val documentId: UUID = UUID.randomUUID()
    private val caseDocumentId: UUID = UUID.randomUUID()
    private val caseDefinitionId = CaseDefinitionId("house", "1.0.0")
    private lateinit var jsonSchemaDocumentId: JsonSchemaDocumentId

    private lateinit var caseDocument: JsonSchemaDocument

    @BeforeEach
    fun setUp() {
        TransactionSynchronizationManager.initSynchronization()

        listener = CaseTaskTeamAutoAssignListener(
            operatonTaskService,
            documentService,
            caseDefinitionService,
            processDocumentService,
            teamManagementService,
            caseDocumentResolver
        )

        whenever(caseDocumentResolver.resolveCaseDocumentId(any())).thenReturn(documentId)

        jsonSchemaDocumentId = JsonSchemaDocumentId.existingId(documentId)

        val docId = mock<JsonSchemaDocumentId>()
        whenever(docId.toString()).thenReturn(caseDocumentId.toString())

        val documentDefinitionId = mock<JsonSchemaDocumentDefinitionId>()
        whenever(documentDefinitionId.caseDefinitionId()).thenReturn(caseDefinitionId)
        whenever(documentDefinitionId.name()).thenReturn("house")

        caseDocument = mock()
        whenever(caseDocument.id()).thenReturn(docId)
        whenever(caseDocument.definitionId()).thenReturn(documentDefinitionId)

        whenever(processDocumentService.getCaseDocument(any(), any())).thenReturn(caseDocument)
        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.of(caseDocument))
    }

    @AfterEach
    fun tearDown() {
        TransactionSynchronizationManager.clearSynchronization()
    }

    private fun triggerBeforeCommit() {
        TransactionSynchronizationManager.getSynchronizations().forEach { it.beforeCommit(false) }
    }

    private fun caseDefinitionWithSettings(canHaveAssignee: Boolean = true, autoAssignTasks: Boolean = canHaveAssignee) =
        CaseDefinition(
            id = caseDefinitionId,
            name = "house",
            createdDate = null,
            canHaveAssignee = canHaveAssignee,
            autoAssignTasks = autoAssignTasks
        )

    private fun mockDelegateTask(candidateGroupIds: List<String?>): DelegateTask {
        val delegateTask = mock<DelegateTask>()
        whenever(delegateTask.id).thenReturn("task-123")
        whenever(delegateTask.processInstanceId).thenReturn(UUID.randomUUID().toString())

        val execution = mock<DelegateExecution>()
        whenever(delegateTask.execution).thenReturn(execution)

        val identityLinks = candidateGroupIds.map { groupId ->
            val link = mock<IdentityLink>()
            whenever(link.groupId).thenReturn(groupId)
            link
        }.toSet()
        whenever(delegateTask.candidates).thenReturn(identityLinks)

        return delegateTask
    }

    private fun mockTeam(key: String, title: String): Team {
        return object : Team {
            override val key = key
            override val title = title
        }
    }

    // --- onTaskCreated ---

    @Test
    fun `should assign team when candidate group matches a team`() {
        whenever(caseDefinitionService.getCaseDefinition(any())).thenReturn(caseDefinitionWithSettings())
        whenever(caseDocument.assignedTeamKey()).thenReturn("INTAKE_TEAM")

        val delegateTask = mockDelegateTask(listOf("INTAKE_TEAM"))
        listener.assignTeamFromCandidateGroup(OperatonTaskEvent(delegateTask, "create"))
        triggerBeforeCommit()

        verify(operatonTaskService).assignTeamToTask("task-123", "INTAKE_TEAM")
    }

    @Test
    fun `should not assign team when assignedTeamKey does not match any candidate group`() {
        whenever(caseDefinitionService.getCaseDefinition(any())).thenReturn(caseDefinitionWithSettings())
        whenever(caseDocument.assignedTeamKey()).thenReturn("INTAKE_TEAM")

        val delegateTask = mockDelegateTask(listOf("ROLE_USER"))
        listener.assignTeamFromCandidateGroup(OperatonTaskEvent(delegateTask, "create"))

        verify(operatonTaskService, never()).assignTeamToTask(any(), any())
    }

    @Test
    fun `should assign team when assignedTeamKey matches one of multiple candidate groups`() {
        whenever(caseDefinitionService.getCaseDefinition(any())).thenReturn(caseDefinitionWithSettings())
        whenever(caseDocument.assignedTeamKey()).thenReturn("INTAKE_TEAM")

        val delegateTask = mockDelegateTask(listOf("ROLE_USER", "INTAKE_TEAM"))
        listener.assignTeamFromCandidateGroup(OperatonTaskEvent(delegateTask, "create"))
        triggerBeforeCommit()

        verify(operatonTaskService).assignTeamToTask("task-123", "INTAKE_TEAM")
    }

    @Test
    fun `should not assign team when canHaveAssignee is false`() {
        whenever(caseDefinitionService.getCaseDefinition(any()))
            .thenReturn(caseDefinitionWithSettings(canHaveAssignee = false))

        val delegateTask = mockDelegateTask(listOf("INTAKE_TEAM"))
        listener.assignTeamFromCandidateGroup(OperatonTaskEvent(delegateTask, "create"))

        verify(operatonTaskService, never()).assignTeamToTask(any(), any())
    }

    @Test
    fun `should not assign team when autoAssignTasks is false`() {
        whenever(caseDefinitionService.getCaseDefinition(any()))
            .thenReturn(caseDefinitionWithSettings(autoAssignTasks = false))

        val delegateTask = mockDelegateTask(listOf("INTAKE_TEAM"))
        listener.assignTeamFromCandidateGroup(OperatonTaskEvent(delegateTask, "create"))

        verify(operatonTaskService, never()).assignTeamToTask(any(), any())
    }

    @Test
    fun `should not assign team when teamManagementService is null`() {
        val listenerWithoutTeams = CaseTaskTeamAutoAssignListener(
            operatonTaskService, documentService, caseDefinitionService, processDocumentService, null, caseDocumentResolver
        )

        val delegateTask = mockDelegateTask(listOf("INTAKE_TEAM"))
        listenerWithoutTeams.assignTeamFromCandidateGroup(OperatonTaskEvent(delegateTask, "create"))

        verify(operatonTaskService, never()).assignTeamToTask(any(), any())
    }

    @Test
    fun `should not assign team when getCaseDocument returns null`() {
        whenever(processDocumentService.getCaseDocument(any(), any())).thenReturn(null)

        val delegateTask = mockDelegateTask(listOf("INTAKE_TEAM"))
        listener.assignTeamFromCandidateGroup(OperatonTaskEvent(delegateTask, "create"))

        verify(operatonTaskService, never()).assignTeamToTask(any(), any())
    }

    // --- onDocumentTeamAssigneeChanged ---

    @Test
    fun `should update team on existing tasks when document team assignee changes`() {
        whenever(caseDefinitionService.getCaseDefinition(any())).thenReturn(caseDefinitionWithSettings())
        whenever(caseDocument.assignedTeamKey()).thenReturn("INTAKE_TEAM")

        val task1 = mock<OperatonTask>()
        whenever(task1.id).thenReturn("task-1")
        val task2 = mock<OperatonTask>()
        whenever(task2.id).thenReturn("task-2")
        whenever(operatonTaskService.findTasks(any())).thenReturn(listOf(task1, task2))

        val event = DocumentAssigneeChangedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId, null, "Intake Team"
        )
        listener.updateTeamOnTasksForDocument(event)

        verify(operatonTaskService).assignTeamToTask("task-1", "INTAKE_TEAM")
        verify(operatonTaskService).assignTeamToTask("task-2", "INTAKE_TEAM")
    }

    @Test
    fun `should not update tasks when document has no team assignee`() {
        whenever(caseDefinitionService.getCaseDefinition(any())).thenReturn(caseDefinitionWithSettings())
        whenever(caseDocument.assignedTeamKey()).thenReturn(null)

        val event = DocumentAssigneeChangedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId, null
        )
        listener.updateTeamOnTasksForDocument(event)

        verify(operatonTaskService, never()).findTasks(any())
        verify(operatonTaskService, never()).assignTeamToTask(any(), any())
    }

    @Test
    fun `should not update tasks when autoAssignTasks is false on document team change`() {
        whenever(caseDefinitionService.getCaseDefinition(any()))
            .thenReturn(caseDefinitionWithSettings(autoAssignTasks = false))

        val event = DocumentAssigneeChangedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId, null, "Intake Team"
        )
        listener.updateTeamOnTasksForDocument(event)

        verify(operatonTaskService, never()).findTasks(any())
        verify(operatonTaskService, never()).assignTeamToTask(any(), any())
    }

    @Test
    fun `should not update tasks when teamManagementService is null on document team change`() {
        val listenerWithoutTeams = CaseTaskTeamAutoAssignListener(
            operatonTaskService, documentService, caseDefinitionService, processDocumentService, null, caseDocumentResolver
        )

        val event = DocumentAssigneeChangedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId, null, "Intake Team"
        )
        listenerWithoutTeams.updateTeamOnTasksForDocument(event)

        verify(operatonTaskService, never()).findTasks(any())
    }

    // --- onDocumentUnassigned (team removal) ---

    @Test
    fun `should remove team from tasks when document is unassigned`() {
        whenever(caseDefinitionService.getCaseDefinition(any())).thenReturn(caseDefinitionWithSettings())

        val task1 = mock<OperatonTask>()
        whenever(task1.id).thenReturn("task-1")
        val task2 = mock<OperatonTask>()
        whenever(task2.id).thenReturn("task-2")
        whenever(operatonTaskService.findTasks(any())).thenReturn(listOf(task1, task2))

        val event = DocumentUnassignedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId
        )
        listener.removeTeamFromTasksForDocument(event)

        verify(operatonTaskService).unassignTeamFromTask("task-1")
        verify(operatonTaskService).unassignTeamFromTask("task-2")
    }

    @Test
    fun `should not remove team from tasks when canHaveAssignee is false`() {
        whenever(caseDefinitionService.getCaseDefinition(any()))
            .thenReturn(caseDefinitionWithSettings(canHaveAssignee = false))

        val event = DocumentUnassignedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId
        )
        listener.removeTeamFromTasksForDocument(event)

        verify(operatonTaskService, never()).findTasks(any())
        verify(operatonTaskService, never()).unassignTeamFromTask(any())
    }

    @Test
    fun `should not remove team from tasks when autoAssignTasks is false`() {
        whenever(caseDefinitionService.getCaseDefinition(any()))
            .thenReturn(caseDefinitionWithSettings(autoAssignTasks = false))

        val event = DocumentUnassignedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId
        )
        listener.removeTeamFromTasksForDocument(event)

        verify(operatonTaskService, never()).findTasks(any())
        verify(operatonTaskService, never()).unassignTeamFromTask(any())
    }

    @Test
    fun `should not remove team from tasks when teamManagementService is null`() {
        val listenerWithoutTeams = CaseTaskTeamAutoAssignListener(
            operatonTaskService, documentService, caseDefinitionService, processDocumentService, null, caseDocumentResolver
        )

        val event = DocumentUnassignedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId
        )
        listenerWithoutTeams.removeTeamFromTasksForDocument(event)

        verify(operatonTaskService, never()).findTasks(any())
    }

    @Test
    fun `should not remove team from tasks when document is not found`() {
        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.empty())

        val event = DocumentUnassignedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId
        )
        listener.removeTeamFromTasksForDocument(event)

        verify(operatonTaskService, never()).findTasks(any())
        verify(operatonTaskService, never()).unassignTeamFromTask(any())
    }
}
