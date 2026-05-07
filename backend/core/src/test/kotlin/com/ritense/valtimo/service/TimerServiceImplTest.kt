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

package com.ritense.valtimo.service

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.ManagementService
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.management.JobDefinition
import org.operaton.bpm.engine.management.JobDefinitionQuery
import org.operaton.bpm.engine.runtime.Job
import org.operaton.bpm.engine.runtime.JobQuery
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.operaton.bpm.engine.runtime.ProcessInstanceQuery
import java.time.Instant
import java.util.Date

class TimerServiceImplTest {

    private lateinit var managementServiceMock: ManagementService
    private lateinit var runtimeServiceMock: RuntimeService
    private lateinit var processInstanceQueryMock: ProcessInstanceQuery
    private lateinit var jobQueryMock: JobQuery
    private lateinit var jobDefinitionQueryMock: JobDefinitionQuery

    private lateinit var timerService: TimerServiceImpl

    @BeforeEach
    fun setUp() {
        managementServiceMock = mock()
        runtimeServiceMock = mock()
        processInstanceQueryMock = mock()
        jobQueryMock = mock()
        jobDefinitionQueryMock = mock()

        whenever(runtimeServiceMock.createProcessInstanceQuery())
            .thenReturn(processInstanceQueryMock)
        whenever(processInstanceQueryMock.processInstanceBusinessKey(any()))
            .thenReturn(processInstanceQueryMock)
        whenever(processInstanceQueryMock.active())
            .thenReturn(processInstanceQueryMock)

        whenever(managementServiceMock.createJobQuery())
            .thenReturn(jobQueryMock)
        whenever(jobQueryMock.timers()).thenReturn(jobQueryMock)
        whenever(jobQueryMock.active()).thenReturn(jobQueryMock)

        whenever(managementServiceMock.createJobDefinitionQuery())
            .thenReturn(jobDefinitionQueryMock)

        timerService = TimerServiceImpl(
            managementService = managementServiceMock,
            runtimeService = runtimeServiceMock
        )
    }

    @Test
    fun `should return 0 and not call setJobDuedate when no process instances match business key`() {
        whenever(processInstanceQueryMock.list()).thenReturn(emptyList())

        val updated = timerService.updateActiveTimers(businessKey(), newDate())

        assertThat(updated).isEqualTo(0)
        verify(managementServiceMock, never()).setJobDuedate(any(), any())
    }

    @Test
    fun `should return 0 when process instances exist but have no timer jobs`() {
        mockProcessInstances(listOf(processInstance(id = "pi-1")))
        mockTimerJobsFor("pi-1", emptyList())

        val updated = timerService.updateActiveTimers(businessKey(), newDate())

        assertThat(updated).isEqualTo(0)
        verify(managementServiceMock, never()).setJobDuedate(any(), any())
    }

    @Test
    fun `should update all timer jobs across all matching process instances when no activityIds supplied`() {
        mockProcessInstances(listOf(processInstance(id = "pi-1")))
        val jobA = timerJob(id = "job-a", jobDefinitionId = "jd-a")
        val jobB = timerJob(id = "job-b", jobDefinitionId = "jd-b")
        mockTimerJobsFor("pi-1", listOf(jobA, jobB))
        mockJobDefinition("jd-a", "activity-a")
        mockJobDefinition("jd-b", "activity-b")

        val updated = timerService.updateActiveTimers(businessKey(), newDate())

        assertThat(updated).isEqualTo(2)
        verify(managementServiceMock).setJobDuedate(eq("job-a"), any())
        verify(managementServiceMock).setJobDuedate(eq("job-b"), any())
    }

