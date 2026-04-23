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

package com.ritense.valtimo.processlink

import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.plugin.repository.PluginProcessLinkRepository
import com.ritense.plugin.service.PluginService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.event.OperatonExecutionEvent
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution

class ProcessLinkReceiveTaskEndListenerTest {

    lateinit var pluginProcessLinkRepository: PluginProcessLinkRepository
    lateinit var pluginService: PluginService
    lateinit var listener: ProcessLinkReceiveTaskEndListener

    @BeforeEach
    fun setup() {
        pluginProcessLinkRepository = mock()
        pluginService = mock()
        listener = ProcessLinkReceiveTaskEndListener(pluginProcessLinkRepository, pluginService)
    }

    @Test
    fun `should invoke plugin service for each matching process link`() {
        val execution: DelegateExecution = mock()
        whenever(execution.processDefinitionId).thenReturn("proc-def-1")
        whenever(execution.currentActivityId).thenReturn("receiveTask1")
        whenever(execution.processBusinessKey).thenReturn("doc-123")
        whenever(execution.eventName).thenReturn("start")

        val processLink1: PluginProcessLink = mock()
        val processLink2: PluginProcessLink = mock()
        whenever(
            pluginProcessLinkRepository.findByProcessDefinitionIdAndActivityIdAndActivityType(
                "proc-def-1", "receiveTask1", ActivityTypeWithEventName.RECEIVE_TASK_END
            )
        ).thenReturn(listOf(processLink1, processLink2))

        val event = OperatonExecutionEvent(execution)
        listener.notify(event)

        verify(pluginService).invoke(execution, processLink1)
        verify(pluginService).invoke(execution, processLink2)
    }

    @Test
    fun `should not invoke plugin service when no process links found`() {
        val execution: DelegateExecution = mock()
        whenever(execution.processDefinitionId).thenReturn("proc-def-1")
        whenever(execution.currentActivityId).thenReturn("receiveTask1")
        whenever(execution.processBusinessKey).thenReturn("doc-123")
        whenever(execution.eventName).thenReturn("start")

        whenever(
            pluginProcessLinkRepository.findByProcessDefinitionIdAndActivityIdAndActivityType(
                "proc-def-1", "receiveTask1", ActivityTypeWithEventName.RECEIVE_TASK_END
            )
        ).thenReturn(emptyList())

        val event = OperatonExecutionEvent(execution)
        listener.notify(event)

        verify(pluginService, never()).invoke(any<DelegateExecution>(), any())
    }
}
