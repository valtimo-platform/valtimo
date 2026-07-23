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
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.ProcessEngine
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.Date
import java.util.UUID
import kotlin.test.assertEquals

@Transactional
class JobServiceImplIntTest: BaseIntegrationTest() {

    @Autowired
    lateinit var processEngine: ProcessEngine

    @Autowired
    lateinit var jobService: JobServiceImpl

    @Autowired
    lateinit var operatonProcessService: OperatonProcessService

    private val caseDefinitionId = CaseDefinitionId.of("everything", "1.0.0")

    @Test
    fun `should delay job`(){
        val testProcessDefinition = "test-timer-event"
        val testProcessInstance = AuthorizationContext.runWithoutAuthorization {
            operatonProcessService.startProcess(
                testProcessDefinition,
                UUID.randomUUID().toString(),
                caseDefinitionId,
                null
            )
        }
        processEngine.runtimeService.createMessageCorrelation("message-start-event-offset-delay")
            .processInstanceBusinessKey(testProcessInstance.processInstanceDto.businessKey)
            .correlate()
        val job = processEngine.managementService.createJobQuery().timers().activityId("test-timer").singleResult()
        assertEquals(Date.from(Instant.parse("2150-01-01T00:00:00Z")).toString(), job.duedate.toString())
    }

    @Test
    fun `should move the job forward`(){
        val testProcessDefinition = "test-timer-event"
        val testProcessInstance = AuthorizationContext.runWithoutAuthorization {
            operatonProcessService.startProcess(
                testProcessDefinition,
                UUID.randomUUID().toString(),
                caseDefinitionId,
                null
            )
        }
        processEngine.runtimeService.createMessageCorrelation("message-start-event-offset-forward")
            .processInstanceBusinessKey(testProcessInstance.processInstanceDto.businessKey)
            .correlate()
        val job = processEngine.managementService.createJobQuery().timers().activityId("test-timer").singleResult()
        assertEquals(Date.from(Instant.parse("2149-12-31T23:00:00Z")).toString(), job.duedate.toString())
    }

    @Test
    fun `should change job date`(){
        val testProcessDefinition = "test-timer-event"
        val testProcessInstance = AuthorizationContext.runWithoutAuthorization {
            operatonProcessService.startProcess(
                testProcessDefinition,
                UUID.randomUUID().toString(),
                caseDefinitionId,
                null
            )
        }
        processEngine.runtimeService.createMessageCorrelation("message-start-event-change-date")
            .processInstanceBusinessKey(testProcessInstance.processInstanceDto.businessKey)
            .correlate()
        val job = processEngine.managementService.createJobQuery().timers().activityId("test-timer").singleResult()
        assertEquals(Date.from(Instant.parse("2300-01-01T00:00:00Z")).toString(), job.duedate.toString())
    }

}