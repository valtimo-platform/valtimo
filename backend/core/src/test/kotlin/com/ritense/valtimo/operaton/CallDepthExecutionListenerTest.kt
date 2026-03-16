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

package com.ritense.valtimo.operaton

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import com.ritense.valtimo.contract.config.ValtimoProperties
import com.ritense.valtimo.event.OperatonExecutionEvent
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.slf4j.LoggerFactory
import kotlin.test.assertTrue

class CallDepthExecutionListenerTest {

    @Test
    fun `should set default depth when no super execution and no local depth`() {
        val listener = CallDepthExecutionListener(valtimoProperties(100))
        val execution = executionWithProcessInstance(superExecution = null)
        whenever(execution.getVariableLocal("VTM_callDepth")).thenReturn(null)

        listener.onProcessStart(OperatonExecutionEvent(execution))

        verify(execution).setVariableLocal("VTM_callDepth", 0)
    }

    @Test
    fun `should warn and set depth when parent depth exceeds threshold`() {
        val listener = CallDepthExecutionListener(valtimoProperties(2))
        val parentExecution = mock<DelegateExecution>()
        whenever(parentExecution.getVariableLocal("VTM_callDepth")).thenReturn("2")

        val execution = executionWithProcessInstance(superExecution = parentExecution)
        whenever(execution.processBusinessKey).thenReturn("business-key")

        val targetLogger = LoggerFactory.getLogger(CallDepthExecutionListener::class.java) as Logger
        val listAppender = ListAppender<ILoggingEvent>().apply { start() }
        targetLogger.addAppender(listAppender)

        try {
            listener.onProcessStart(OperatonExecutionEvent(execution))
        } finally {
            targetLogger.detachAppender(listAppender)
            listAppender.stop()
        }

        verify(execution).setVariableLocal("VTM_callDepth", 3)
        assertTrue(listAppender.list.any {
            it.level == Level.WARN && it.formattedMessage.contains("Call depth for process with business key")
        })
    }

    @Test
    fun `should initialize parent depth when missing and set child depth`() {
        val listener = CallDepthExecutionListener(valtimoProperties(100))
        val parentExecution = mock<DelegateExecution>()
        val parentProcessInstance = mock<DelegateExecution>()
        whenever(parentProcessInstance.superExecution).thenReturn(null)
        whenever(parentExecution.processInstance).thenReturn(parentProcessInstance)
        whenever(parentExecution.getVariableLocal("VTM_callDepth")).thenReturn(null)

        val execution = executionWithProcessInstance(superExecution = parentExecution)

        listener.onProcessStart(OperatonExecutionEvent(execution))

        verify(parentExecution).setVariableLocal("VTM_callDepth", 0)
        verify(execution).setVariableLocal("VTM_callDepth", 1)
    }

    @Test
    fun `should increase depth when parent has a super execution and different ids`() {
        val listener = CallDepthExecutionListener(valtimoProperties(100))
        val grandExecution = mock<DelegateExecution>()
        val grandProcessInstance = mock<DelegateExecution>()
        whenever(grandExecution.getVariableLocal("VTM_callDepth")).thenReturn(1)
        whenever(grandExecution.processInstance).thenReturn(grandProcessInstance)

        val parentExecution = mock<DelegateExecution>()
        val parentProcessInstance = mock<DelegateExecution>()
        whenever(parentProcessInstance.superExecution).thenReturn(grandExecution)
        whenever(parentProcessInstance.processInstanceId).thenReturn("parent-instance")
        whenever(parentExecution.processInstance).thenReturn(parentProcessInstance)
        whenever(parentExecution.getVariableLocal("VTM_callDepth")).thenReturn(null)

        whenever(grandProcessInstance.processDefinitionId).thenReturn("grand-definition")

        val execution = executionWithProcessInstance(superExecution = parentExecution)

        listener.onProcessStart(OperatonExecutionEvent(execution))

        verify(parentExecution).setVariableLocal("VTM_callDepth", 2)
        verify(execution).setVariableLocal("VTM_callDepth", 3)
    }

    private fun executionWithProcessInstance(superExecution: DelegateExecution?): DelegateExecution {
        val processInstance = mock<DelegateExecution>()
        whenever(processInstance.superExecution).thenReturn(superExecution)
        val execution = mock<DelegateExecution>()
        whenever(execution.processInstance).thenReturn(processInstance)
        whenever(execution.eventName).thenReturn("start")
        return execution
    }

    private fun valtimoProperties(callDepthWarningThreshold: Int): ValtimoProperties {
        val process = ValtimoProperties.Process().apply {
            this.callDepthWarningThreshold = callDepthWarningThreshold
        }
        return ValtimoProperties(null, null, null, null, process)
    }
}
