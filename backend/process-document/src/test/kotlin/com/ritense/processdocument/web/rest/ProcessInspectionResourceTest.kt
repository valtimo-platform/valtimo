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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.service.DocumentService
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.processdocument.domain.ProcessDocumentInstanceId
import com.ritense.processdocument.domain.ProcessInstanceId
import com.ritense.processdocument.domain.impl.ProcessDocumentInstanceDto
import com.ritense.processdocument.event.ProcessVariableInspectionEditedEvent
import com.ritense.processdocument.service.BuildingBlockProcessLookup
import com.ritense.processdocument.service.BuildingBlockProcessReference
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.valtimo.service.OperatonTaskService
import com.ritense.valtimo.web.rest.dto.ProcessVariableMutationRequest
import com.ritense.valtimo.web.rest.dto.ProcessVariableType
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
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.operaton.bpm.engine.runtime.VariableInstance
import org.operaton.bpm.engine.variable.value.IntegerValue
import org.operaton.bpm.engine.variable.value.StringValue
import org.operaton.bpm.engine.variable.value.TypedValue
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.domain.Sort
import org.springframework.web.server.ResponseStatusException
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
    private lateinit var eventPublisher: ApplicationEventPublisher
    private lateinit var objectMapper: ObjectMapper

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
        eventPublisher = mock()
        objectMapper = ObjectMapper()

        resource = ProcessInspectionResource(
            documentService = documentService,
            authorizationService = authorizationService,
            processDocumentAssociationService = processDocumentAssociationService,
            runtimeService = runtimeService,
            historyService = historyService,
            managementService = managementService,
            operatonTaskService = operatonTaskService,
            buildingBlockProcessLookup = buildingBlockProcessLookup,
            eventPublisher = eventPublisher,
            objectMapper = objectMapper,
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

    @Test
    fun `create should require INSPECT_MODIFY permission`() {
        val processInstanceId = associateInstance()
        stubActiveInstance(processInstanceId)
        stubVariable(processInstanceId, "foo", null)

        resource.createVariable(
            caseId,
            processInstanceId,
            ProcessVariableMutationRequest("foo", ProcessVariableType.STRING, "bar"),
        )

        val captor = argumentCaptor<EntityAuthorizationRequest<JsonSchemaDocument>>()
        verify(authorizationService).requirePermission(captor.capture())
        assertEquals(JsonSchemaDocumentActionProvider.INSPECT_MODIFY, captor.firstValue.action)
    }

    @Test
    fun `update should require INSPECT_MODIFY permission`() {
        val processInstanceId = associateInstance()
        stubActiveInstance(processInstanceId)
        stubVariable(processInstanceId, "foo", "old")

        resource.updateVariable(
            caseId,
            processInstanceId,
            "foo",
            ProcessVariableMutationRequest("foo", ProcessVariableType.STRING, "new"),
        )

        val captor = argumentCaptor<EntityAuthorizationRequest<JsonSchemaDocument>>()
        verify(authorizationService).requirePermission(captor.capture())
        assertEquals(JsonSchemaDocumentActionProvider.INSPECT_MODIFY, captor.firstValue.action)
    }

    @Test
    fun `delete should require INSPECT_MODIFY permission`() {
        val processInstanceId = associateInstance()
        stubActiveInstance(processInstanceId)
        stubVariable(processInstanceId, "foo", "old")

        resource.deleteVariable(caseId, processInstanceId, "foo")

        val captor = argumentCaptor<EntityAuthorizationRequest<JsonSchemaDocument>>()
        verify(authorizationService).requirePermission(captor.capture())
        assertEquals(JsonSchemaDocumentActionProvider.INSPECT_MODIFY, captor.firstValue.action)
    }

    @Test
    fun `create should return 404 when processInstance does not belong to case`() {
        whenever(processDocumentAssociationService.findProcessDocumentInstanceDtos(any<Document.Id>())).thenReturn(emptyList())

        val ex = assertThrows<ResponseStatusException> {
            resource.createVariable(
                caseId,
                "unknown-pid",
                ProcessVariableMutationRequest("foo", ProcessVariableType.STRING, "bar"),
            )
        }
        assertEquals(404, ex.statusCode.value())
        verify(runtimeService, never()).setVariable(any(), any(), any<Any>())
    }

    @Test
    fun `create should return 404 when process instance is not active`() {
        val processInstanceId = associateInstance()
        whenever(
            runtimeService.createProcessInstanceQuery()
                .processInstanceId(processInstanceId)
                .singleResult()
        ).thenReturn(null)

        val ex = assertThrows<ResponseStatusException> {
            resource.createVariable(
                caseId,
                processInstanceId,
                ProcessVariableMutationRequest("foo", ProcessVariableType.STRING, "bar"),
            )
        }
        assertEquals(404, ex.statusCode.value())
        verify(runtimeService, never()).setVariable(any(), any(), any<Any>())
    }

    @Test
    fun `create should return 409 when variable already exists`() {
        val processInstanceId = associateInstance()
        stubActiveInstance(processInstanceId)
        stubVariable(processInstanceId, "foo", "already-here")

        val response = resource.createVariable(
            caseId,
            processInstanceId,
            ProcessVariableMutationRequest("foo", ProcessVariableType.STRING, "bar"),
        )

        assertEquals(409, response.statusCode.value())
        verify(runtimeService, never()).setVariable(any(), any(), any<Any>())
        verify(eventPublisher, never()).publishEvent(any<Any>())
    }

    @Test
    fun `create should call runtimeService setVariable with the typed value`() {
        val processInstanceId = associateInstance()
        stubActiveInstance(processInstanceId)
        stubVariable(processInstanceId, "count", null)

        val response = resource.createVariable(
            caseId,
            processInstanceId,
            ProcessVariableMutationRequest("count", ProcessVariableType.INTEGER, 42),
        )

        assertEquals(201, response.statusCode.value())
        val captor = argumentCaptor<TypedValue>()
        verify(runtimeService).setVariable(eq(processInstanceId), eq("count"), captor.capture())
        val typed = captor.firstValue as IntegerValue
        assertEquals(42, typed.value)
    }

    @Test
    fun `update should call runtimeService setVariable and capture previous`() {
        val processInstanceId = associateInstance()
        stubActiveInstance(processInstanceId)
        stubVariable(processInstanceId, "name", "old")

        val response = resource.updateVariable(
            caseId,
            processInstanceId,
            "name",
            ProcessVariableMutationRequest("name", ProcessVariableType.STRING, "new"),
        )

        assertEquals(200, response.statusCode.value())
        val typedCaptor = argumentCaptor<TypedValue>()
        verify(runtimeService).setVariable(eq(processInstanceId), eq("name"), typedCaptor.capture())
        assertEquals("new", (typedCaptor.firstValue as StringValue).value)

        val eventCaptor = argumentCaptor<ProcessVariableInspectionEditedEvent>()
        verify(eventPublisher).publishEvent(eventCaptor.capture())
        val event = eventCaptor.firstValue
        assertEquals(ProcessVariableInspectionEditedEvent.Mutation.UPDATE, event.getMutation())
        assertEquals("\"old\"", event.getPreviousValue())
        assertEquals("\"new\"", event.getNewValue())
    }

    @Test
    fun `update should return 404 when variable does not exist`() {
        val processInstanceId = associateInstance()
        stubActiveInstance(processInstanceId)
        stubVariable(processInstanceId, "missing", null)

        val response = resource.updateVariable(
            caseId,
            processInstanceId,
            "missing",
            ProcessVariableMutationRequest("missing", ProcessVariableType.STRING, "x"),
        )

        assertEquals(404, response.statusCode.value())
        verify(runtimeService, never()).setVariable(any(), any(), any<Any>())
        verify(eventPublisher, never()).publishEvent(any<Any>())
    }

    @Test
    fun `delete should call runtimeService removeVariables and publish event`() {
        val processInstanceId = associateInstance()
        stubActiveInstance(processInstanceId)
        stubVariable(processInstanceId, "foo", "bye")

        val response = resource.deleteVariable(caseId, processInstanceId, "foo")

        assertEquals(204, response.statusCode.value())
        verify(runtimeService).removeVariables(eq(processInstanceId), eq(listOf("foo")))

        val eventCaptor = argumentCaptor<ProcessVariableInspectionEditedEvent>()
        verify(eventPublisher).publishEvent(eventCaptor.capture())
        val event = eventCaptor.firstValue
        assertEquals(ProcessVariableInspectionEditedEvent.Mutation.DELETE, event.getMutation())
        assertEquals("\"bye\"", event.getPreviousValue())
        assertNull(event.getNewValue())
        assertEquals("foo", event.getVariableName())
        assertEquals(processInstanceId, event.getProcessInstanceId())
        assertEquals(caseId, event.documentId)
    }

    @Test
    fun `delete should return 404 when variable does not exist`() {
        val processInstanceId = associateInstance()
        stubActiveInstance(processInstanceId)
        stubVariable(processInstanceId, "missing", null)

        val response = resource.deleteVariable(caseId, processInstanceId, "missing")

        assertEquals(404, response.statusCode.value())
        verify(runtimeService, never()).removeVariables(any<String>(), any<Collection<String>>())
        verify(eventPublisher, never()).publishEvent(any<Any>())
    }

    private fun stubVariable(processInstanceId: String, name: String, value: Any?) {
        val instance = value?.let {
            mock<VariableInstance>().also { v -> whenever(v.value).thenReturn(it) }
        }
        whenever(
            runtimeService.createVariableInstanceQuery()
                .processInstanceIdIn(processInstanceId)
                .variableName(name)
                .singleResult()
        ).thenReturn(instance)
    }

    private fun associateInstance(): String {
        val processInstanceId = UUID.randomUUID().toString()
        val instance = newInstance(processInstanceId, "p", active = true, version = 1, latestVersion = 1, startedBy = null, startedOn = null)
        whenever(processDocumentAssociationService.findProcessDocumentInstanceDtos(any<Document.Id>()))
            .thenReturn(listOf(instance))
        return processInstanceId
    }

    private fun stubActiveInstance(processInstanceId: String) {
        whenever(
            runtimeService.createProcessInstanceQuery()
                .processInstanceId(processInstanceId)
                .singleResult()
        ).thenReturn(mock<ProcessInstance>())
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
