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

package com.ritense.processdocument.service

import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.operaton.service.OperatonRuntimeService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito.RETURNS_DEEP_STUBS
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.runtime.MessageCorrelationBuilder
import org.operaton.bpm.engine.runtime.MessageCorrelationResult
import org.operaton.bpm.engine.runtime.ProcessInstance
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals

class CorrelationServiceImplTest {

    lateinit var runtimeService: RuntimeService
    lateinit var operatonRuntimeService: OperatonRuntimeService
    lateinit var documentService: DocumentService
    lateinit var operatonRepositoryService: OperatonRepositoryService
    lateinit var repositoryService: RepositoryService
    lateinit var associationService: ProcessDocumentAssociationService
    lateinit var correlationService: CorrelationServiceImpl

    lateinit var builder: MessageCorrelationBuilder

    val businessKey = UUID.randomUUID().toString()
    val documentId = UUID.randomUUID()
    val messageName = "test-message"
    val processDefinitionId = UUID.randomUUID().toString()
    val processInstanceId = UUID.randomUUID().toString()
    val processName = "test-process-name"

    @BeforeEach
    fun setUp() {
        runtimeService = mock(defaultAnswer = RETURNS_DEEP_STUBS)
        operatonRuntimeService = mock()
        documentService = mock()
        operatonRepositoryService = mock()
        repositoryService = mock()
        associationService = mock()

        correlationService = CorrelationServiceImpl(
            runtimeService,
            operatonRuntimeService,
            documentService,
            operatonRepositoryService,
            repositoryService,
            associationService
        )

        builder = mock()
        whenever(runtimeService.createMessageCorrelation(any())).thenReturn(builder)
        whenever(builder.processInstanceBusinessKey(any())).thenReturn(builder)
        whenever(builder.processDefinitionId(any())).thenReturn(builder)
        whenever(builder.setVariables(any())).thenReturn(builder)
    }

    // --- sendStartMessage ---

    @Test
    fun `sendStartMessage should correlate with businessKey and associate document`() {
        val result = mockCorrelationResultWithProcessInstance()
        whenever(builder.correlateWithResult()).thenReturn(result)
        mockProcessDefinitionLookup()
        mockDocumentAndAssociation()

        val actual = correlationService.sendStartMessage(messageName, businessKey)

        assertEquals(result, actual)
        verify(builder).processInstanceBusinessKey(businessKey)
        verify(builder).correlateWithResult()
        verify(associationService).createProcessDocumentInstance(eq(processInstanceId), eq(documentId), eq(processName))
    }

    @Test
    fun `sendStartMessage with variables map should correlate with businessKey and variables`() {
        val variables = mapOf("key1" to "value1" as Any?)
        val result = mockCorrelationResultWithProcessInstance()
        whenever(builder.correlateWithResult()).thenReturn(result)
        mockProcessDefinitionLookup()
        mockDocumentAndAssociation()

        val actual = correlationService.sendStartMessage(messageName, businessKey, variables)

        assertEquals(result, actual)
        verify(builder).processInstanceBusinessKey(businessKey)
        verify(builder).setVariables(variables)
        verify(builder).correlateWithResult()
    }

    @Test
    fun `sendStartMessage with vararg variables should convert to map and correlate`() {
        val result = mockCorrelationResultWithProcessInstance()
        whenever(builder.correlateWithResult()).thenReturn(result)
        mockProcessDefinitionLookup()
        mockDocumentAndAssociation()

        val actual = correlationService.sendStartMessage(messageName, businessKey, "key1", "value1")

        assertEquals(result, actual)
        verify(builder).setVariables(mapOf("key1" to "value1"))
    }

    // --- sendStartMessageWithProcessDefinitionKey ---

    @Test
    fun `sendStartMessageWithProcessDefinitionKey should correlate with process definition id`() {
        val targetKey = "target-process-key"
        val processInstance = mock<ProcessInstance>()
        whenever(processInstance.processDefinitionId).thenReturn(processDefinitionId)
        whenever(processInstance.processInstanceId).thenReturn(processInstanceId)
        whenever(builder.correlateStartMessage()).thenReturn(processInstance)
        mockLatestProcessDefinition()
        mockProcessDefinitionLookup()
        mockDocumentAndAssociation()

        correlationService.sendStartMessageWithProcessDefinitionKey(messageName, targetKey, businessKey)

        verify(builder).processDefinitionId(any())
        verify(builder).processInstanceBusinessKey(businessKey)
        verify(builder).correlateStartMessage()
        verify(associationService).createProcessDocumentInstance(eq(processInstanceId), eq(documentId), eq(processName))
    }

