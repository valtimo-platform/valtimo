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

import com.ritense.valtimo.contract.annotation.ProcessBean
import com.ritense.valtimo.contract.annotation.ProcessBeanMethod
import org.operaton.bpm.engine.delegate.DelegateExecution

@ProcessBean(description = "Manages job timers and due dates")
interface JobService {
    @ProcessBeanMethod(
        description = "Adds milliseconds to a timer's due date by activity ID",
        example = "\${jobService.addOffsetInMillisToTimerDueDateByActivityId(3600000, 'timerActivityId', execution)}"
    )
    fun addOffsetInMillisToTimerDueDateByActivityId(
        millisecondsToAdd: Long, activityId: String,
        execution: DelegateExecution
    )

    @ProcessBeanMethod(
        description = "Updates a timer's due date to a specific ISO-8601 datetime",
        example = "\${jobService.updateTimerDueDateByActivityId('2024-12-31T23:59:59Z', 'timerActivityId', execution)}"
    )
    fun updateTimerDueDateByActivityId(
        dueDateString: String, activityId: String,
        execution: DelegateExecution
    )
}