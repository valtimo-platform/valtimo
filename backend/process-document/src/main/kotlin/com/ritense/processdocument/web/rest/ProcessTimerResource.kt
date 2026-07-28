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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.logging.LoggableResource
import com.ritense.processdocument.event.ProcessTimerSkippedEvent
import com.ritense.processdocument.service.ProcessInstanceCaseAccessService
import com.ritense.processdocument.web.rest.dto.JobInspectionDto
import com.ritense.processdocument.web.rest.dto.JobType
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.audit.utils.AuditHelper
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.utils.RequestHelper
import com.ritense.valtimo.operaton.authorization.OperatonTimerActionProvider
import com.ritense.valtimo.operaton.domain.OperatonTimer
import org.operaton.bpm.engine.ManagementService
import org.springframework.context.ApplicationEventPublisher
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api/v1/process-document", produces = [APPLICATION_JSON_UTF8_VALUE])
class ProcessTimerResource(
    private val caseAccessService: ProcessInstanceCaseAccessService,
    private val authorizationService: AuthorizationService,
    private val managementService: ManagementService,
    private val eventPublisher: ApplicationEventPublisher,
) {

    @Transactional(readOnly = true)
    @GetMapping("/case/{caseId}/process-instance/{processInstanceId}/timers")
    fun getSkippableTimers(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID,
        @PathVariable processInstanceId: String,
    ): ResponseEntity<List<JobInspectionDto>> {
        caseAccessService.requireBelongsToCase(caseId, processInstanceId)

        val timers = getTimerJobs(processInstanceId)
            .filter { hasCompletePermission(it.timer) }
            .map { it.dto }

        return ResponseEntity.ok(timers)
    }

    @Transactional
    @PostMapping("/case/{caseId}/process-instance/{processInstanceId}/timer/{jobId}/skip")
    fun skipTimer(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID,
        @PathVariable processInstanceId: String,
        @PathVariable jobId: String,
    ): ResponseEntity<Void> {
        caseAccessService.requireBelongsToCase(caseId, processInstanceId)

        val timer = getTimerJobs(processInstanceId).find { it.dto.id == jobId }
            ?: throw ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Timer job $jobId is not a skippable timer of process instance $processInstanceId"
            )

        requireCompletePermission(timer.timer)

        runWithoutAuthorization {
            managementService.executeJob(jobId)
        }

        publishTimerSkippedEvent(
            caseId = caseId,
            processInstanceId = processInstanceId,
            jobId = jobId,
            activityId = timer.dto.activityId,
        )

        return ResponseEntity.noContent().build()
    }

    private fun hasCompletePermission(timer: OperatonTimer) =
        authorizationService.hasPermission(completePermissionRequest(timer))

    private fun requireCompletePermission(timer: OperatonTimer) =
        authorizationService.requirePermission(completePermissionRequest(timer))

    private fun completePermissionRequest(timer: OperatonTimer) = EntityAuthorizationRequest(
        OperatonTimer::class.java,
        OperatonTimerActionProvider.COMPLETE,
        timer,
    )

    /**
     * Reads the active timers of a process instance from the engine. A process instance that is no
     * longer active has no jobs, so it simply yields an empty list.
     */
    private fun getTimerJobs(processInstanceId: String): List<TimerJob> = runWithoutAuthorization {
        val rawJobs = managementService.createJobQuery()
            .processInstanceId(processInstanceId)
            .list()
        val definitionsById = rawJobs.mapNotNull { it.jobDefinitionId }
            .distinct()
            .mapNotNull { jobDefinitionId ->
                managementService.createJobDefinitionQuery()
                    .jobDefinitionId(jobDefinitionId)
                    .singleResult()
            }
            .associateBy { it.id }
        rawJobs.map { job ->
            val definition = definitionsById[job.jobDefinitionId]
            TimerJob(
                dto = JobInspectionDto.from(job, definition),
                timer = OperatonTimer.from(job, definition),
            )
        }.filter { it.dto.jobType == JobType.TIMER }
    }

    private fun publishTimerSkippedEvent(
        caseId: UUID,
        processInstanceId: String,
        jobId: String,
        activityId: String?,
    ) {
        eventPublisher.publishEvent(
            ProcessTimerSkippedEvent(
                UUID.randomUUID(),
                RequestHelper.getOrigin(),
                LocalDateTime.now(),
                AuditHelper.getActor(),
                caseId,
                processInstanceId,
                jobId,
                activityId,
            )
        )
    }

    /**
     * Pairs the API representation of a timer with the authorization resource for the same timer.
     */
    private data class TimerJob(
        val dto: JobInspectionDto,
        val timer: OperatonTimer,
    )
}
