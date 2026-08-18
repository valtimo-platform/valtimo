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
import com.ritense.plugin.domain.PluginActionResultMapping
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.ProcessLink
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.Column
import jakarta.persistence.DiscriminatorValue
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import org.hibernate.annotations.Type
import java.util.UUID

/**
 * Service-task action link. [pluginConfigurationReference] carries `pluginId` (as
 * [PluginConfigurationReference.pluginDefinitionKey]) and the manifest version as design-time
 * metadata only (validation, UI warnings, import chooser). The **runtime** invocation version
 * always derives from the resolved configuration's definition
 * ([externalPluginConfigurationId] -> configuration -> definition), never from this reference —
 * invoking one version's plugin code with another version's configuration must be impossible.
 *
 * Reuses [PluginConfigurationReference] — the same embeddable mapped by the embedded-plugin
 * `PluginProcessLink` — on the same `process_link` columns (`reference_type`,
 * `plugin_definition_key`, `plugin_definition_version`); verified safe for two STI siblings to
 * share by `PluginConfigurationReferenceSharedStiColumnsTest` in `:backend:plugin`.
 */
@Entity
@DiscriminatorValue(PROCESS_LINK_TYPE)
class ExternalPluginProcessLink(
    id: UUID,
    processDefinitionId: String,
    activityId: String,
    activityType: ActivityTypeWithEventName,

    @Column(name = "external_plugin_config_id")
    val externalPluginConfigurationId: UUID?,

    @Column(name = "external_plugin_action_key")
    val actionKey: String,

    @Embedded
    val pluginConfigurationReference: PluginConfigurationReference = PluginConfigurationReference(),

    @Type(value = JsonType::class)
    @Column(name = "external_plugin_action_properties", columnDefinition = "JSON")
    val actionProperties: ObjectNode? = null,

    @Type(value = JsonType::class)
    @Column(name = "action_result_mappings", columnDefinition = "JSON")
    val actionResultMappings: List<PluginActionResultMapping> = emptyList(),
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
        externalPluginConfigurationId: UUID? = this.externalPluginConfigurationId,
        actionKey: String = this.actionKey,
        pluginConfigurationReference: PluginConfigurationReference = this.pluginConfigurationReference,
        actionProperties: ObjectNode? = this.actionProperties,
        actionResultMappings: List<PluginActionResultMapping> = this.actionResultMappings,
    ) = ExternalPluginProcessLink(
        id = id,
        processDefinitionId = processDefinitionId,
        activityId = activityId,
        activityType = activityType,
        externalPluginConfigurationId = externalPluginConfigurationId,
        actionKey = actionKey,
        pluginConfigurationReference = pluginConfigurationReference,
        actionProperties = actionProperties,
        actionResultMappings = actionResultMappings,
    )

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        if (!super.equals(other)) return false

        other as ExternalPluginProcessLink

        if (externalPluginConfigurationId != other.externalPluginConfigurationId) return false
        if (actionKey != other.actionKey) return false
        if (pluginConfigurationReference != other.pluginConfigurationReference) return false
        if (actionProperties != other.actionProperties) return false
        if (actionResultMappings != other.actionResultMappings) return false

        return true
    }

    override fun hashCode(): Int {
        var result = super.hashCode()
        result = 31 * result + (externalPluginConfigurationId?.hashCode() ?: 0)
        result = 31 * result + actionKey.hashCode()
        result = 31 * result + pluginConfigurationReference.hashCode()
        result = 31 * result + (actionProperties?.hashCode() ?: 0)
        result = 31 * result + actionResultMappings.hashCode()
        return result
    }

    companion object {
        const val PROCESS_LINK_TYPE = "external_plugin"
    }
}
