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

package com.ritense.valtimo

import com.ritense.plugin.annotation.Plugin
import com.ritense.plugin.annotation.PluginAction
import com.ritense.processlink.domain.ActivityTypeWithEventName.SERVICE_TASK_START
import java.util.UUID

@Plugin(
    key = "recording-test-plugin",
    title = "Recording test plugin",
    description = "Records which plugin configuration an action was invoked on"
)
class RecordingTestPlugin(
    private val pluginConfigurationId: UUID
) {
    @PluginAction(
        key = "record",
        title = "Record",
        description = "Records the plugin configuration this action was invoked on",
        activityTypes = [SERVICE_TASK_START]
    )
    fun record() {
        invokedConfigurationIds.add(pluginConfigurationId)
    }

    companion object {
        val invokedConfigurationIds: MutableList<UUID> = mutableListOf()
    }
}
