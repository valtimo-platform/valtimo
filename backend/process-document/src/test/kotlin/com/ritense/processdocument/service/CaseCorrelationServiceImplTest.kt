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

import com.ritense.valtimo.contract.document.CaseDocumentResolutionException
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito.RETURNS_DEEP_STUBS
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.runtime.MessageCorrelationBuilder
import org.operaton.bpm.engine.runtime.MessageCorrelationResult
import org.operaton.bpm.engine.runtime.ProcessInstance
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.assertFailsWith

class CaseCorrelationServiceImplTest {

    lateinit var runtimeService: RuntimeService
    lateinit var correlationService: CorrelationService
    lateinit var caseDocumentResolver: CaseDocumentResolver
    lateinit var builder: MessageCorrelationBuilder

    val messageName = "test-message"
    val caseDocumentId: UUID = UUID.randomUUID()
    val buildingBlockDocumentId: UUID = UUID.randomUUID()
    val processInstanceId: String = UUID.randomUUID().toString()

    @BeforeEach
    fun setUp() {
        runtimeService = mock(defaultAnswer = RETURNS_DEEP_STUBS)
        correlationService = mock()
        caseDocumentResolver = mock()

        builder = mock()
        whenever(runtimeService.createMessageCorrelation(any())).thenReturn(builder)
        whenever(builder.processInstanceBusinessKey(any())).thenReturn(builder)
        whenever(builder.setVariables(any())).thenReturn(builder)
        whenever(builder.correlateAllWithResult()).thenReturn(emptyList())
    }

    // --- Case resolution from an execution ---

