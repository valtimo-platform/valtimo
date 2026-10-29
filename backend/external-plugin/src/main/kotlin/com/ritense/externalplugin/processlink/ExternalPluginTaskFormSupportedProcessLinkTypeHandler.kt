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

package com.ritense.externalplugin.processlink

import com.ritense.externalplugin.domain.ExternalPluginTaskFormProcessLink.Companion.PROCESS_LINK_TYPE
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.ProcessLinkType
import com.ritense.processlink.domain.SupportedProcessLinkTypeHandler

/**
 * Declares the external plugin `task-form` link type as supported for user tasks. Unlike the
 * service-task action type ([ExternalPluginSupportedProcessLinkTypeHandler]) this handles
 * `USER_TASK_CREATE` — the activity type an operator configures when they want a plugin-provided
 * form to render for a user task.
 */
class ExternalPluginTaskFormSupportedProcessLinkTypeHandler : SupportedProcessLinkTypeHandler {

    private val supportedActivityTypes = listOf(
        ActivityTypeWithEventName.USER_TASK_CREATE,
    )

    override fun getProcessLinkType(activityType: String): ProcessLinkType? {
        if (supportedActivityTypes.contains(ActivityTypeWithEventName.fromValue(activityType))) {
            return ProcessLinkType(PROCESS_LINK_TYPE, true)
        }
        return null
    }
}