    @Test
    fun `should update only jobs whose activityId is in the supplied vararg`() {
        mockProcessInstances(listOf(processInstance(id = "pi-1")))
        val jobA = timerJob(id = "job-a", jobDefinitionId = "jd-a")
        val jobB = timerJob(id = "job-b", jobDefinitionId = "jd-b")
        mockTimerJobsFor("pi-1", listOf(jobA, jobB))
        mockJobDefinition("jd-a", "activity-a")
        mockJobDefinition("jd-b", "activity-b")

        val updated = timerService.updateActiveTimers(businessKey(), newDate(), "activity-a")

        assertThat(updated).isEqualTo(1)
        verify(managementServiceMock).setJobDuedate(eq("job-a"), any())
        verify(managementServiceMock, never()).setJobDuedate(eq("job-b"), any())
    }

    @Test
    fun `should leave non-matching jobs untouched when activityIds supplied`() {
        mockProcessInstances(listOf(processInstance(id = "pi-1")))
        val jobA = timerJob(id = "job-a", jobDefinitionId = "jd-a")
        val jobB = timerJob(id = "job-b", jobDefinitionId = "jd-b")
        val jobC = timerJob(id = "job-c", jobDefinitionId = "jd-c")
        mockTimerJobsFor("pi-1", listOf(jobA, jobB, jobC))
        mockJobDefinition("jd-a", "activity-a")
        mockJobDefinition("jd-b", "activity-b")
        mockJobDefinition("jd-c", "activity-c")

        val updated = timerService.updateActiveTimers(businessKey(), newDate(), "activity-a", "activity-c")

        assertThat(updated).isEqualTo(2)
        verify(managementServiceMock).setJobDuedate(eq("job-a"), any())
        verify(managementServiceMock, never()).setJobDuedate(eq("job-b"), any())
        verify(managementServiceMock).setJobDuedate(eq("job-c"), any())
    }

    @Test
    fun `should aggregate jobs across multiple process instances for the same business key`() {
        mockProcessInstances(
            listOf(
                processInstance(id = "pi-1"),
                processInstance(id = "pi-2")
            )
        )
        mockTimerJobsFor("pi-1", listOf(timerJob(id = "job-1", jobDefinitionId = "jd-a")))
        mockTimerJobsFor("pi-2", listOf(timerJob(id = "job-2", jobDefinitionId = "jd-b")))
        mockJobDefinition("jd-a", "activity-a")
        mockJobDefinition("jd-b", "activity-b")

        val updated = timerService.updateActiveTimers(businessKey(), newDate())

        assertThat(updated).isEqualTo(2)
        verify(managementServiceMock).setJobDuedate(eq("job-1"), any())
        verify(managementServiceMock).setJobDuedate(eq("job-2"), any())
    }

    @Test
    fun `should throw IllegalArgumentException when newDate is not valid ISO-8601 and not invoke engine`() {
        assertThrows<IllegalArgumentException> {
            timerService.updateActiveTimers(businessKey(), "not-a-date")
        }.let { exception ->
            assertThat(exception.message).startsWith("updateActiveTimers(): invalid date format:")
        }

        verify(runtimeServiceMock, never()).createProcessInstanceQuery()
        verify(managementServiceMock, never()).setJobDuedate(any(), any())
    }

    @Test
    fun `should return 0 cleanly for empty businessKey`() {
        whenever(processInstanceQueryMock.list()).thenReturn(emptyList())

        val updated = timerService.updateActiveTimers("", newDate())

        assertThat(updated).isEqualTo(0)
        verify(managementServiceMock, never()).setJobDuedate(any(), any())
    }

    @Test
    fun `should pass the parsed Date to managementService setJobDuedate with UTC instant equal to newDate`() {
        mockProcessInstances(listOf(processInstance(id = "pi-1")))
        mockTimerJobsFor("pi-1", listOf(timerJob(id = "job-a", jobDefinitionId = "jd-a")))
        mockJobDefinition("jd-a", "activity-a")

        timerService.updateActiveTimers(businessKey(), newDate())

        val dateCaptor = argumentCaptor<Date>()
        verify(managementServiceMock).setJobDuedate(eq("job-a"), dateCaptor.capture())
        assertThat(dateCaptor.firstValue.toInstant()).isEqualTo(Instant.parse(newDate()))
    }

