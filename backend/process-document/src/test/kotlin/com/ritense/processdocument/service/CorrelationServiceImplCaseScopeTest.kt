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
import com.ritense.valtimo.contract.document.CaseDocumentResolutionException
import com.ritense.valtimo.contract.document.CaseDocumentResolver
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
import org.mockito.kotlin.times
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
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * Covers the case-scoped methods of [CorrelationServiceImpl]: `sendCatchEventMessageToCase` and
 * `sendStartMessageToCase`. The methods that correlate on a single business key are covered by
 * [CorrelationServiceImplTest].
 */
class CorrelationServiceImplCaseScopeTest {

    lateinit var runtimeService: RuntimeService
    lateinit var operatonRuntimeService: OperatonRuntimeService
    lateinit var documentService: DocumentService
    lateinit var operatonRepositoryService: OperatonRepositoryService
    lateinit var repositoryService: RepositoryService
    lateinit var associationService: ProcessDocumentAssociationService
    lateinit var caseDocumentResolver: CaseDocumentResolver
    lateinit var builder: MessageCorrelationBuilder

    val messageName = "test-message"
    val caseDocumentId: UUID = UUID.randomUUID()
    val buildingBlockDocumentId: UUID = UUID.randomUUID()
    val senderProcessInstanceId: String = UUID.randomUUID().toString()

    @BeforeEach
    fun setUp() {
        runtimeService = mock(defaultAnswer = RETURNS_DEEP_STUBS)
        operatonRuntimeService = mock()
        documentService = mock()
        operatonRepositoryService = mock()
        repositoryService = mock()
        associationService = mock()
        caseDocumentResolver = mock()

        builder = mock()
        whenever(runtimeService.createMessageCorrelation(any())).thenReturn(builder)
        whenever(builder.processInstanceBusinessKey(any())).thenReturn(builder)
        whenever(builder.processDefinitionId(any())).thenReturn(builder)
        whenever(builder.setVariables(any())).thenReturn(builder)
        whenever(builder.correlateAllWithResult()).thenReturn(emptyList())
    }

    // --- Case resolution ---

    @Test
    fun `should correlate the case business key and every building block business key`() {
        resolvesToOwnCase()
        val service = correlationService(providerReturning(buildingBlockDocumentId.toString()))

        service.sendCatchEventMessageToCase(messageName, execution(caseDocumentId.toString()))

        verify(runtimeService, times(2)).createMessageCorrelation(messageName)
        verify(builder).processInstanceBusinessKey(caseDocumentId.toString())
        verify(builder).processInstanceBusinessKey(buildingBlockDocumentId.toString())
        verify(builder, times(2)).correlateAllWithResult()
    }

