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

@ProcessBean(description = "Updates active timers for cases")
interface TimerService {
    @ProcessBeanMethod(
        description = "Updates all active timers for a case to a new ISO-8601 datetime",
        example = "\${timerService.updateActiveTimers(businessKey, '2024-12-31T23:59:59Z')}"
    )
    fun updateActiveTimers(
        businessKey: String,
        newDate: String,
    ): Int

    @ProcessBeanMethod(
        description = "Updates specific active timers by activity ID to a new ISO-8601 datetime",
        example = "\${timerService.updateActiveTimers(businessKey, '2024-12-31T23:59:59Z', 'timer1', 'timer2')}"
    )
    fun updateActiveTimers(
        businessKey: String,
        newDate: String,
        vararg activityIds: String,
    ): Int
}