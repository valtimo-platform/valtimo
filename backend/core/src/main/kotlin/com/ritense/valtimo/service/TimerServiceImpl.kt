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
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.runtime.Job
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.format.DateTimeParseException
import java.util.Date

@Service
@SkipComponentScan
class TimerServiceImpl(
    private val managementService: ManagementService,
    private val runtimeService: RuntimeService,
) : TimerService {
    override fun updateActiveTimers(
        businessKey: String,
        newDate: String,
    ): Int = updateActiveTimers(businessKey, newDate, activityIds = emptyArray())

    override fun updateActiveTimers(
        businessKey: String,
        newDate: String,
        vararg activityIds: String,
    ): Int =
        parseDueDate(newDate).let { dueDate ->
            runtimeService
                .createProcessInstanceQuery()
                .processInstanceBusinessKey(businessKey)
                .active()
                .list()
                .ifEmpty {
                    logger.info {
                        "updateActiveTimers(): no active process instances for businessKey='$businessKey' — nothing to update"
                    }
                    emptyList()
                }.flatMap { pi ->
                    managementService
                        .createJobQuery()
                        .timers()
                        .active()
                        .processInstanceId(pi.id)
                        .list()
                }.let { jobs -> jobs.map { it to resolveActivityId(it) } }
                .filter { (_, activityId) ->
                    activityIds.isEmpty() || (activityId != null && activityIds.contains(activityId))
                }.partition { (job, _) -> job.retries <= 0 }
                .let { (failed, updatable) ->
                    failed.onEach { (job, activityId) ->
                        logger.info {
                            "=> skipping failed timer job(id=${job.id}, activityId=$activityId, " +
                                "processInstanceId=${job.processInstanceId}, " +
                                "exception='${job.exceptionMessage}') — retries exhausted"
                        }
                    }
                    updatable
                        .onEach { (job, activityId) ->
                            logger.debug { "=> rescheduling timer job(id=${job.id}, activityId=$activityId) to $newDate" }
                            managementService.setJobDuedate(job.id, dueDate)
                        }.size
                        .also { updatedCount ->
                            logger.info {
                                "updateActiveTimers(): businessKey='$businessKey', newDate='$newDate', " +
                                    "activityIdFilter=${activityIds.toList()}, " +
                                    "skippedFailed=${failed.size}, updated=$updatedCount"
                            }
                        }
                }
        }

    private fun resolveActivityId(job: Job): String? =
        job.jobDefinitionId?.let { jobDefinitionId ->
            managementService
                .createJobDefinitionQuery()
                .jobDefinitionId(jobDefinitionId)
                .singleResult()
                ?.activityId
        }

    private fun parseDueDate(newDate: String): Date =
        try {
            Date.from(Instant.parse(newDate))
        } catch (e: DateTimeParseException) {
            throw IllegalArgumentException("updateActiveTimers(): invalid date format: $newDate", e)
        }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}