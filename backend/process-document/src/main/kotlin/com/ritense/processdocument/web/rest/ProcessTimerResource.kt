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
import com.ritense.valtimo.operaton.authorization.OperatonExecutionActionProvider
import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.repository.OperatonExecutionRepository
import org.operaton.bpm.engine.ManagementService
import org.springframework.context.ApplicationEventPublisher
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
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
    private val operatonExecutionRepository: OperatonExecutionRepository,
    private val managementService: ManagementService,
    private val eventPublisher: ApplicationEventPublisher,
) {

    @GetMapping("/case/{caseId}/process-instance/{processInstanceId}/timers")
    fun getSkippableTimers(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID,
        @PathVariable processInstanceId: String,
    ): ResponseEntity<List<JobInspectionDto>> {
        requireExecutionModifyPermission(processInstanceId)
        caseAccessService.requireBelongsToCase(caseId, processInstanceId)

        return ResponseEntity.ok(getTimerJobs(processInstanceId))
    }

    @PostMapping("/case/{caseId}/process-instance/{processInstanceId}/timer/{jobId}/skip")
    fun skipTimer(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID,
        @PathVariable processInstanceId: String,
        @PathVariable jobId: String,
    ): ResponseEntity<Void> {
        requireExecutionModifyPermission(processInstanceId)
        caseAccessService.requireBelongsToCase(caseId, processInstanceId)

        val timer = getTimerJobs(processInstanceId).find { it.id == jobId }
            ?: throw ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Timer job $jobId is not a skippable timer of process instance $processInstanceId"
            )

        runWithoutAuthorization {
            managementService.executeJob(jobId)
        }

        publishTimerSkippedEvent(
            caseId = caseId,
            processInstanceId = processInstanceId,
            jobId = jobId,
            activityId = timer.activityId,
        )

        return ResponseEntity.noContent().build()
    }

    /**
     * Loads the process-instance-level execution and requires the [OperatonExecutionActionProvider.MODIFY]
     * permission on it. The process-instance execution row has `ID_ == PROC_INST_ID_`, so it is loaded by
     * [processInstanceId]. A missing execution means the instance is not active.
     */
    private fun requireExecutionModifyPermission(processInstanceId: String) {
        val execution = runWithoutAuthorization {
            operatonExecutionRepository.findById(processInstanceId).orElse(null)
        } ?: throw ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "Process instance $processInstanceId is not active"
        )

        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                OperatonExecution::class.java,
                OperatonExecutionActionProvider.MODIFY,
                execution,
            )
        )
    }

    private fun getTimerJobs(processInstanceId: String): List<JobInspectionDto> = runWithoutAuthorization {
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
        rawJobs.map { job -> JobInspectionDto.from(job, definitionsById[job.jobDefinitionId]) }
            .filter { it.jobType == JobType.TIMER }
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
}
