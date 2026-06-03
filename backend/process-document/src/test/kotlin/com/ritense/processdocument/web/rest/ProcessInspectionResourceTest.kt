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

package com.ritense.processdocument.web.rest

import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.ProcessDocumentInstanceId
import com.ritense.processdocument.domain.ProcessInstanceId
import com.ritense.processdocument.domain.impl.ProcessDocumentInstanceDto
import com.ritense.processdocument.service.BuildingBlockProcessLookup
import com.ritense.processdocument.service.BuildingBlockProcessReference
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.valtimo.service.OperatonTaskService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.Mockito.RETURNS_DEEP_STUBS
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.HistoryService
import org.operaton.bpm.engine.ManagementService
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.history.HistoricProcessInstance
import org.springframework.data.domain.Sort
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ProcessInspectionResourceTest {

    private lateinit var documentService: DocumentService
    private lateinit var authorizationService: AuthorizationService
    private lateinit var processDocumentAssociationService: ProcessDocumentAssociationService
    private lateinit var runtimeService: RuntimeService
    private lateinit var historyService: HistoryService
    private lateinit var managementService: ManagementService
    private lateinit var operatonTaskService: OperatonTaskService
    private lateinit var buildingBlockProcessLookup: BuildingBlockProcessLookup

    private lateinit var resource: ProcessInspectionResource

    private val caseId: UUID = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        documentService = mock()
        authorizationService = mock()
        processDocumentAssociationService = mock()
        runtimeService = mock(defaultAnswer = RETURNS_DEEP_STUBS)
        historyService = mock(defaultAnswer = RETURNS_DEEP_STUBS)
        managementService = mock(defaultAnswer = RETURNS_DEEP_STUBS)
        operatonTaskService = mock()
        buildingBlockProcessLookup = mock()

        resource = ProcessInspectionResource(
            documentService = documentService,
            authorizationService = authorizationService,
            processDocumentAssociationService = processDocumentAssociationService,
            runtimeService = runtimeService,
            historyService = historyService,
            managementService = managementService,
            operatonTaskService = operatonTaskService,
            buildingBlockProcessLookup = buildingBlockProcessLookup,
        )

        whenever(documentService.findBy(any<Document.Id>())).thenReturn(Optional.of(mock<JsonSchemaDocument>()))
    }

    @Test
    fun `should require INSPECT permission on the document`() {
        whenever(processDocumentAssociationService.findProcessDocumentInstanceDtos(any<Document.Id>())).thenReturn(emptyList())

        resource.getProcessInspection(caseId)

        val captor = argumentCaptor<EntityAuthorizationRequest<JsonSchemaDocument>>()
        verify(authorizationService).requirePermission(captor.capture())
        assertEquals(JsonSchemaDocument::class.java, captor.firstValue.resourceType)
    }

    @Test
    fun `should propagate authorization failure without querying engine`() {
        doThrow(RuntimeException("denied")).whenever(authorizationService)
            .requirePermission(any<AuthorizationRequest<JsonSchemaDocument>>())

        assertThrows<RuntimeException> { resource.getProcessInspection(caseId) }

        verify(processDocumentAssociationService, never()).findProcessDocumentInstanceDtos(any<Document.Id>())
        verify(runtimeService, never()).createIncidentQuery()
    }

    @Test
    fun `should return empty list when no process instances exist`() {
        whenever(processDocumentAssociationService.findProcessDocumentInstanceDtos(any<Document.Id>())).thenReturn(emptyList())

        val response = resource.getProcessInspection(caseId)

        assertEquals(200, response.statusCode.value())
        assertTrue(response.body!!.isEmpty())
    }

    @Test
    fun `should build inspection row for a process instance without building block`() {
        val processInstanceId = UUID.randomUUID().toString()
        val instance = newInstance(processInstanceId, "Some process", active = true, version = 1, latestVersion = 2, startedBy = "alice", startedOn = LocalDateTime.parse("2026-05-19T12:00:00"))
        whenever(processDocumentAssociationService.findProcessDocumentInstanceDtos(any<Document.Id>()))
            .thenReturn(listOf(instance))

        stubEmptyEngineQueriesFor(processInstanceId, definitionId = "my-process:1:abc", startUserId = "alice-id")
        whenever(operatonTaskService.findTasks(any(), eq(Sort.unsorted()))).thenReturn(emptyList())
        whenever(buildingBlockProcessLookup.findForProcessInstance(processInstanceId)).thenReturn(null)

        val response = resource.getProcessInspection(caseId)
        val rows = response.body!!

        assertEquals(1, rows.size)
        val row = rows.single()
        assertEquals(processInstanceId, row.processInstanceId)
        assertEquals("my-process:1:abc", row.processDefinitionId)
        assertEquals("my-process", row.processDefinitionKey)
        assertEquals("Some process", row.processName)
        assertEquals("alice", row.startedBy)
        assertEquals("alice-id", row.startedByUserId)
        assertEquals(true, row.active)
        assertEquals(1, row.version)
        assertEquals(2, row.latestVersion)
        assertTrue(row.incidents.isEmpty())
        assertTrue(row.tasks.isEmpty())
        assertTrue(row.variables.isEmpty())
        assertTrue(row.jobs.isEmpty())
        assertNull(row.buildingBlock)
    }

    @Test
    fun `should surface buildingBlock reference when lookup returns one`() {
        val processInstanceId = UUID.randomUUID().toString()
        val instance = newInstance(processInstanceId, "Bb process", active = true, version = 1, latestVersion = 1, startedBy = null, startedOn = null)
        whenever(processDocumentAssociationService.findProcessDocumentInstanceDtos(any<Document.Id>()))
            .thenReturn(listOf(instance))

        stubEmptyEngineQueriesFor(processInstanceId, definitionId = null, startUserId = null)
        whenever(operatonTaskService.findTasks(any(), eq(Sort.unsorted()))).thenReturn(emptyList())

        val bbRef = BuildingBlockProcessReference(
            instanceId = UUID.randomUUID(),
            definitionKey = "kvk-lookup",
            definitionVersionTag = "1.0.0",
            documentId = UUID.randomUUID(),
        )
        whenever(buildingBlockProcessLookup.findForProcessInstance(processInstanceId)).thenReturn(bbRef)

        val row = resource.getProcessInspection(caseId).body!!.single()

        assertEquals(bbRef, row.buildingBlock)
        assertNull(row.processDefinitionId)
        assertNull(row.processDefinitionKey)
    }

    @Test
    fun `should not query JobDefinitions when there are no jobs`() {
        val processInstanceId = UUID.randomUUID().toString()
        val instance = newInstance(processInstanceId, "p", active = true, version = 1, latestVersion = 1, startedBy = null, startedOn = null)
        whenever(processDocumentAssociationService.findProcessDocumentInstanceDtos(any<Document.Id>()))
            .thenReturn(listOf(instance))
        stubEmptyEngineQueriesFor(processInstanceId, definitionId = "p:1:x", startUserId = null)
        whenever(operatonTaskService.findTasks(any(), eq(Sort.unsorted()))).thenReturn(emptyList())
        whenever(buildingBlockProcessLookup.findForProcessInstance(processInstanceId)).thenReturn(null)

        resource.getProcessInspection(caseId)

        verify(managementService, never()).createJobDefinitionQuery()
    }

    private fun newInstance(
        processInstanceId: String,
        processName: String,
        active: Boolean,
        version: Int,
        latestVersion: Int,
        startedBy: String?,
        startedOn: LocalDateTime?,
    ): ProcessDocumentInstanceDto {
        val pInstanceId = mock<ProcessInstanceId>()
        whenever(pInstanceId.toString()).thenReturn(processInstanceId)
        val id = mock<ProcessDocumentInstanceId>()
        whenever(id.processInstanceId()).thenReturn(pInstanceId)
        return ProcessDocumentInstanceDto(id, processName, active, version, latestVersion, startedBy, startedOn)
    }

    private fun stubEmptyEngineQueriesFor(
        processInstanceId: String,
        definitionId: String?,
        startUserId: String?,
    ) {
        whenever(
            runtimeService.createIncidentQuery()
                .processInstanceId(processInstanceId)
                .list()
        ).thenReturn(emptyList())

        whenever(
            runtimeService.createVariableInstanceQuery()
                .processInstanceIdIn(processInstanceId)
                .list()
        ).thenReturn(emptyList())

        val historic = mock<HistoricProcessInstance>()
        whenever(historic.processDefinitionId).thenReturn(definitionId)
        whenever(historic.startUserId).thenReturn(startUserId)
        whenever(
            historyService.createHistoricProcessInstanceQuery()
                .processInstanceId(processInstanceId)
                .singleResult()
        ).thenReturn(historic)

        whenever(
            managementService.createJobQuery()
                .processInstanceId(processInstanceId)
                .list()
        ).thenReturn(emptyList())
    }
}
