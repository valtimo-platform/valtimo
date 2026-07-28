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

package com.ritense.processdocument.web.rest

import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.Document
import com.ritense.processdocument.domain.ProcessDocumentInstanceId
import com.ritense.processdocument.domain.ProcessInstanceId
import com.ritense.processdocument.domain.impl.ProcessDocumentInstanceDto
import com.ritense.processdocument.event.ProcessTimerSkippedEvent
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.processdocument.service.ProcessInstanceCaseAccessService
import com.ritense.valtimo.operaton.authorization.OperatonTimerActionProvider
import com.ritense.valtimo.operaton.domain.OperatonTimer
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.Mockito.RETURNS_DEEP_STUBS
import org.mockito.kotlin.any
import org.mockito.kotlin.argThat
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.ManagementService
import org.operaton.bpm.engine.management.JobDefinition
import org.operaton.bpm.engine.runtime.Job
import org.springframework.context.ApplicationEventPublisher
import org.springframework.web.server.ResponseStatusException

class ProcessTimerResourceTest {

    private lateinit var authorizationService: AuthorizationService
    private lateinit var processDocumentAssociationService: ProcessDocumentAssociationService
    private lateinit var managementService: ManagementService
    private lateinit var eventPublisher: ApplicationEventPublisher

    private lateinit var resource: ProcessTimerResource

    private val caseId: UUID = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        authorizationService = mock()
        processDocumentAssociationService = mock()
        managementService = mock(defaultAnswer = RETURNS_DEEP_STUBS)
        eventPublisher = mock()

        val caseAccessService = ProcessInstanceCaseAccessService(
            processDocumentAssociationService
        )

        resource = ProcessTimerResource(
            caseAccessService = caseAccessService,
            authorizationService = authorizationService,
            managementService = managementService,
            eventPublisher = eventPublisher,
        )
    }

    @Test
    fun `skip should require COMPLETE permission on the timer`() {
        val processInstanceId = associateInstance()
        stubJobsForInstance(processInstanceId, Triple("job-1", "timer", "timerBoundary"))

        resource.skipTimer(caseId, processInstanceId, "job-1")

        verify(authorizationService).requirePermission(
            argThat<EntityAuthorizationRequest<OperatonTimer>> {
                resourceType == OperatonTimer::class.java &&
                    action == OperatonTimerActionProvider.COMPLETE &&
                    entities.single().id == "job-1"
            }
        )
    }

    @Test
    fun `skip should execute the timer job and publish event`() {
        val processInstanceId = associateInstance()
        stubJobsForInstance(processInstanceId, Triple("job-1", "timer", "timerBoundary"))

        val response = resource.skipTimer(caseId, processInstanceId, "job-1")

        assertEquals(204, response.statusCode.value())
        verify(managementService).executeJob("job-1")

        val eventCaptor = argumentCaptor<ProcessTimerSkippedEvent>()
        verify(eventPublisher).publishEvent(eventCaptor.capture())
        val event = eventCaptor.firstValue
        assertEquals("job-1", event.getJobId())
        assertEquals("timerBoundary", event.getActivityId())
        assertEquals(processInstanceId, event.getProcessInstanceId())
        assertEquals(caseId, event.documentId)
    }

    @Test
    fun `skip should return 404 when job is not a skippable timer of the instance`() {
        val processInstanceId = associateInstance()
        stubJobsForInstance(processInstanceId, Triple("async-1", "async-continuation", "someTask"))

        val ex = assertThrows<ResponseStatusException> {
            resource.skipTimer(caseId, processInstanceId, "async-1")
        }
        assertEquals(404, ex.statusCode.value())
        verify(managementService, never()).executeJob(any())
        verify(eventPublisher, never()).publishEvent(any<Any>())
    }

    @Test
    fun `skip should return 404 when process instance does not belong to case`() {
        val processInstanceId = UUID.randomUUID().toString()
        whenever(processDocumentAssociationService.findProcessDocumentInstanceDtos(any<Document.Id>())).thenReturn(emptyList())

        val ex = assertThrows<ResponseStatusException> {
            resource.skipTimer(caseId, processInstanceId, "job-1")
        }
        assertEquals(404, ex.statusCode.value())
        verify(managementService, never()).executeJob(any())
    }

    @Test
    fun `skip should return 404 when process instance has no jobs`() {
        val processInstanceId = associateInstance()
        stubJobsForInstance(processInstanceId)

        val ex = assertThrows<ResponseStatusException> {
            resource.skipTimer(caseId, processInstanceId, "job-1")
        }
        assertEquals(404, ex.statusCode.value())
        verify(managementService, never()).executeJob(any())
    }

    @Test
    fun `getSkippableTimers should only return timer jobs the user may complete`() {
        val processInstanceId = associateInstance()
        stubJobsForInstance(
            processInstanceId,
            Triple("job-1", "timer", "timerBoundary"),
            Triple("async-1", "async-continuation", "someTask"),
        )
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<OperatonTimer>>())).thenReturn(true)

        val response = resource.getSkippableTimers(caseId, processInstanceId)

        assertEquals(200, response.statusCode.value())
        assertEquals(1, response.body!!.size)
        assertEquals("job-1", response.body!!.single().id)

        verify(authorizationService).hasPermission(
            argThat<EntityAuthorizationRequest<OperatonTimer>> {
                resourceType == OperatonTimer::class.java &&
                    action == OperatonTimerActionProvider.COMPLETE &&
                    entities.single().id == "job-1"
            }
        )
    }

    @Test
    fun `getSkippableTimers should not return timers the user may not complete`() {
        val processInstanceId = associateInstance()
        stubJobsForInstance(processInstanceId, Triple("job-1", "timer", "timerBoundary"))
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<OperatonTimer>>())).thenReturn(false)

        val response = resource.getSkippableTimers(caseId, processInstanceId)

        assertEquals(200, response.statusCode.value())
        assertTrue(response.body!!.isEmpty())
    }

    private fun associateInstance(): String {
        val processInstanceId = UUID.randomUUID().toString()
        val pInstanceId = mock<ProcessInstanceId>()
        whenever(pInstanceId.toString()).thenReturn(processInstanceId)
        val id = mock<ProcessDocumentInstanceId>()
        whenever(id.processInstanceId()).thenReturn(pInstanceId)
        val instance = ProcessDocumentInstanceDto(id, "p", true, 1, 1, null, null)
        whenever(processDocumentAssociationService.findProcessDocumentInstanceDtos(any<Document.Id>()))
            .thenReturn(listOf(instance))
        return processInstanceId
    }

    private fun stubJobsForInstance(processInstanceId: String, vararg specs: Triple<String, String, String?>) {
        val jobs = specs.map { (jobId, jobType, activityId) ->
            val jobDefinitionId = "jobdef-$jobId"
            val job = mock<Job>()
            whenever(job.id).thenReturn(jobId)
            whenever(job.jobDefinitionId).thenReturn(jobDefinitionId)
            whenever(job.processInstanceId).thenReturn(processInstanceId)
            val jobDefinition = mock<JobDefinition>()
            whenever(jobDefinition.id).thenReturn(jobDefinitionId)
            whenever(jobDefinition.activityId).thenReturn(activityId)
            whenever(jobDefinition.jobType).thenReturn(jobType)
            whenever(
                managementService.createJobDefinitionQuery()
                    .jobDefinitionId(jobDefinitionId)
                    .singleResult()
            ).thenReturn(jobDefinition)
            job
        }
        whenever(
            managementService.createJobQuery()
                .processInstanceId(processInstanceId)
                .list()
        ).thenReturn(jobs)
    }
}
