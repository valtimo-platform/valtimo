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

package com.ritense.processdocument.web.rest.dto

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.management.JobDefinition
import org.operaton.bpm.engine.runtime.Job
import java.util.Date
import kotlin.test.assertEquals

class JobInspectionDtoTest {

    @Test
    fun `classify maps null rawJobType to OTHER`() {
        assertEquals(JobType.OTHER, JobType.classify(null))
    }

    @Test
    fun `classify maps plain timer to TIMER`() {
        assertEquals(JobType.TIMER, JobType.classify("timer"))
    }

    @Test
    fun `classify maps timer subtypes to TIMER`() {
        assertEquals(JobType.TIMER, JobType.classify("timer-start-event"))
        assertEquals(JobType.TIMER, JobType.classify("timer-intermediate-transition"))
        assertEquals(JobType.TIMER, JobType.classify("timer-transition"))
    }

    @Test
    fun `classify maps async-continuation to ASYNC_CONTINUATION`() {
        assertEquals(JobType.ASYNC_CONTINUATION, JobType.classify("async-continuation"))
    }

    @Test
    fun `classify maps plain message to MESSAGE`() {
        assertEquals(JobType.MESSAGE, JobType.classify("message"))
    }

    @Test
    fun `classify maps message subtypes to MESSAGE`() {
        assertEquals(JobType.MESSAGE, JobType.classify("message-foo"))
    }

    @Test
    fun `classify maps batch subtypes to BATCH`() {
        assertEquals(JobType.BATCH, JobType.classify("batch-some-operation"))
    }

    @Test
    fun `classify falls back to OTHER for unknown rawJobType`() {
        assertEquals(JobType.OTHER, JobType.classify("history-cleanup"))
        assertEquals(JobType.OTHER, JobType.classify(""))
    }

    @Test
    fun `from copies job fields and pulls activityId and jobType from JobDefinition`() {
        val dueDate = Date()
        val job = mock<Job>().also {
            whenever(it.id).thenReturn("job-1")
            whenever(it.jobDefinitionId).thenReturn("jd-1")
            whenever(it.executionId).thenReturn("exec-1")
            whenever(it.retries).thenReturn(2)
            whenever(it.exceptionMessage).thenReturn("boom")
            whenever(it.duedate).thenReturn(dueDate)
            whenever(it.isSuspended).thenReturn(false)
        }
        val definition = mock<JobDefinition>().also {
            whenever(it.activityId).thenReturn("Activity_timer")
            whenever(it.jobType).thenReturn("timer-intermediate-transition")
        }

        val dto = JobInspectionDto.from(job, definition)

        assertEquals("job-1", dto.id)
        assertEquals("jd-1", dto.jobDefinitionId)
        assertEquals("exec-1", dto.executionId)
        assertEquals("Activity_timer", dto.activityId)
        assertEquals(JobType.TIMER, dto.jobType)
        assertEquals(2, dto.retries)
        assertEquals("boom", dto.exceptionMessage)
        assertEquals(dueDate, dto.dueDate)
        assertEquals(false, dto.suspended)
    }

    @Test
    fun `from handles null JobDefinition by leaving activityId null and jobType OTHER`() {
        val job = mock<Job>().also {
            whenever(it.id).thenReturn("job-1")
            whenever(it.jobDefinitionId).thenReturn(null)
            whenever(it.executionId).thenReturn(null)
            whenever(it.retries).thenReturn(0)
            whenever(it.exceptionMessage).thenReturn(null)
            whenever(it.duedate).thenReturn(null)
            whenever(it.isSuspended).thenReturn(true)
        }

        val dto = JobInspectionDto.from(job, null)

        assertNull(dto.activityId)
        assertEquals(JobType.OTHER, dto.jobType)
        assertEquals(true, dto.suspended)
    }
}
