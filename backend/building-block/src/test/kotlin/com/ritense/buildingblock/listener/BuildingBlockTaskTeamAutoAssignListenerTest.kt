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

package com.ritense.buildingblock.listener

import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.event.DocumentAssigneeChangedEvent
import com.ritense.document.event.DocumentUnassignedEvent
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.authentication.TeamManagementService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.operaton.domain.OperatonTask
import com.ritense.valtimo.service.OperatonTaskService
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class BuildingBlockTaskTeamAutoAssignListenerTest {

    private val operatonTaskService: OperatonTaskService = mock()
    private val documentService: DocumentService = mock()
    private val caseDefinitionService: CaseDefinitionService = mock()
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository = mock()
    private val teamManagementService: TeamManagementService = mock()
    private val caseDocumentResolver: CaseDocumentResolver = mock()

    private lateinit var listener: BuildingBlockTaskTeamAutoAssignListener

    private val documentId: UUID = UUID.randomUUID()
    private val caseDocumentId: UUID = UUID.randomUUID()
    private val bbDocumentId1: UUID = UUID.randomUUID()
    private val bbDocumentId2: UUID = UUID.randomUUID()
    private val caseDefinitionId = CaseDefinitionId("house", "1.0.0")
    private lateinit var caseDocument: JsonSchemaDocument

    @BeforeEach
    fun setUp() {
        listener = BuildingBlockTaskTeamAutoAssignListener(
            operatonTaskService,
            documentService,
            caseDefinitionService,
            buildingBlockInstanceRepository,
            teamManagementService,
            caseDocumentResolver,
        )

        whenever(caseDocumentResolver.resolveCaseDocumentId(any())).thenReturn(caseDocumentId)

        val docId = mock<JsonSchemaDocumentId>()
        whenever(docId.id).thenReturn(caseDocumentId)
        whenever(docId.toString()).thenReturn(caseDocumentId.toString())

        val documentDefinitionId = mock<JsonSchemaDocumentDefinitionId>()
        whenever(documentDefinitionId.caseDefinitionId()).thenReturn(caseDefinitionId)

        caseDocument = mock()
        whenever(caseDocument.id()).thenReturn(docId)
        whenever(caseDocument.definitionId()).thenReturn(documentDefinitionId)

        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.of(caseDocument))

        val bbInstance1 = mock<BuildingBlockInstance>()
        whenever(bbInstance1.documentId).thenReturn(bbDocumentId1)
        val bbInstance2 = mock<BuildingBlockInstance>()
        whenever(bbInstance2.documentId).thenReturn(bbDocumentId2)
        whenever(buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId))
            .thenReturn(listOf(bbInstance1, bbInstance2))
    }

    private fun caseDefinitionWithSettings(canHaveAssignee: Boolean = true, autoAssignTasks: Boolean = canHaveAssignee) =
        CaseDefinition(
            id = caseDefinitionId,
            name = "house",
            createdDate = null,
            canHaveAssignee = canHaveAssignee,
            autoAssignTasks = autoAssignTasks
        )

    // --- updateTeamOnBuildingBlockTasks ---

    @Test
    fun `should assign team to building block tasks when team assignee changes`() {
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
        listener.updateTeamOnBuildingBlockTasks(event)

        verify(operatonTaskService).assignTeamToTask("task-1", "INTAKE_TEAM")
        verify(operatonTaskService).assignTeamToTask("task-2", "INTAKE_TEAM")
    }

    @Test
    fun `should not assign team when no building block instances exist`() {
        whenever(caseDefinitionService.getCaseDefinition(any())).thenReturn(caseDefinitionWithSettings())
        whenever(caseDocument.assignedTeamKey()).thenReturn("INTAKE_TEAM")
        whenever(buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId)).thenReturn(emptyList())

        val event = DocumentAssigneeChangedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId, null, "Intake Team"
        )
        listener.updateTeamOnBuildingBlockTasks(event)

        verify(operatonTaskService, never()).findTasks(any())
        verify(operatonTaskService, never()).assignTeamToTask(any(), any())
    }

    @Test
    fun `should not assign team when document has no team assignee`() {
        whenever(caseDefinitionService.getCaseDefinition(any())).thenReturn(caseDefinitionWithSettings())
        whenever(caseDocument.assignedTeamKey()).thenReturn(null)

        val event = DocumentAssigneeChangedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId, null
        )
        listener.updateTeamOnBuildingBlockTasks(event)

        verify(operatonTaskService, never()).findTasks(any())
        verify(operatonTaskService, never()).assignTeamToTask(any(), any())
    }

    @Test
    fun `should not assign team when canHaveAssignee is false`() {
        whenever(caseDefinitionService.getCaseDefinition(any()))
            .thenReturn(caseDefinitionWithSettings(canHaveAssignee = false))

        val event = DocumentAssigneeChangedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId, null, "Intake Team"
        )
        listener.updateTeamOnBuildingBlockTasks(event)

        verify(operatonTaskService, never()).findTasks(any())
        verify(operatonTaskService, never()).assignTeamToTask(any(), any())
    }

    @Test
    fun `should not assign team when autoAssignTasks is false`() {
        whenever(caseDefinitionService.getCaseDefinition(any()))
            .thenReturn(caseDefinitionWithSettings(autoAssignTasks = false))

        val event = DocumentAssigneeChangedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId, null, "Intake Team"
        )
        listener.updateTeamOnBuildingBlockTasks(event)

        verify(operatonTaskService, never()).findTasks(any())
        verify(operatonTaskService, never()).assignTeamToTask(any(), any())
    }

    @Test
    fun `should not assign team when teamManagementService is null`() {
        val listenerWithoutTeams = BuildingBlockTaskTeamAutoAssignListener(
            operatonTaskService, documentService, caseDefinitionService,
            buildingBlockInstanceRepository, null, caseDocumentResolver
        )

        val event = DocumentAssigneeChangedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId, null, "Intake Team"
        )
        listenerWithoutTeams.updateTeamOnBuildingBlockTasks(event)

        verify(operatonTaskService, never()).findTasks(any())
    }

    @Test
    fun `should not assign team when document is not found`() {
        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.empty())

        val event = DocumentAssigneeChangedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId, null, "Intake Team"
        )
        listener.updateTeamOnBuildingBlockTasks(event)

        verify(operatonTaskService, never()).findTasks(any())
        verify(operatonTaskService, never()).assignTeamToTask(any(), any())
    }

    // --- removeTeamFromBuildingBlockTasks ---

    @Test
    fun `should remove team from building block tasks when document is unassigned`() {
        whenever(caseDefinitionService.getCaseDefinition(any())).thenReturn(caseDefinitionWithSettings())

        val task1 = mock<OperatonTask>()
        whenever(task1.id).thenReturn("task-1")
        val task2 = mock<OperatonTask>()
        whenever(task2.id).thenReturn("task-2")
        whenever(operatonTaskService.findTasks(any())).thenReturn(listOf(task1, task2))

        val event = DocumentUnassignedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId
        )
        listener.removeTeamFromBuildingBlockTasks(event)

        verify(operatonTaskService).unassignTeamFromTask("task-1")
        verify(operatonTaskService).unassignTeamFromTask("task-2")
    }

    @Test
    fun `should not remove team when no building block instances exist`() {
        whenever(caseDefinitionService.getCaseDefinition(any())).thenReturn(caseDefinitionWithSettings())
        whenever(buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId)).thenReturn(emptyList())

        val event = DocumentUnassignedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId
        )
        listener.removeTeamFromBuildingBlockTasks(event)

        verify(operatonTaskService, never()).findTasks(any())
        verify(operatonTaskService, never()).unassignTeamFromTask(any())
    }

    @Test
    fun `should not remove team when canHaveAssignee is false`() {
        whenever(caseDefinitionService.getCaseDefinition(any()))
            .thenReturn(caseDefinitionWithSettings(canHaveAssignee = false))

        val event = DocumentUnassignedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId
        )
        listener.removeTeamFromBuildingBlockTasks(event)

        verify(operatonTaskService, never()).findTasks(any())
        verify(operatonTaskService, never()).unassignTeamFromTask(any())
    }

    @Test
    fun `should not remove team when autoAssignTasks is false`() {
        whenever(caseDefinitionService.getCaseDefinition(any()))
            .thenReturn(caseDefinitionWithSettings(autoAssignTasks = false))

        val event = DocumentUnassignedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId
        )
        listener.removeTeamFromBuildingBlockTasks(event)

        verify(operatonTaskService, never()).findTasks(any())
        verify(operatonTaskService, never()).unassignTeamFromTask(any())
    }

    @Test
    fun `should not remove team when teamManagementService is null`() {
        val listenerWithoutTeams = BuildingBlockTaskTeamAutoAssignListener(
            operatonTaskService, documentService, caseDefinitionService,
            buildingBlockInstanceRepository, null, caseDocumentResolver
        )

        val event = DocumentUnassignedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId
        )
        listenerWithoutTeams.removeTeamFromBuildingBlockTasks(event)

        verify(operatonTaskService, never()).findTasks(any())
    }

    @Test
    fun `should not remove team when document is not found`() {
        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.empty())

        val event = DocumentUnassignedEvent(
            UUID.randomUUID(), "test", LocalDateTime.now(), "admin", documentId
        )
        listener.removeTeamFromBuildingBlockTasks(event)

        verify(operatonTaskService, never()).findTasks(any())
        verify(operatonTaskService, never()).unassignTeamFromTask(any())
    }
}
