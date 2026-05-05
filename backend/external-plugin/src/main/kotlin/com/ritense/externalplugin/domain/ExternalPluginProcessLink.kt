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

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.externalplugin.domain.ExternalPluginProcessLink.Companion.PROCESS_LINK_TYPE
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.ProcessLink
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.Column
import jakarta.persistence.DiscriminatorValue
import jakarta.persistence.Entity
import org.hibernate.annotations.Type
import java.util.UUID

@Entity
@DiscriminatorValue(PROCESS_LINK_TYPE)
class ExternalPluginProcessLink(
    id: UUID,
    processDefinitionId: String,
    activityId: String,
    activityType: ActivityTypeWithEventName,

    @Column(name = "external_plugin_config_id")
    val externalPluginConfigurationId: UUID,

    @Column(name = "external_plugin_action_key")
    val actionKey: String,

    @Type(value = JsonType::class)
    @Column(name = "external_plugin_action_properties", columnDefinition = "JSON")
    val actionProperties: ObjectNode? = null,
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
        actionKey: String = this.actionKey,
        actionProperties: ObjectNode? = this.actionProperties,
    ) = ExternalPluginProcessLink(
        id = id,
        processDefinitionId = processDefinitionId,
        activityId = activityId,
        activityType = activityType,
        externalPluginConfigurationId = externalPluginConfigurationId,
        actionKey = actionKey,
        actionProperties = actionProperties,
    )

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        if (!super.equals(other)) return false

        other as ExternalPluginProcessLink

        if (externalPluginConfigurationId != other.externalPluginConfigurationId) return false
        if (actionKey != other.actionKey) return false
        if (actionProperties != other.actionProperties) return false

        return true
    }

    override fun hashCode(): Int {
        var result = super.hashCode()
        result = 31 * result + externalPluginConfigurationId.hashCode()
        result = 31 * result + actionKey.hashCode()
        result = 31 * result + (actionProperties?.hashCode() ?: 0)
        return result
    }

    companion object {
        const val PROCESS_LINK_TYPE = "external_plugin"
    }
}