    @Test
    fun `should chain active() on ProcessInstanceQuery`() {
        whenever(processInstanceQueryMock.list()).thenReturn(emptyList())

        timerService.updateActiveTimers(businessKey(), newDate())

        verify(processInstanceQueryMock).active()
    }

    @Test
    fun `should chain active() on JobQuery`() {
        mockProcessInstances(listOf(processInstance(id = "pi-1")))
        mockTimerJobsFor("pi-1", emptyList())

        timerService.updateActiveTimers(businessKey(), newDate())

        verify(jobQueryMock).active()
    }

    @Test
    fun `should skip timer jobs with retries=0 and still update the rest, returning only the updated count`() {
        mockProcessInstances(listOf(processInstance(id = "pi-1")))
        val failedJob = timerJob(id = "job-failed", jobDefinitionId = "jd-a", retries = 0)
        val goodJob = timerJob(id = "job-good", jobDefinitionId = "jd-b", retries = 3)
        mockTimerJobsFor("pi-1", listOf(failedJob, goodJob))
        mockJobDefinition("jd-a", "activity-a")
        mockJobDefinition("jd-b", "activity-b")

        val updated = timerService.updateActiveTimers(businessKey(), newDate())

        assertThat(updated).isEqualTo(1)
        verify(managementServiceMock, never()).setJobDuedate(eq("job-failed"), any())
        verify(managementServiceMock).setJobDuedate(eq("job-good"), any())
    }

    @Test
    fun `should return 0 when every matching job has retries=0`() {
        mockProcessInstances(listOf(processInstance(id = "pi-1")))
        mockTimerJobsFor(
            "pi-1",
            listOf(
                timerJob(id = "job-a", jobDefinitionId = "jd-a", retries = 0),
                timerJob(id = "job-b", jobDefinitionId = "jd-b", retries = 0)
            )
        )
        mockJobDefinition("jd-a", "activity-a")
        mockJobDefinition("jd-b", "activity-b")

        val updated = timerService.updateActiveTimers(businessKey(), newDate())

        assertThat(updated).isEqualTo(0)
        verify(managementServiceMock, never()).setJobDuedate(any(), any())
    }

    private fun mockProcessInstances(instances: List<ProcessInstance>) {
        whenever(processInstanceQueryMock.list()).thenReturn(instances)
    }

    private fun mockTimerJobsFor(processInstanceId: String, jobs: List<Job>): JobQuery {
        val perPiQueryMock: JobQuery = mock {
            on { list() } doReturn jobs
        }
        whenever(jobQueryMock.processInstanceId(eq(processInstanceId))).thenReturn(perPiQueryMock)
        return perPiQueryMock
    }

    private fun mockJobDefinition(jobDefinitionId: String, activityId: String) {
        val jobDefinition: JobDefinition = mock {
            on { this.id } doReturn jobDefinitionId
            on { this.activityId } doReturn activityId
        }
        val perIdQueryMock: JobDefinitionQuery = mock {
            on { singleResult() } doReturn jobDefinition
        }
        whenever(jobDefinitionQueryMock.jobDefinitionId(eq(jobDefinitionId))).thenReturn(perIdQueryMock)
    }

    private fun processInstance(id: String): ProcessInstance = mock {
        on { this.id } doReturn id
    }

    private fun timerJob(
        id: String,
        jobDefinitionId: String,
        retries: Int = 3
    ): Job = mock {
        on { this.id } doReturn id
        on { this.jobDefinitionId } doReturn jobDefinitionId
        on { this.retries } doReturn retries
        on { this.processInstanceId } doReturn "pi-any"
        on { this.exceptionMessage } doReturn null
    }

    private fun businessKey() = "bk-123"
    private fun newDate() = "2026-05-01T00:00:00Z"
}