    @Test
    fun `sendStartMessageWithProcessDefinitionKey with variables map should set variables`() {
        val targetKey = "target-process-key"
        val variables = mapOf("key1" to "value1" as Any?)
        val processInstance = mock<ProcessInstance>()
        whenever(processInstance.processDefinitionId).thenReturn(processDefinitionId)
        whenever(processInstance.processInstanceId).thenReturn(processInstanceId)
        whenever(builder.correlateStartMessage()).thenReturn(processInstance)
        mockLatestProcessDefinition()
        mockProcessDefinitionLookup()
        mockDocumentAndAssociation()

        correlationService.sendStartMessageWithProcessDefinitionKey(messageName, targetKey, businessKey, variables)

        verify(builder).setVariables(variables)
    }

    @Test
    fun `sendStartMessageWithProcessDefinitionKey with vararg variables should convert to map`() {
        val targetKey = "target-process-key"
        val processInstance = mock<ProcessInstance>()
        whenever(processInstance.processDefinitionId).thenReturn(processDefinitionId)
        whenever(processInstance.processInstanceId).thenReturn(processInstanceId)
        whenever(builder.correlateStartMessage()).thenReturn(processInstance)
        mockLatestProcessDefinition()
        mockProcessDefinitionLookup()
        mockDocumentAndAssociation()

        correlationService.sendStartMessageWithProcessDefinitionKey(messageName, targetKey, businessKey, "k1", "v1")

        verify(builder).setVariables(mapOf("k1" to "v1"))
    }

    // --- sendCatchEventMessage with businessKey ---

    @Test
    fun `sendCatchEventMessage with businessKey should correlate and associate document`() {
        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateWithResult()).thenReturn(result)
        mockProcessDefinitionNameByProcessInstanceId()
        mockDocumentAndAssociation()

        val actual = correlationService.sendCatchEventMessage(messageName, businessKey)

