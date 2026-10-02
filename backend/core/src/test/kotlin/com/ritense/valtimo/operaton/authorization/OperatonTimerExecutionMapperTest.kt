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

package com.ritense.valtimo.operaton.authorization

import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.domain.OperatonTimer
import com.ritense.valtimo.operaton.repository.OperatonExecutionRepository
import java.util.Optional
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

class OperatonTimerExecutionMapperTest {

    private val operatonExecutionRepository: OperatonExecutionRepository = mock()

    private val mapper = OperatonTimerExecutionMapper(operatonExecutionRepository)

    @Test
    fun `should map timer to the execution of its process instance`() {
        val execution = mock<OperatonExecution>()
        whenever(operatonExecutionRepository.findById("process-instance-id"))
            .thenReturn(Optional.of(execution))

        val related = mapper.mapRelated(OperatonTimer(id = "job-1", processInstanceId = "process-instance-id"))

        assertEquals(listOf(execution), related)
    }

    @Test
    fun `should map to nothing when the execution no longer exists`() {
        whenever(operatonExecutionRepository.findById("process-instance-id"))
            .thenReturn(Optional.empty())

        val related = mapper.mapRelated(OperatonTimer(id = "job-1", processInstanceId = "process-instance-id"))

        assertTrue(related.isEmpty())
    }

    @Test
    fun `should map to nothing when the timer has no process instance`() {
        val related = mapper.mapRelated(OperatonTimer(id = "job-1"))

        assertTrue(related.isEmpty())
    }

    @Test
    fun `should only support mapping a timer to an execution`() {
        assertTrue(mapper.supports(OperatonTimer::class.java, OperatonExecution::class.java))
        assertFalse(mapper.supports(OperatonTimer::class.java, OperatonProcessDefinition::class.java))
        assertFalse(mapper.supports(OperatonExecution::class.java, OperatonExecution::class.java))
    }
}
