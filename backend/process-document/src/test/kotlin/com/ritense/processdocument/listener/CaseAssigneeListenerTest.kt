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

package com.ritense.processdocument.listener

import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.DelegateUserEntityAuthorizationRequest
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.Document
import com.ritense.document.domain.DocumentDefinition
import com.ritense.document.event.DocumentAssigneeChangedEvent
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.authentication.ManageableUser
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.document.CaseDocumentResolutionException
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.operaton.authorization.OperatonTaskActionProvider
import com.ritense.valtimo.operaton.domain.OperatonTask
import com.ritense.valtimo.service.OperatonTaskService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.access.AccessDeniedException
import java.time.LocalDateTime
import java.util.UUID
import kotlin.test.assertEquals

class CaseAssigneeListenerTest {

    private val operatonTaskService: OperatonTaskService = mock()
    private val documentService: DocumentService = mock()
    private val caseDefinitionService: CaseDefinitionService = mock()
    private val userManagementService: UserManagementService = mock()
    private val caseDocumentResolver: CaseDocumentResolver = mock()
    private val authorizationService: AuthorizationService = mock()

    private val listener = CaseAssigneeListener(
        operatonTaskService,
        documentService,
        caseDefinitionService,
        userManagementService,
        caseDocumentResolver,
        authorizationService,
    )

    private val documentId: UUID = UUID.randomUUID()
    private val caseDocumentId: UUID = UUID.randomUUID()
    private val assigneeId = "user-id-123"
    private val assigneeUsername = "test.user"
    private val assigneeRoles = listOf("ROLE_USER")

    private lateinit var assignee: ManageableUser
    private lateinit var caseDocument: Document

    @BeforeEach
    fun setUp() {
        assignee = mock()
        whenever(assignee.id).thenReturn(assigneeId)
        whenever(assignee.username).thenReturn(assigneeUsername)
        whenever(assignee.roles).thenReturn(assigneeRoles)

        val docId = mock<Document.Id>()
        whenever(docId.toString()).thenReturn(caseDocumentId.toString())

        val documentDefinitionId = mock<DocumentDefinition.Id>()
        whenever(documentDefinitionId.caseDefinitionId()).thenReturn(CaseDefinitionId("house", "1.0.0"))

        caseDocument = mock()
        whenever(caseDocument.id()).thenReturn(docId)
        whenever(caseDocument.definitionId()).thenReturn(documentDefinitionId)
        whenever(caseDocument.assigneeId()).thenReturn(assigneeUsername)

        whenever(caseDocumentResolver.resolveCaseDocumentId(documentId)).thenReturn(caseDocumentId)
        whenever(documentService[caseDocumentId.toString()]).thenReturn(caseDocument)
        whenever(userManagementService.findByUsername(assigneeUsername)).thenReturn(assignee)
    }

    private fun caseDefinitionWithSettings(canHaveAssignee: Boolean = true, autoAssignTasks: Boolean = true) =
        CaseDefinition(
            id = CaseDefinitionId("house", "1.0.0"),
            name = "house",
            createdDate = null,
            canHaveAssignee = canHaveAssignee,
            autoAssignTasks = autoAssignTasks
        )

    private fun assigneeChangedEvent() = DocumentAssigneeChangedEvent(
        UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId, assigneeUsername, null
    )

    // --- updateAssigneeOnTasks ---

    @Test
    fun `should assign task when assignee has ASSIGNABLE permission`() {
        val task = mock<OperatonTask>()
        whenever(task.id).thenReturn("task-id-1")
        whenever(caseDefinitionService.getCaseDefinition(any())).thenReturn(caseDefinitionWithSettings())
        whenever(operatonTaskService.findTasks(any())).thenReturn(listOf(task))

        listener.updateAssigneeOnTasks(assigneeChangedEvent())

        verify(operatonTaskService).autoAssign(task, assigneeUsername)
    }

    @Test
    fun `should check permission using delegate request with assignee username and ASSIGNABLE action`() {
        val task = mock<OperatonTask>()
        whenever(task.id).thenReturn("task-id-1")
        whenever(caseDefinitionService.getCaseDefinition(any())).thenReturn(caseDefinitionWithSettings())
        whenever(operatonTaskService.findTasks(any())).thenReturn(listOf(task))

        listener.updateAssigneeOnTasks(assigneeChangedEvent())

        val captor = argumentCaptor<DelegateUserEntityAuthorizationRequest<OperatonTask>>()
        verify(authorizationService).requirePermission(captor.capture())
        val request = captor.firstValue
        assertEquals(assigneeUsername, request.user)
        assertEquals(OperatonTaskActionProvider.ASSIGNABLE, request.action)
        assertEquals(OperatonTask::class.java, request.resourceType)
    }

