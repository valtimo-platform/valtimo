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

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.ManagementService
import org.operaton.bpm.engine.ProcessEngineException
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.runtime.Job
import org.springframework.stereotype.Service
import java.time.ZonedDateTime
import java.util.Date

@Service
@SkipComponentScan
class JobServiceImpl(
    private val managementService: ManagementService
): JobService {

    override fun addOffsetInMillisToTimerDueDateByActivityId(
        millisecondsToAdd: Long, activityId: String,
        execution: DelegateExecution
    ) {
        getJobByActivityIdAndProcessInstanceId(activityId, execution.processInstanceId).let { job ->
            val dueDate = Date.from(job.duedate.toInstant().plusMillis(millisecondsToAdd))
            managementService.setJobDuedate(job.id, dueDate).also {
                logger.debug {
                    "Changing the date of timer ${job.id} from ${job.duedate} to $dueDate " +
                        "for process instance ${job.processInstanceId}"
                }
            }
        }
    }

    override fun updateTimerDueDateByActivityId(
        dueDateString: String, activityId: String,
        execution: DelegateExecution
    ) {
        val dueDate = Date.from(ZonedDateTime.parse(dueDateString).toInstant())

        getJobByActivityIdAndProcessInstanceId(activityId, execution.processInstanceId).let { job ->
            managementService.setJobDuedate(job.id, dueDate).also {
                logger.debug {
                    "Changing the date of timer ${job.id} from ${job.duedate} to $dueDate " +
                        "for process instance ${job.processInstanceId}"
                }
            }
        }
    }

    private fun getJobByActivityIdAndProcessInstanceId(
        jobActivityId: String,
        processInstanceId: String,
    ): Job = managementService.createJobQuery()
        .timers()
        .processInstanceId(processInstanceId)
        .activityId(jobActivityId)
        .singleResult() ?:
            throw ProcessEngineException("No job with $jobActivityId found for process with Id $processInstanceId")

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}