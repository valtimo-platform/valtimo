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

package com.ritense.buildingblock

import com.ritense.plugin.annotation.Plugin
import com.ritense.plugin.annotation.PluginAction
import com.ritense.plugin.annotation.PluginActionProperty
import com.ritense.processlink.domain.ActivityTypeWithEventName.SERVICE_TASK_START

/**
 * Mimics the action property shape of the SMTP mail plugin (a nullable String and a nullable
 * List<String>), capturing what the plugin framework resolves and passes to the action.
 */
@Plugin(
    key = "test-mail-plugin",
    title = "Test mail plugin",
    description = "Captures resolved action properties, mimicking the SMTP mail plugin"
)
class TestMailPlugin {

    @PluginAction(
        key = "send-mail",
        title = "Send mail",
        description = "Captures the resolved content id and attachment ids",
        activityTypes = [SERVICE_TASK_START]
    )
    fun sendMail(
        @PluginActionProperty contentId: String?,
        @PluginActionProperty attachmentIds: List<String>?,
    ) {
        invoked = true
        receivedContentId = contentId
        receivedAttachmentIds = attachmentIds
    }

    companion object {
        var invoked: Boolean = false
        var receivedContentId: String? = null
        var receivedAttachmentIds: List<String>? = null

        fun reset() {
            invoked = false
            receivedContentId = null
            receivedAttachmentIds = null
        }
    }
}
