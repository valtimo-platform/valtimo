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

import org.operaton.bpm.engine.management.JobDefinition
import org.operaton.bpm.engine.runtime.Job
import java.util.Date

/**
 * Inspection-friendly view of an Operaton runtime job.
 *
 * The engine's internal job-type discriminators (`async-continuation`,
 * `timer-intermediate-transition`, etc.) are mapped onto a small set of
 * stable categories on [JobType]; the BPMN activity the job belongs to is
 * looked up via the job's [JobDefinition] so the inspector can show which
 * node a job is associated with.
 */
data class JobInspectionDto(
    val id: String,
    val jobDefinitionId: String?,
    val executionId: String?,
    val activityId: String?,
    val jobType: JobType,
    val retries: Int,
    val exceptionMessage: String?,
    val dueDate: Date?,
    val suspended: Boolean,
) {
    companion object {
        fun from(job: Job, definition: JobDefinition?): JobInspectionDto = JobInspectionDto(
            id = job.id,
            jobDefinitionId = job.jobDefinitionId,
            executionId = job.executionId,
            activityId = definition?.activityId,
            jobType = JobType.classify(definition?.jobType),
            retries = job.retries,
            exceptionMessage = job.exceptionMessage,
            dueDate = job.duedate,
            suspended = job.isSuspended,
        )
    }
}

/**
 * Stable, frontend-translatable categorisation of Operaton's many internal
 * job-type strings. Keep small — the inspector only needs to communicate
 * "is this a timer, an async continuation, or something else".
 */
enum class JobType {
    /** Timer events (start, intermediate, boundary). */
    TIMER,

    /** Asynchronous continuation queued via `asyncBefore` / `asyncAfter`. */
    ASYNC_CONTINUATION,

    /** Message-correlation that has been deferred to the job executor. */
    MESSAGE,

    /** Batch operations seeded by the engine. */
    BATCH,

    /** Anything we don't have a dedicated bucket for. */
    OTHER;

    companion object {
        fun classify(rawJobType: String?): JobType = when {
            rawJobType == null -> OTHER
            rawJobType == "timer" || rawJobType.startsWith("timer-") -> TIMER
            rawJobType == "async-continuation" -> ASYNC_CONTINUATION
            rawJobType == "message" || rawJobType.startsWith("message-") -> MESSAGE
            rawJobType.startsWith("batch-") -> BATCH
            else -> OTHER
        }
    }
}
