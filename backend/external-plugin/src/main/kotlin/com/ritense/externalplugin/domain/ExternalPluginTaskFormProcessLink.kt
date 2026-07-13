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

package com.ritense.externalplugin.domain

import com.ritense.externalplugin.domain.ExternalPluginTaskFormProcessLink.Companion.PROCESS_LINK_TYPE
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.ProcessLink
import jakarta.persistence.Column
import jakarta.persistence.DiscriminatorValue
import jakarta.persistence.Entity
import java.util.UUID

/**
 * A [ProcessLink] that renders an external plugin's `task-form` frontend bundle for a user task.
 * Unlike [ExternalPluginProcessLink] (a service-task action invoked by a listener) this surface has
 * no backend action: the plugin serves the form UI in an iframe and completes the task itself, under
 * the downscoped user token. The link only records which plugin configuration and which `task-form`
 * bundle to render — [bundleKey] is optional and, when null, the plugin's sole `task-form` bundle is
 * used.
 */
@Entity
@DiscriminatorValue(PROCESS_LINK_TYPE)
class ExternalPluginTaskFormProcessLink(
    id: UUID,
    processDefinitionId: String,
    activityId: String,
    activityType: ActivityTypeWithEventName,

    @Column(name = "external_plugin_task_form_config_id")
    val externalPluginConfigurationId: UUID,

    @Column(name = "external_plugin_task_form_bundle_key")
    val bundleKey: String? = null,

    @Column(name = "external_plugin_task_form_version")
    val pluginVersion: String,
) : ProcessLink(
    id,
    processDefinitionId,
    activityId,
    activityType,
    PROCESS_LINK_TYPE,
) {

    override fun copy(id: UUID, processDefinitionId: String) = copy(
        id = id,
        processDefinitionId = processDefinitionId,
        activityId = activityId,
    )

    fun copy(
        id: UUID = this.id,
        processDefinitionId: String = this.processDefinitionId,
        activityId: String = this.activityId,
        activityType: ActivityTypeWithEventName = this.activityType,
        externalPluginConfigurationId: UUID = this.externalPluginConfigurationId,
        bundleKey: String? = this.bundleKey,
        pluginVersion: String = this.pluginVersion,
    ) = ExternalPluginTaskFormProcessLink(
        id = id,
        processDefinitionId = processDefinitionId,
        activityId = activityId,
        activityType = activityType,
        externalPluginConfigurationId = externalPluginConfigurationId,
        bundleKey = bundleKey,
        pluginVersion = pluginVersion,
    )

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        if (!super.equals(other)) return false

        other as ExternalPluginTaskFormProcessLink

        if (externalPluginConfigurationId != other.externalPluginConfigurationId) return false
        if (bundleKey != other.bundleKey) return false
        if (pluginVersion != other.pluginVersion) return false

        return true
    }

    override fun hashCode(): Int {
        var result = super.hashCode()
        result = 31 * result + externalPluginConfigurationId.hashCode()
        result = 31 * result + (bundleKey?.hashCode() ?: 0)
        result = 31 * result + pluginVersion.hashCode()
        return result
    }

    companion object {
        const val PROCESS_LINK_TYPE = "external_plugin_task_form"
    }
}