    @Test
    fun `should not assign task when assignee lacks ASSIGNABLE permission`() {
        val task = mock<OperatonTask>()
        whenever(task.id).thenReturn("task-id-1")
        whenever(caseDefinitionService.getCaseDefinition(any())).thenReturn(caseDefinitionWithSettings())
        whenever(operatonTaskService.findTasks(any())).thenReturn(listOf(task))
        doThrow(AccessDeniedException("Unauthorized")).whenever(authorizationService).requirePermission<Any>(any())

        listener.updateAssigneeOnTasks(assigneeChangedEvent())

        verify(operatonTaskService, never()).autoAssign(any(), any())
    }

    @Test
    fun `should not check permissions or assign when no tasks match`() {
        whenever(caseDefinitionService.getCaseDefinition(any())).thenReturn(caseDefinitionWithSettings())
        whenever(operatonTaskService.findTasks(any())).thenReturn(emptyList())

        listener.updateAssigneeOnTasks(assigneeChangedEvent())

        verify(authorizationService, never()).requirePermission<Any>(any())
        verify(operatonTaskService, never()).autoAssign(any(), any())
    }

    @Test
    fun `should check permission and assign each task individually for multiple tasks`() {
        val task1 = mock<OperatonTask>()
        whenever(task1.id).thenReturn("task-id-1")
        val task2 = mock<OperatonTask>()
        whenever(task2.id).thenReturn("task-id-2")
        whenever(caseDefinitionService.getCaseDefinition(any())).thenReturn(caseDefinitionWithSettings())
        whenever(operatonTaskService.findTasks(any())).thenReturn(listOf(task1, task2))

        listener.updateAssigneeOnTasks(assigneeChangedEvent())

        verify(authorizationService, times(2)).requirePermission<OperatonTask>(any())
        verify(operatonTaskService).autoAssign(task1, assigneeUsername)
        verify(operatonTaskService).autoAssign(task2, assigneeUsername)
    }

    @Test
    fun `should assign first task but skip when second task lacks permission`() {
        val task1 = mock<OperatonTask>()
        whenever(task1.id).thenReturn("task-id-1")
        val task2 = mock<OperatonTask>()
        whenever(task2.id).thenReturn("task-id-2")
        whenever(caseDefinitionService.getCaseDefinition(any())).thenReturn(caseDefinitionWithSettings())
        whenever(operatonTaskService.findTasks(any())).thenReturn(listOf(task1, task2))
        doAnswer { }.doThrow(AccessDeniedException("Unauthorized"))
            .whenever(authorizationService).requirePermission<Any>(any())

        listener.updateAssigneeOnTasks(assigneeChangedEvent())

        verify(operatonTaskService).autoAssign(task1, assigneeUsername)
        verify(operatonTaskService, never()).autoAssign(eq(task2), any())
    }

    @Test
    fun `should do nothing when autoAssignTasks is false`() {
        whenever(caseDefinitionService.getCaseDefinition(any()))
            .thenReturn(caseDefinitionWithSettings(canHaveAssignee = true, autoAssignTasks = false))

        listener.updateAssigneeOnTasks(assigneeChangedEvent())

        verify(operatonTaskService, never()).findTasks(any())
        verify(authorizationService, never()).requirePermission<Any>(any())
        verify(operatonTaskService, never()).autoAssign(any(), any())
    }

    @Test
    fun `should do nothing when canHaveAssignee is false`() {
        whenever(caseDefinitionService.getCaseDefinition(any()))
            .thenReturn(caseDefinitionWithSettings(canHaveAssignee = false, autoAssignTasks = false))

        listener.updateAssigneeOnTasks(assigneeChangedEvent())

        verify(operatonTaskService, never()).findTasks(any())
        verify(authorizationService, never()).requirePermission<Any>(any())
        verify(operatonTaskService, never()).autoAssign(any(), any())
    }

    @Test
    fun `should handle CaseDocumentResolutionException gracefully without throwing`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(documentId))
            .thenThrow(CaseDocumentResolutionException("document not found"))

        listener.updateAssigneeOnTasks(assigneeChangedEvent())

        verify(operatonTaskService, never()).findTasks(any())
        verify(authorizationService, never()).requirePermission<Any>(any())
        verify(operatonTaskService, never()).autoAssign(any(), any())
    }
}