        assertEquals(result, actual)
        verify(builder).processInstanceBusinessKey(businessKey)
        verify(builder).correlateWithResult()
        verify(associationService).createProcessDocumentInstance(eq(processInstanceId), eq(documentId), eq(processName))
    }

    @Test
    fun `sendCatchEventMessage with businessKey and variables map should set variables`() {
        val variables = mapOf("key1" to "value1" as Any?)
        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateWithResult()).thenReturn(result)
        mockProcessDefinitionNameByProcessInstanceId()
        mockDocumentAndAssociation()

        val actual = correlationService.sendCatchEventMessage(messageName, businessKey, variables)

        assertEquals(result, actual)
        verify(builder).setVariables(variables)
    }

    @Test
    fun `sendCatchEventMessage with businessKey and vararg variables should convert to map`() {
        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateWithResult()).thenReturn(result)
        mockProcessDefinitionNameByProcessInstanceId()
        mockDocumentAndAssociation()

        val actual = correlationService.sendCatchEventMessage(messageName, businessKey, "k1", "v1")

        assertEquals(result, actual)
        verify(builder).setVariables(mapOf("k1" to "v1"))
    }

    // --- sendCatchEventMessage without businessKey ---

    @Test
    fun `sendCatchEventMessage without businessKey should correlate without businessKey filter`() {
        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateWithResult()).thenReturn(result)

        val actual = correlationService.sendCatchEventMessage(messageName)

        assertEquals(result, actual)
        verify(builder, never()).processInstanceBusinessKey(any())
        verify(builder).correlateWithResult()
    }

    @Test
    fun `sendCatchEventMessage without businessKey should not associate document`() {
        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateWithResult()).thenReturn(result)

        correlationService.sendCatchEventMessage(messageName)

        verify(associationService, never()).createProcessDocumentInstance(any(), any(), any())
    }

    @Test
    fun `sendCatchEventMessage without businessKey with variables map should set variables`() {
        val variables = mapOf("key1" to "value1" as Any?)
        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateWithResult()).thenReturn(result)

        val actual = correlationService.sendCatchEventMessage(messageName, variables)

        assertEquals(result, actual)
        verify(builder, never()).processInstanceBusinessKey(any())
        verify(builder).setVariables(variables)
    }

    // --- sendCatchEventMessageToAll with businessKey ---

    @Test
    fun `sendCatchEventMessageToAll with businessKey should correlate all and associate documents`() {
        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateAllWithResult()).thenReturn(listOf(result))
        mockProcessDefinitionNameByProcessInstanceId()
        mockDocumentAndAssociation()

        val actual = correlationService.sendCatchEventMessageToAll(messageName, businessKey)

        assertEquals(listOf(result), actual)
        verify(builder).processInstanceBusinessKey(businessKey)
        verify(builder).correlateAllWithResult()
        verify(associationService).createProcessDocumentInstance(eq(processInstanceId), eq(documentId), eq(processName))
    }

    @Test
    fun `sendCatchEventMessageToAll with businessKey and variables map should set variables`() {
        val variables = mapOf("key1" to "value1" as Any?)
        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateAllWithResult()).thenReturn(listOf(result))
        mockProcessDefinitionNameByProcessInstanceId()
        mockDocumentAndAssociation()

        val actual = correlationService.sendCatchEventMessageToAll(messageName, businessKey, variables)

        assertEquals(listOf(result), actual)
        verify(builder).setVariables(variables)
    }

    @Test
    fun `sendCatchEventMessageToAll with businessKey and vararg variables should convert to map`() {
        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateAllWithResult()).thenReturn(listOf(result))
        mockProcessDefinitionNameByProcessInstanceId()
        mockDocumentAndAssociation()

        val actual = correlationService.sendCatchEventMessageToAll(messageName, businessKey, "k1", "v1")

        assertEquals(listOf(result), actual)
        verify(builder).setVariables(mapOf("k1" to "v1"))
    }

    @Test
    fun `sendCatchEventMessageToAll with businessKey should associate each result`() {
        val processInstanceId1 = UUID.randomUUID().toString()
        val processInstanceId2 = UUID.randomUUID().toString()
        val result1 = mockCorrelationResultWithExecution(processInstanceId1)
        val result2 = mockCorrelationResultWithExecution(processInstanceId2)
        whenever(builder.correlateAllWithResult()).thenReturn(listOf(result1, result2))

        val processDef1 = mock<OperatonProcessDefinition>()
        whenever(processDef1.name).thenReturn("process-1")
        val processDef2 = mock<OperatonProcessDefinition>()
        whenever(processDef2.name).thenReturn("process-2")

        val defId1 = UUID.randomUUID().toString()
        val defId2 = UUID.randomUUID().toString()
        val pi1 = mock<ProcessInstance>()
        whenever(pi1.processDefinitionId).thenReturn(defId1)
        val pi2 = mock<ProcessInstance>()
        whenever(pi2.processDefinitionId).thenReturn(defId2)

        whenever(operatonRuntimeService.findProcessInstanceById(processInstanceId1)).thenReturn(pi1)
        whenever(operatonRuntimeService.findProcessInstanceById(processInstanceId2)).thenReturn(pi2)
        whenever(operatonRepositoryService.findProcessDefinitionById(defId1)).thenReturn(processDef1)
        whenever(operatonRepositoryService.findProcessDefinitionById(defId2)).thenReturn(processDef2)

        val document = mock<Document>()
        val jsonSchemaDocumentId = mock<JsonSchemaDocumentId>()
        whenever(jsonSchemaDocumentId.id).thenReturn(documentId)
        whenever(document.id()).thenReturn(jsonSchemaDocumentId)
        whenever(documentService[businessKey]).thenReturn(document)
        whenever(associationService.findProcessDocumentInstance(any<OperatonProcessInstanceId>())).thenReturn(Optional.empty())

        correlationService.sendCatchEventMessageToAll(messageName, businessKey)

        verify(associationService).createProcessDocumentInstance(eq(processInstanceId1), eq(documentId), eq("process-1"))
        verify(associationService).createProcessDocumentInstance(eq(processInstanceId2), eq(documentId), eq("process-2"))
    }

    // --- sendCatchEventMessageToAll without businessKey ---

    @Test
    fun `sendCatchEventMessageToAll without businessKey should correlate without businessKey filter`() {
        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateAllWithResult()).thenReturn(listOf(result))

        val actual = correlationService.sendCatchEventMessageToAll(messageName)

        assertEquals(listOf(result), actual)
        verify(builder, never()).processInstanceBusinessKey(any())
        verify(builder).correlateAllWithResult()
    }

    @Test
    fun `sendCatchEventMessageToAll without businessKey should not associate document`() {
        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateAllWithResult()).thenReturn(listOf(result))

        correlationService.sendCatchEventMessageToAll(messageName)

        verify(associationService, never()).createProcessDocumentInstance(any(), any(), any())
    }

    @Test
    fun `sendCatchEventMessageToAll without businessKey with variables map should set variables`() {
        val variables = mapOf("key1" to "value1" as Any?)
        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateAllWithResult()).thenReturn(listOf(result))

        val actual = correlationService.sendCatchEventMessageToAll(messageName, variables)

        assertEquals(listOf(result), actual)
        verify(builder, never()).processInstanceBusinessKey(any())
        verify(builder).setVariables(variables)
    }

    @Test
    fun `sendCatchEventMessageToAll without businessKey with empty results should return empty list`() {
        whenever(builder.correlateAllWithResult()).thenReturn(emptyList())

        val actual = correlationService.sendCatchEventMessageToAll(messageName)

        assertEquals(emptyList(), actual)
    }

    // --- sendMessage ---

    @Test
    fun `sendMessage should correlate using execution businessKey and variables`() {
        val execution = mock<DelegateExecution>()
        val executionBusinessKey = UUID.randomUUID().toString()
        val executionVars = mapOf("var1" to "val1" as Any)
        whenever(execution.businessKey).thenReturn(executionBusinessKey)
        whenever(execution.variables).thenReturn(executionVars)

        val result = mockCorrelationResultWithProcessInstance()
        whenever(builder.correlateWithResult()).thenReturn(result)
        mockProcessDefinitionLookup()
        mockDocumentAndAssociation(executionBusinessKey)

        val actual = correlationService.sendMessage(messageName, execution)

        assertEquals(result, actual)
        verify(builder).processInstanceBusinessKey(executionBusinessKey)
        verify(builder).setVariables(executionVars)
    }

    @Test
    fun `sendMessage with catch event result should associate using execution processInstanceId`() {
        val execution = mock<DelegateExecution>()
        whenever(execution.businessKey).thenReturn(businessKey)
        whenever(execution.variables).thenReturn(emptyMap())

        val result = mockCorrelationResultWithExecution()
        whenever(result.processInstance).thenReturn(null)
        whenever(builder.correlateWithResult()).thenReturn(result)
        mockProcessDefinitionNameByProcessInstanceId()
        mockDocumentAndAssociation()

        correlationService.sendMessage(messageName, execution)

        verify(associationService).createProcessDocumentInstance(eq(processInstanceId), eq(documentId), eq(processName))
    }

    // --- sendMessageToAll ---

    @Test
    fun `sendMessageToAll should correlate all using execution businessKey and variables`() {
        val execution = mock<DelegateExecution>()
        val executionBusinessKey = UUID.randomUUID().toString()
        val executionVars = mapOf("var1" to "val1" as Any)
        whenever(execution.businessKey).thenReturn(executionBusinessKey)
        whenever(execution.variables).thenReturn(executionVars)

        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateAllWithResult()).thenReturn(listOf(result))
        mockProcessDefinitionNameByProcessInstanceId()
        mockDocumentAndAssociation(executionBusinessKey)

        val actual = correlationService.sendMessageToAll(messageName, execution)

        assertEquals(listOf(result), actual)
        verify(builder).processInstanceBusinessKey(executionBusinessKey)
        verify(builder).setVariables(executionVars)
    }

    // --- Variable conversion ---

    @Test
    fun `vararg variables with multiple pairs should produce correct map`() {
        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateWithResult()).thenReturn(result)
        mockProcessDefinitionNameByProcessInstanceId()
        mockDocumentAndAssociation()

        correlationService.sendCatchEventMessage(messageName, businessKey, "k1", "v1", "k2", 42)

        verify(builder).setVariables(mapOf("k1" to "v1", "k2" to 42))
    }

    @Test
    fun `vararg variables with no arguments should not set variables`() {
        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateWithResult()).thenReturn(result)
        mockProcessDefinitionNameByProcessInstanceId()
        mockDocumentAndAssociation()

        correlationService.sendCatchEventMessage(messageName, businessKey)

        verify(builder, never()).setVariables(any())
    }

    @Test
    fun `null variables map should not set variables`() {
        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateWithResult()).thenReturn(result)
        mockProcessDefinitionNameByProcessInstanceId()
        mockDocumentAndAssociation()

        correlationService.sendCatchEventMessage(messageName, businessKey, null)

        verify(builder, never()).setVariables(any())
    }

    // --- Association skipping ---

    @Test
    fun `should not create association when one already exists`() {
        val result = mockCorrelationResultWithExecution()
        whenever(builder.correlateWithResult()).thenReturn(result)
        mockProcessDefinitionNameByProcessInstanceId()

        val document = mock<Document>()
        val jsonSchemaDocumentId = mock<JsonSchemaDocumentId>()
        whenever(jsonSchemaDocumentId.id).thenReturn(documentId)
        whenever(document.id()).thenReturn(jsonSchemaDocumentId)
        whenever(documentService[businessKey]).thenReturn(document)
        whenever(associationService.findProcessDocumentInstance(any<OperatonProcessInstanceId>())).thenReturn(Optional.of(mock()))

        correlationService.sendCatchEventMessage(messageName, businessKey)

        verify(associationService, never()).createProcessDocumentInstance(any(), any(), any())
    }

    // --- Helper methods ---

    private fun mockCorrelationResultWithProcessInstance(): MessageCorrelationResult {
        val result = mock<MessageCorrelationResult>()
        val processInstance = mock<ProcessInstance>()
        whenever(processInstance.processDefinitionId).thenReturn(processDefinitionId)
        whenever(processInstance.id).thenReturn(processInstanceId)
        whenever(processInstance.processInstanceId).thenReturn(processInstanceId)
        whenever(result.processInstance).thenReturn(processInstance)
        return result
    }

    private fun mockCorrelationResultWithExecution(
        execProcessInstanceId: String = processInstanceId
    ): MessageCorrelationResult {
        val result = mock<MessageCorrelationResult>(defaultAnswer = RETURNS_DEEP_STUBS)
        whenever(result.execution.processInstanceId).thenReturn(execProcessInstanceId)
        return result
    }

    private fun mockProcessDefinitionLookup() {
        val processDef = mock<OperatonProcessDefinition>()
        whenever(processDef.name).thenReturn(processName)
        whenever(operatonRepositoryService.findProcessDefinitionById(processDefinitionId)).thenReturn(processDef)
    }

    private fun mockProcessDefinitionNameByProcessInstanceId() {
        val processInstance = mock<ProcessInstance>()
        whenever(processInstance.processDefinitionId).thenReturn(processDefinitionId)
        whenever(operatonRuntimeService.findProcessInstanceById(processInstanceId)).thenReturn(processInstance)
        mockProcessDefinitionLookup()
    }

    private fun mockDocumentAndAssociation(key: String = businessKey) {
        val document = mock<Document>()
        val jsonSchemaDocumentId = mock<JsonSchemaDocumentId>()
        whenever(jsonSchemaDocumentId.id).thenReturn(documentId)
        whenever(document.id()).thenReturn(jsonSchemaDocumentId)
        whenever(documentService[key]).thenReturn(document)
        whenever(associationService.findProcessDocumentInstance(any<OperatonProcessInstanceId>())).thenReturn(Optional.empty())
    }

    private fun mockLatestProcessDefinition() {
        val processDef = mock<OperatonProcessDefinition>()
        whenever(processDef.id).thenReturn(processDefinitionId)
        whenever(operatonRepositoryService.findProcessDefinition(any())).thenReturn(processDef)
    }
}
