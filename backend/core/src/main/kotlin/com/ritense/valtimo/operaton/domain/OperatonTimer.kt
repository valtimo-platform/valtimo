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

package com.ritense.valtimo.operaton.domain

import org.operaton.bpm.engine.management.JobDefinition
import org.operaton.bpm.engine.runtime.Job
import java.util.Date

/**
 * A timer of a running process instance.
 *
 * Timers are a resource of their own so that permissions on them are independent of permissions on
 * the process execution they belong to. Operaton stores all runtime jobs in a single table and only
 * exposes them through its own services, so a timer is read from the engine and mapped onto this
 * class to evaluate permissions against. Conditions can still refer to the case a timer belongs to
 * through the mapper to [OperatonExecution].
 */
class OperatonTimer(
    val id: String,
    val processInstanceId: String? = null,
    val processDefinitionId: String? = null,
    val processDefinitionKey: String? = null,
    val activityId: String? = null,
    val dueDate: Date? = null,
    val suspended: Boolean = false,
) {
    companion object {
        @JvmStatic
        fun from(job: Job, jobDefinition: JobDefinition?) = OperatonTimer(
            id = job.id,
            processInstanceId = job.processInstanceId,
            processDefinitionId = job.processDefinitionId,
            processDefinitionKey = job.processDefinitionKey,
            activityId = jobDefinition?.activityId,
            dueDate = job.duedate,
            suspended = job.isSuspended,
        )
    }
}
