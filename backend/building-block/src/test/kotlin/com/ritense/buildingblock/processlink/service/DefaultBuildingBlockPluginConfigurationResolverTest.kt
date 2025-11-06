/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.buildingblock.processlink.service

import org.junit.jupiter.api.Test
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.delegate.DelegateTask
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull

class DefaultBuildingBlockPluginConfigurationResolverTest {

    private val resolver = DefaultBuildingBlockPluginConfigurationResolver()

    @Test
    fun `should store mappings as local variable`() {
        val execution = mock<DelegateExecution>()
        val mappings = mapOf("zaken" to UUID.randomUUID())

        resolver.register(execution, mappings)

        val variableCaptor = argumentCaptor<Map<String, UUID>>()
        verify(execution).setVariableLocal(eqVariableName(), variableCaptor.capture())
        assertEquals(mappings, variableCaptor.firstValue)
    }

    @Test
    fun `should resolve mapping from parent execution`() {
        val parentExecution = mock<DelegateExecution>()
        val execution = mock<DelegateExecution> {
            on { superExecution } doReturn parentExecution
        }
        val mappings = mapOf("zaken" to UUID.randomUUID())
        whenever(parentExecution.getVariableLocal(VARIABLE_NAME)).thenReturn(mappings)

        val result = resolver.resolve(execution, "zaken")

        assertEquals(mappings["zaken"], result)
    }

    @Test
    fun `should return null when mapping not found`() {
        val execution = mock<DelegateExecution>()
        whenever(execution.getVariableLocal(VARIABLE_NAME)).thenReturn(null)
        whenever(execution.superExecution).thenReturn(null)

        val result = resolver.resolve(execution, "unknown")

        assertNull(result)
    }

    @Test
    fun `should resolve mapping for task`() {
        val parentExecution = mock<DelegateExecution>()
        val execution = mock<DelegateExecution> {
            on { superExecution } doReturn parentExecution
        }
        val task = mock<DelegateTask> {
            on { this.execution } doReturn execution
        }
        val mappings = mapOf("zaken" to UUID.randomUUID())
        whenever(parentExecution.getVariableLocal(VARIABLE_NAME)).thenReturn(mappings)

        val result = resolver.resolve(task, "zaken")

        assertEquals(mappings["zaken"], result)
    }

    private fun eqVariableName() = org.mockito.kotlin.eq(VARIABLE_NAME)

    companion object {
        private const val VARIABLE_NAME = "buildBlockPluginConfigurationMappings"
    }
}
