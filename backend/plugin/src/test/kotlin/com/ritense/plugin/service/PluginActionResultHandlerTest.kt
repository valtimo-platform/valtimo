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

package com.ritense.plugin.service

import com.ritense.plugin.domain.PluginActionResultMapping
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valueresolver.ValueResolverService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import java.util.UUID

class PluginActionResultHandlerTest {

    private lateinit var valueResolverService: ValueResolverService
    private lateinit var handler: PluginActionResultHandler
    private lateinit var execution: DelegateExecution

    @BeforeEach
    fun init() {
        valueResolverService = mock()
        handler = PluginActionResultHandler(valueResolverService, MapperSingleton.get())
        execution = mock()
        whenever(execution.processInstanceId).thenReturn("process-instance-1")
        whenever(execution.currentActivityId).thenReturn("activity-1")
    }

    @Test
    fun `does nothing when no mappings are configured`() {
        val result = MapperSingleton.get().readTree("""{"value": 123}""")

        handler.handle(execution, result, emptyList())

        verify(valueResolverService, never()).handleValues(any<String>(), any(), any())
        verify(valueResolverService, never()).handleValues(any<UUID>(), any())
    }

    @Test
    fun `extracts the source pointer and writes it to the target`() {
        val result = MapperSingleton.get().readTree("""{"value": 123, "nested": {"field": "abc"}}""")
        val businessKey = UUID.randomUUID()
        whenever(execution.processBusinessKey).thenReturn(businessKey.toString())

        handler.handle(
            execution,
            result,
            listOf(PluginActionResultMapping(source = "/nested/field", target = "doc:/summary"))
        )

        verify(valueResolverService).handleValues(eq(businessKey), eq(mapOf("doc:/summary" to "abc")))
    }

    @Test
    fun `an empty source pointer selects the whole result`() {
        val result = MapperSingleton.get().readTree("""{"value": 123}""")
        val businessKey = UUID.randomUUID()
        whenever(execution.processBusinessKey).thenReturn(businessKey.toString())

        handler.handle(
            execution,
            result,
            listOf(PluginActionResultMapping(source = "", target = "doc:/whole"))
        )

        verify(valueResolverService).handleValues(
            eq(businessKey),
            org.mockito.kotlin.check { values ->
                val written = values["doc:/whole"]
                org.assertj.core.api.Assertions.assertThat(written).isInstanceOf(Map::class.java)
            }
        )
    }

    @Test
    fun `splits pv target from document targets across two handleValues calls`() {
        val result = MapperSingleton.get().readTree("""{"a": 1, "b": 2}""")
        val businessKey = UUID.randomUUID()
        whenever(execution.processBusinessKey).thenReturn(businessKey.toString())

        handler.handle(
            execution,
            result,
            listOf(
                PluginActionResultMapping(source = "/a", target = "pv:varA"),
                PluginActionResultMapping(source = "/b", target = "doc:/fieldB"),
            )
        )

        verify(valueResolverService).handleValues("process-instance-1", execution, mapOf("pv:varA" to 1))
        verify(valueResolverService).handleValues(businessKey, mapOf("doc:/fieldB" to 2))
    }

    @Test
    fun `logs a warning and skips the target when the source pointer does not match`() {
        val result = MapperSingleton.get().readTree("""{"value": 123}""")
        whenever(execution.processBusinessKey).thenReturn(UUID.randomUUID().toString())

        handler.handle(
            execution,
            result,
            listOf(PluginActionResultMapping(source = "/missing", target = "doc:/summary"))
        )

        verify(valueResolverService, never()).handleValues(any<UUID>(), any())
    }

    @Test
    fun `writes null result values through to the target instead of skipping them`() {
        val result = MapperSingleton.get().readTree("""{"remarks": null, "decision": "APPROVED"}""")
        val businessKey = UUID.randomUUID()
        whenever(execution.processBusinessKey).thenReturn(businessKey.toString())

        handler.handle(
            execution,
            result,
            listOf(
                PluginActionResultMapping(source = "/remarks", target = "doc:/reviewerRemarks"),
                PluginActionResultMapping(source = "/decision", target = "doc:/approvalDecision"),
            )
        )

        verify(valueResolverService).handleValues(
            businessKey,
            mapOf("doc:/reviewerRemarks" to null, "doc:/approvalDecision" to "APPROVED")
        )
    }

    @Test
    fun `logs a warning and does not fail the process when the result is null but mappings are configured`() {
        handler.handle(
            execution,
            null,
            listOf(PluginActionResultMapping(source = "/value", target = "doc:/summary"))
        )

        verify(valueResolverService, never()).handleValues(any<UUID>(), any())
        verify(valueResolverService, never()).handleValues(any<String>(), any(), any())
    }

    @Test
    fun `throws when a non-pv target is configured but the execution has no business key`() {
        val result = MapperSingleton.get().readTree("""{"value": 123}""")
        whenever(execution.processBusinessKey).thenReturn(null)

        val exception = org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException::class.java) {
            handler.handle(
                execution,
                result,
                listOf(PluginActionResultMapping(source = "/value", target = "doc:/summary"))
            )
        }
        org.assertj.core.api.Assertions.assertThat(exception.message).contains("business-key document")
    }
}
