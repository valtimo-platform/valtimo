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

import com.ritense.authorization.AuthorizationService
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.authentication.ManageableUser
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.event.OperatonTaskEvent
import com.ritense.valtimo.operaton.domain.OperatonTask
import com.ritense.valtimo.operaton.repository.OperatonTaskRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.TaskService
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.delegate.DelegateTask
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals

class CaseAssigneeTaskCreatedListenerTest {

    private val taskService: TaskService = mock()
    private val documentService: DocumentService = mock()
    private val caseDefinitionService: CaseDefinitionService = mock()
    private val userManagementService: UserManagementService = mock()
    private val caseDocumentResolver: CaseDocumentResolver = mock()
    private val authorizationService: AuthorizationService = mock()
    private val operatonTaskRepository: OperatonTaskRepository = mock()

    private val listener = CaseAssigneeTaskCreatedListener(
        taskService,
        documentService,
        caseDefinitionService,
        userManagementService,
        caseDocumentResolver,
        authorizationService,
        operatonTaskRepository
    )

    private val documentId: UUID = UUID.randomUUID()
    private val caseDefinitionId = CaseDefinitionId("house", "1.0.0")
    private val assigneeUsername = "test.user"

    private lateinit var caseDocument: JsonSchemaDocument

    @BeforeEach
    fun setUp() {
        TransactionSynchronizationManager.initSynchronization()

        whenever(caseDocumentResolver.resolveCaseDocumentId(documentId)).thenReturn(documentId)

        val documentDefinitionId = mock<JsonSchemaDocumentDefinitionId>()
        whenever(documentDefinitionId.caseDefinitionId()).thenReturn(caseDefinitionId)

        caseDocument = mock()
        whenever(caseDocument.definitionId()).thenReturn(documentDefinitionId)
        whenever(caseDocument.assigneeId()).thenReturn(assigneeUsername)
        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.of(caseDocument))
        whenever(caseDefinitionService.getCaseDefinition(caseDefinitionId)).thenReturn(
            CaseDefinition(
                id = caseDefinitionId,
                name = "house",
                createdDate = null,
                canHaveAssignee = true,
                autoAssignTasks = true
            )
        )
        whenever(operatonTaskRepository.findById("task-123")).thenReturn(Optional.of(mock<OperatonTask>()))
    }

    @AfterEach
    fun tearDown() {
        TransactionSynchronizationManager.clearSynchronization()
    }

    @Test
    fun `should assign the created task to the case assignee`() {
        val assignee = mock<ManageableUser>()
        whenever(assignee.username).thenReturn(assigneeUsername)
        whenever(userManagementService.findByUsername(assigneeUsername)).thenReturn(assignee)

        listener.notify(OperatonTaskEvent(mockDelegateTask(), "create"))
        triggerBeforeCommit()

        verify(taskService).setAssignee("task-123", assigneeUsername)
    }

    @Test
    fun `should leave the created task unassigned when the case assignee no longer exists`() {
        whenever(userManagementService.findByUsername(assigneeUsername)).thenReturn(null)

        listener.notify(OperatonTaskEvent(mockDelegateTask(), "create"))

        assertEquals(0, TransactionSynchronizationManager.getSynchronizations().size)
        verify(authorizationService, never()).requirePermission<Any>(any())
        verify(taskService, never()).setAssignee(any(), any())
    }

    private fun triggerBeforeCommit() {
        TransactionSynchronizationManager.getSynchronizations().forEach { it.beforeCommit(false) }
    }

    private fun mockDelegateTask(): DelegateTask {
        val execution = mock<DelegateExecution>()
        whenever(execution.businessKey).thenReturn(documentId.toString())
        val delegateTask = mock<DelegateTask>()
        whenever(delegateTask.id).thenReturn("task-123")
        whenever(delegateTask.execution).thenReturn(execution)
        return delegateTask
    }
}