    @Test
    fun `should resolve owning case when execution runs on a building block document`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(buildingBlockDocumentId)).thenReturn(caseDocumentId)
        val service = correlationService(providerReturning(buildingBlockDocumentId.toString()))

        service.sendCatchEventMessageToCase(messageName, execution(buildingBlockDocumentId.toString()))

        verify(caseDocumentResolver).resolveCaseDocumentId(buildingBlockDocumentId)
        verify(builder).processInstanceBusinessKey(caseDocumentId.toString())
        verify(builder).processInstanceBusinessKey(buildingBlockDocumentId.toString())
    }

    @Test
    fun `should throw descriptive exception when the execution has no document business key`() {
        val service = correlationService()

        val exception = assertFailsWith<IllegalStateException> {
            service.sendCatchEventMessageToCase(messageName, execution("not-a-uuid"))
        }

        assertTrue(exception.message!!.contains(senderProcessInstanceId))
        assertTrue(exception.message!!.contains("explicit case document id"))
    }

    @Test
    fun `should propagate case resolution failures`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(buildingBlockDocumentId))
            .thenThrow(CaseDocumentResolutionException("No resolver available"))
        val service = correlationService()

        assertFailsWith<CaseDocumentResolutionException> {
            service.sendCatchEventMessageToCase(messageName, execution(buildingBlockDocumentId.toString()))
        }
    }

    @Test
    fun `should throw descriptive exception when the explicit case document id is malformed`() {
        val service = correlationService()

        val exception = assertFailsWith<IllegalArgumentException> {
            service.sendCatchEventMessageToCase(messageName, "not-a-uuid")
        }

        assertTrue(exception.message!!.contains("not-a-uuid"))
        verify(runtimeService, never()).createMessageCorrelation(any())
    }

    @Test
    fun `should normalize an explicit building block document id to its case`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(buildingBlockDocumentId)).thenReturn(caseDocumentId)
        val service = correlationService()

        service.sendCatchEventMessageToCase(messageName, buildingBlockDocumentId.toString())

        verify(builder).processInstanceBusinessKey(caseDocumentId.toString())
    }

    // --- Fan-out over providers ---

    @Test
    fun `should de-duplicate business keys contributed by multiple providers`() {
        resolvesToOwnCase()
        val service = correlationService(
            providerReturning(buildingBlockDocumentId.toString()),
            providerReturning(buildingBlockDocumentId.toString())
        )

        service.sendCatchEventMessageToCase(messageName, caseDocumentId.toString())

        verify(runtimeService, times(2)).createMessageCorrelation(messageName)
        verify(builder).processInstanceBusinessKey(buildingBlockDocumentId.toString())
    }

    @Test
    fun `should not correlate the case business key twice when a provider returns it`() {
        resolvesToOwnCase()
        val service = correlationService(providerReturning(caseDocumentId.toString()))

        service.sendCatchEventMessageToCase(messageName, caseDocumentId.toString())

        verify(runtimeService).createMessageCorrelation(messageName)
        verify(builder).processInstanceBusinessKey(caseDocumentId.toString())
    }

    @Test
    fun `should deliver to the case only when no providers are registered`() {
        resolvesToOwnCase()
        val service = correlationService()

        service.sendCatchEventMessageToCase(messageName, caseDocumentId.toString())

        verify(runtimeService).createMessageCorrelation(messageName)
        verify(builder).processInstanceBusinessKey(caseDocumentId.toString())
    }

    @Test
    fun `should return an empty list without throwing when nothing is subscribed`() {
        resolvesToOwnCase()
        val service = correlationService(providerReturning(buildingBlockDocumentId.toString()))

        val results = service.sendCatchEventMessageToCase(messageName, caseDocumentId.toString())

        assertEquals(emptyList(), results)
    }

    // --- Associations ---

    @Test
    fun `should associate the case process with the document but not the building block process`() {
        resolvesToOwnCase()
        val caseProcessInstanceId = UUID.randomUUID().toString()
        val buildingBlockProcessInstanceId = UUID.randomUUID().toString()
        val caseResult = correlationResult(caseProcessInstanceId)
        val buildingBlockResult = correlationResult(buildingBlockProcessInstanceId)
        whenever(builder.correlateAllWithResult())
            .thenReturn(listOf(caseResult), listOf(buildingBlockResult))
        mockProcessDefinitionName(caseProcessInstanceId)
        mockProcessDefinitionName(buildingBlockProcessInstanceId)
        mockDocumentLookup()
        val service = correlationService(providerReturning(buildingBlockDocumentId.toString()))

        val results = service.sendCatchEventMessageToCase(messageName, caseDocumentId.toString())

        assertEquals(listOf(caseResult, buildingBlockResult), results)
        verify(associationService).createProcessDocumentInstance(
            eq(caseProcessInstanceId), eq(caseDocumentId), any()
        )
        verify(associationService, never()).createProcessDocumentInstance(
            eq(buildingBlockProcessInstanceId), any(), any()
        )
    }

    // --- Variables ---

    @Test
    fun `should pass a variables map to both the case and the building block delivery`() {
        resolvesToOwnCase()
        val service = correlationService(providerReturning(buildingBlockDocumentId.toString()))
        val variables = mapOf("key1" to "value1" as Any?)

        service.sendCatchEventMessageToCase(messageName, caseDocumentId.toString(), variables)

        verify(builder, times(2)).setVariables(variables)
    }

    @Test
    fun `should convert vararg variables to a map`() {
        resolvesToOwnCase()
        val service = correlationService(providerReturning(buildingBlockDocumentId.toString()))

        service.sendCatchEventMessageToCase(messageName, caseDocumentId.toString(), "k1", "v1", "k2", 42)

        verify(builder, times(2)).setVariables(mapOf("k1" to "v1", "k2" to 42))
    }

    @Test
    fun `should convert vararg variables to a map on the execution overload`() {
        resolvesToOwnCase()
        val service = correlationService(providerReturning(buildingBlockDocumentId.toString()))

        service.sendCatchEventMessageToCase(messageName, execution(caseDocumentId.toString()), "k1", "v1")

        verify(builder, times(2)).setVariables(mapOf("k1" to "v1"))
    }

    @Test
    fun `should not set variables when none are given`() {
        resolvesToOwnCase()
        val service = correlationService(providerReturning(buildingBlockDocumentId.toString()))

        service.sendCatchEventMessageToCase(messageName, caseDocumentId.toString())

        verify(builder, never()).setVariables(any())
    }

    // --- sendStartMessageToCase ---

    @Test
    fun `should start every contributed process definition with the case business key`() {
        resolvesToOwnCase()
        val processDefinitionIdOne = "notify-process:1:${UUID.randomUUID()}"
        val processDefinitionIdTwo = "reminder-process:1:${UUID.randomUUID()}"
        val service = correlationService(
            emptyList(),
            listOf(startTargetProviderReturning(processDefinitionIdOne, processDefinitionIdTwo))
        )
        val processInstance = mock<ProcessInstance>()
        whenever(builder.correlateStartMessage()).thenReturn(processInstance)

        val results = service.sendStartMessageToCase(messageName, caseDocumentId.toString())

        assertEquals(listOf(processInstance, processInstance), results)
        verify(builder).processDefinitionId(processDefinitionIdOne)
        verify(builder).processDefinitionId(processDefinitionIdTwo)
        verify(builder, times(2)).processInstanceBusinessKey(caseDocumentId.toString())
        verify(builder, times(2)).correlateStartMessage()
    }

    @Test
    fun `should de-duplicate start targets contributed by multiple providers`() {
        resolvesToOwnCase()
        val processDefinitionId = "notify-process:1:${UUID.randomUUID()}"
        val service = correlationService(
            emptyList(),
            listOf(
                startTargetProviderReturning(processDefinitionId),
                startTargetProviderReturning(processDefinitionId)
            )
        )
        whenever(builder.correlateStartMessage()).thenReturn(mock())

        val results = service.sendStartMessageToCase(messageName, caseDocumentId.toString())

        assertEquals(1, results.size)
        verify(builder).correlateStartMessage()
    }

    @Test
    fun `should not start anything when no start target matches the message`() {
        resolvesToOwnCase()
        val service = correlationService(emptyList(), listOf(startTargetProviderReturning()))

        val results = service.sendStartMessageToCase(messageName, caseDocumentId.toString())

        assertEquals(emptyList(), results)
        verify(runtimeService, never()).createMessageCorrelation(any())
    }

    @Test
    fun `should resolve the current case before starting from an execution`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(buildingBlockDocumentId)).thenReturn(caseDocumentId)
        val service = correlationService(
            emptyList(),
            listOf(startTargetProviderReturning("notify-process:1:${UUID.randomUUID()}"))
        )
        whenever(builder.correlateStartMessage()).thenReturn(mock())

        service.sendStartMessageToCase(messageName, execution(buildingBlockDocumentId.toString()))

        verify(builder).processInstanceBusinessKey(caseDocumentId.toString())
    }

    @Test
    fun `should throw when the current case cannot be determined for a start message`() {
        val service = correlationService(emptyList(), listOf(startTargetProviderReturning("some-id")))

        assertFailsWith<IllegalStateException> {
            service.sendStartMessageToCase(messageName, execution("not-a-uuid"))
        }
    }

    @Test
    fun `should set variables on started processes`() {
        resolvesToOwnCase()
        val service = correlationService(
            emptyList(),
            listOf(startTargetProviderReturning("notify-process:1:${UUID.randomUUID()}"))
        )
        whenever(builder.correlateStartMessage()).thenReturn(mock())

        service.sendStartMessageToCase(messageName, caseDocumentId.toString(), "k1", "v1")

        verify(builder).setVariables(mapOf("k1" to "v1"))
    }

    // --- Helper methods ---

    private fun correlationService(
        vararg providers: CaseCorrelationBusinessKeyProvider
    ) = correlationService(providers.toList(), emptyList())

    private fun correlationService(
        businessKeyProviders: List<CaseCorrelationBusinessKeyProvider>,
        startTargetProviders: List<CaseCorrelationStartTargetProvider>,
    ) = CorrelationServiceImpl(
        runtimeService = runtimeService,
        operatonRuntimeService = operatonRuntimeService,
        documentService = documentService,
        operatonRepositoryService = operatonRepositoryService,
        repositoryService = repositoryService,
        associationService = associationService,
        caseDocumentResolver = caseDocumentResolver,
        businessKeyProviders = businessKeyProviders,
        startTargetProviders = startTargetProviders,
    )

    private fun providerReturning(vararg businessKeys: String) =
        CaseCorrelationBusinessKeyProvider { businessKeys.toList() }

    private fun startTargetProviderReturning(vararg processDefinitionIds: String) =
        CaseCorrelationStartTargetProvider { _, _ -> processDefinitionIds.toList() }

    private fun resolvesToOwnCase() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)
    }

    private fun execution(businessKey: String): DelegateExecution {
        val execution = mock<DelegateExecution>()
        whenever(execution.businessKey).thenReturn(businessKey)
        whenever(execution.processInstanceId).thenReturn(senderProcessInstanceId)
        return execution
    }

    private fun correlationResult(processInstanceId: String): MessageCorrelationResult {
        val result = mock<MessageCorrelationResult>(defaultAnswer = RETURNS_DEEP_STUBS)
        whenever(result.execution.processInstanceId).thenReturn(processInstanceId)
        return result
    }

    private fun mockProcessDefinitionName(processInstanceId: String) {
        val processDefinitionId = UUID.randomUUID().toString()
        val processInstance = mock<ProcessInstance>()
        whenever(processInstance.processDefinitionId).thenReturn(processDefinitionId)
        whenever(operatonRuntimeService.findProcessInstanceById(processInstanceId)).thenReturn(processInstance)
        val processDefinition = mock<OperatonProcessDefinition>()
        whenever(processDefinition.name).thenReturn("process-$processInstanceId")
        whenever(operatonRepositoryService.findProcessDefinitionById(processDefinitionId))
            .thenReturn(processDefinition)
    }

    private fun mockDocumentLookup() {
        val document = mock<Document>()
        val documentId = mock<JsonSchemaDocumentId>()
        whenever(documentId.id).thenReturn(caseDocumentId)
        whenever(document.id()).thenReturn(documentId)
        whenever(documentService[caseDocumentId.toString()]).thenReturn(document)
        whenever(associationService.findProcessDocumentInstance(any<OperatonProcessInstanceId>()))
            .thenReturn(Optional.empty())
    }
}