    @Test
    fun `should deliver to case and building blocks when execution runs on the case itself`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)
        val service = caseCorrelationService(providerReturning(buildingBlockDocumentId.toString()))
        val caseResult = mock<MessageCorrelationResult>()
        whenever(
            correlationService.sendCatchEventMessageToAll(
                eq(messageName), eq(caseDocumentId.toString()), anyOrNull<Map<String, Any?>>()
            )
        ).thenReturn(listOf(caseResult))
        val buildingBlockResult = mock<MessageCorrelationResult>()
        whenever(builder.correlateAllWithResult()).thenReturn(listOf(buildingBlockResult))

        val results = service.sendCatchEventMessageToCase(messageName, execution(caseDocumentId.toString()))

        assertEquals(listOf(caseResult, buildingBlockResult), results)
        verify(correlationService).sendCatchEventMessageToAll(
            eq(messageName), eq(caseDocumentId.toString()), anyOrNull<Map<String, Any?>>()
        )
        verify(builder).processInstanceBusinessKey(buildingBlockDocumentId.toString())
        verify(builder).correlateAllWithResult()
    }

    @Test
    fun `should resolve owning case when execution runs on a building block document`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(buildingBlockDocumentId)).thenReturn(caseDocumentId)
        val service = caseCorrelationService(providerReturning(buildingBlockDocumentId.toString()))

        service.sendCatchEventMessageToCase(messageName, execution(buildingBlockDocumentId.toString()))

        verify(caseDocumentResolver).resolveCaseDocumentId(buildingBlockDocumentId)
        verify(correlationService).sendCatchEventMessageToAll(
            eq(messageName), eq(caseDocumentId.toString()), anyOrNull<Map<String, Any?>>()
        )
        verify(builder).processInstanceBusinessKey(buildingBlockDocumentId.toString())
    }

    @Test
    fun `should throw descriptive exception when the execution has no document business key`() {
        val service = caseCorrelationService()

        val exception = assertFailsWith<IllegalStateException> {
            service.sendCatchEventMessageToCase(messageName, execution("not-a-uuid"))
        }

        assertTrue(exception.message!!.contains(processInstanceId))
        assertTrue(exception.message!!.contains("explicit case document id"))
    }

    @Test
    fun `should propagate case resolution failures`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(buildingBlockDocumentId))
            .thenThrow(CaseDocumentResolutionException("No resolver available"))
        val service = caseCorrelationService()

        assertFailsWith<CaseDocumentResolutionException> {
            service.sendCatchEventMessageToCase(messageName, execution(buildingBlockDocumentId.toString()))
        }
    }

    // --- Case resolution from an explicit document id ---

    @Test
    fun `should throw descriptive exception when the explicit case document id is malformed`() {
        val service = caseCorrelationService()

        val exception = assertFailsWith<IllegalArgumentException> {
            service.sendCatchEventMessageToCase(messageName, "not-a-uuid")
        }

        assertTrue(exception.message!!.contains("not-a-uuid"))
        verify(correlationService, never()).sendCatchEventMessageToAll(any(), any(), anyOrNull<Map<String, Any?>>())
    }

    @Test
    fun `should normalize an explicit building block document id to its case`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(buildingBlockDocumentId)).thenReturn(caseDocumentId)
        val service = caseCorrelationService()

        service.sendCatchEventMessageToCase(messageName, buildingBlockDocumentId.toString())

        verify(correlationService).sendCatchEventMessageToAll(
            eq(messageName), eq(caseDocumentId.toString()), anyOrNull<Map<String, Any?>>()
        )
    }

    // --- Fan-out over providers ---

    @Test
    fun `should de-duplicate business keys contributed by multiple providers`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)
        val service = caseCorrelationService(
            providerReturning(buildingBlockDocumentId.toString()),
            providerReturning(buildingBlockDocumentId.toString())
        )

        service.sendCatchEventMessageToCase(messageName, caseDocumentId.toString())

        verify(runtimeService).createMessageCorrelation(messageName)
        verify(builder).processInstanceBusinessKey(buildingBlockDocumentId.toString())
    }

    @Test
    fun `should not correlate the case business key twice when a provider returns it`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)
        val service = caseCorrelationService(providerReturning(caseDocumentId.toString()))

        service.sendCatchEventMessageToCase(messageName, caseDocumentId.toString())

        verify(runtimeService, never()).createMessageCorrelation(any())
        verify(correlationService).sendCatchEventMessageToAll(
            eq(messageName), eq(caseDocumentId.toString()), anyOrNull<Map<String, Any?>>()
        )
    }

    @Test
    fun `should deliver to the case only when no providers are registered`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)
        val service = caseCorrelationService()

        service.sendCatchEventMessageToCase(messageName, caseDocumentId.toString())

        verify(runtimeService, never()).createMessageCorrelation(any())
        verify(correlationService).sendCatchEventMessageToAll(
            eq(messageName), eq(caseDocumentId.toString()), anyOrNull<Map<String, Any?>>()
        )
    }

    @Test
    fun `should return an empty list without throwing when nothing is subscribed`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)
        val service = caseCorrelationService(providerReturning(buildingBlockDocumentId.toString()))

        val results = service.sendCatchEventMessageToCase(messageName, caseDocumentId.toString())

        assertEquals(emptyList(), results)
    }

    // --- Variables ---

    @Test
    fun `should pass a variables map to both the case and the building block delivery`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)
        val service = caseCorrelationService(providerReturning(buildingBlockDocumentId.toString()))
        val variables = mapOf("key1" to "value1" as Any?)

        service.sendCatchEventMessageToCase(messageName, caseDocumentId.toString(), variables)

        verify(correlationService).sendCatchEventMessageToAll(
            eq(messageName), eq(caseDocumentId.toString()), eq(variables)
        )
        verify(builder).setVariables(variables)
    }

    @Test
    fun `should convert vararg variables to a map`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)
        val service = caseCorrelationService(providerReturning(buildingBlockDocumentId.toString()))

        service.sendCatchEventMessageToCase(messageName, caseDocumentId.toString(), "k1", "v1", "k2", 42)

        val expected = mapOf("k1" to "v1", "k2" to 42)
        verify(correlationService).sendCatchEventMessageToAll(
            eq(messageName), eq(caseDocumentId.toString()), eq(expected)
        )
        verify(builder).setVariables(expected)
    }

    @Test
    fun `should convert vararg variables to a map on the execution overload`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)
        val service = caseCorrelationService(providerReturning(buildingBlockDocumentId.toString()))

        service.sendCatchEventMessageToCase(messageName, execution(caseDocumentId.toString()), "k1", "v1")

        verify(correlationService).sendCatchEventMessageToAll(
            eq(messageName), eq(caseDocumentId.toString()), eq(mapOf("k1" to "v1"))
        )
    }

    @Test
    fun `should not set variables when none are given`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)
        val service = caseCorrelationService(providerReturning(buildingBlockDocumentId.toString()))

        service.sendCatchEventMessageToCase(messageName, caseDocumentId.toString())

        verify(builder, never()).setVariables(any())
    }

    // --- sendStartMessageToCase ---

    @Test
    fun `should start every contributed process definition with the case business key`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)
        val processDefinitionIdOne = "notify-process:1:${UUID.randomUUID()}"
        val processDefinitionIdTwo = "reminder-process:1:${UUID.randomUUID()}"
        val service = caseCorrelationService(
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
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)
        val processDefinitionId = "notify-process:1:${UUID.randomUUID()}"
        val service = caseCorrelationService(
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
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)
        val service = caseCorrelationService(emptyList(), listOf(startTargetProviderReturning()))

        val results = service.sendStartMessageToCase(messageName, caseDocumentId.toString())

        assertEquals(emptyList(), results)
        verify(runtimeService, never()).createMessageCorrelation(any())
    }

    @Test
    fun `should resolve the current case before starting from an execution`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(buildingBlockDocumentId)).thenReturn(caseDocumentId)
        val processDefinitionId = "notify-process:1:${UUID.randomUUID()}"
        val service = caseCorrelationService(
            emptyList(),
            listOf(startTargetProviderReturning(processDefinitionId))
        )
        whenever(builder.correlateStartMessage()).thenReturn(mock())

        service.sendStartMessageToCase(messageName, execution(buildingBlockDocumentId.toString()))

        verify(builder).processInstanceBusinessKey(caseDocumentId.toString())
    }

    @Test
    fun `should throw when the current case cannot be determined for a start message`() {
        val service = caseCorrelationService(emptyList(), listOf(startTargetProviderReturning("some-id")))

        assertFailsWith<IllegalStateException> {
            service.sendStartMessageToCase(messageName, execution("not-a-uuid"))
        }
    }

    @Test
    fun `should set variables on started processes`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(caseDocumentId)).thenReturn(caseDocumentId)
        val service = caseCorrelationService(
            emptyList(),
            listOf(startTargetProviderReturning("notify-process:1:${UUID.randomUUID()}"))
        )
        whenever(builder.correlateStartMessage()).thenReturn(mock())

        service.sendStartMessageToCase(messageName, caseDocumentId.toString(), "k1", "v1")

        verify(builder).setVariables(mapOf("k1" to "v1"))
    }

    // --- Helper methods ---

    private fun caseCorrelationService(
        vararg providers: CaseCorrelationBusinessKeyProvider
    ) = caseCorrelationService(providers.toList(), emptyList())

    private fun caseCorrelationService(
        businessKeyProviders: List<CaseCorrelationBusinessKeyProvider>,
        startTargetProviders: List<CaseCorrelationStartTargetProvider>,
    ) = CaseCorrelationServiceImpl(
        runtimeService = runtimeService,
        correlationService = correlationService,
        caseDocumentResolver = caseDocumentResolver,
        businessKeyProviders = businessKeyProviders,
        startTargetProviders = startTargetProviders,
    )

    private fun providerReturning(vararg businessKeys: String) =
        CaseCorrelationBusinessKeyProvider { businessKeys.toList() }

    private fun startTargetProviderReturning(vararg processDefinitionIds: String) =
        CaseCorrelationStartTargetProvider { _, _ -> processDefinitionIds.toList() }

    private fun execution(businessKey: String): DelegateExecution {
        val execution = mock<DelegateExecution>()
        whenever(execution.businessKey).thenReturn(businessKey)
        whenever(execution.processInstanceId).thenReturn(processInstanceId)
        return execution
    }
}
