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

import com.ritense.authorization.AuthorizationContext
import com.ritense.valtimo.BaseIntegrationTest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.ProcessEngine
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.Date
import java.util.UUID

@Transactional
class TimerServiceImplIntTest : BaseIntegrationTest() {

    @Autowired
    private lateinit var timerService: TimerServiceImpl

    @Autowired
    private lateinit var processEngine: ProcessEngine

    @Autowired
    private lateinit var operatonProcessService: OperatonProcessService

    private val caseDefinitionId = CaseDefinitionId.of("everything", "1.0.0")
    private val newDate = "2027-01-01T00:00:00Z"
    private val originalDate = "2149-12-31T23:59:59Z"

    @Test
    fun `should update timer job duedate to the supplied date`() {
        val businessKey = startTimerProcess()

        val updated = timerService.updateActiveTimers(businessKey, newDate)

        assertThat(updated).isEqualTo(1)
        val job = processEngine.managementService.createJobQuery()
            .timers().activityId("test-timer").singleResult()
        assertThat(job.duedate).isEqualTo(Date.from(Instant.parse(newDate)))
    }

    @Test
    fun `should return 0 and leave jobs untouched when no process instance matches the business key`() {
        startTimerProcess()

        val updated = timerService.updateActiveTimers("no-such-business-key", newDate)

        assertThat(updated).isEqualTo(0)
        val job = processEngine.managementService.createJobQuery()
            .timers().activityId("test-timer").singleResult()
        assertThat(job.duedate).isEqualTo(Date.from(Instant.parse(originalDate)))
    }

    @Test
    fun `should update only the job whose activityId matches the supplied filter`() {
        val businessKey = startTimerProcess()

        val updated = timerService.updateActiveTimers(businessKey, newDate, "test-timer")

        assertThat(updated).isEqualTo(1)
        val job = processEngine.managementService.createJobQuery()
            .timers().activityId("test-timer").singleResult()
        assertThat(job.duedate).isEqualTo(Date.from(Instant.parse(newDate)))
    }

    @Test
    fun `should return 0 and not update when activityId filter matches no jobs`() {
        val businessKey = startTimerProcess()

        val updated = timerService.updateActiveTimers(businessKey, newDate, "non-existent-activity")

        assertThat(updated).isEqualTo(0)
        val job = processEngine.managementService.createJobQuery()
            .timers().activityId("test-timer").singleResult()
        assertThat(job.duedate).isEqualTo(Date.from(Instant.parse(originalDate)))
    }

    @Test
    fun `should update timer jobs across multiple process instances sharing the same business key`() {
        val businessKey = UUID.randomUUID().toString()
        startTimerProcess(businessKey)
        startTimerProcess(businessKey)

        val updated = timerService.updateActiveTimers(businessKey, newDate)

        assertThat(updated).isEqualTo(2)
        val jobs = processEngine.managementService.createJobQuery()
            .timers().activityId("test-timer").list()
        assertThat(jobs).hasSize(2)
            .allSatisfy { job -> assertThat(job.duedate).isEqualTo(Date.from(Instant.parse(newDate))) }
    }

    @Test
    fun `should skip timer job with retries exhausted and not update its duedate`() {
        val businessKey = startTimerProcess()
        val job = processEngine.managementService.createJobQuery()
            .timers().activityId("test-timer").singleResult()
        processEngine.managementService.setJobRetries(job.id, 0)

        val updated = timerService.updateActiveTimers(businessKey, newDate)

        assertThat(updated).isEqualTo(0)
        val jobAfter = processEngine.managementService.createJobQuery()
            .timers().activityId("test-timer").singleResult()
        assertThat(jobAfter.duedate).isEqualTo(Date.from(Instant.parse(originalDate)))
    }

    private fun startTimerProcess(businessKey: String = UUID.randomUUID().toString()): String {
        AuthorizationContext.runWithoutAuthorization {
            operatonProcessService.startProcess(
                "test-timer-event",
                businessKey,
                caseDefinitionId,
                null
            )
        }
        return businessKey
    }
}
