/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.valtimo.processlink.mapper

import com.fasterxml.jackson.annotation.JsonCreator
import com.fasterxml.jackson.annotation.JsonTypeName
import com.fasterxml.jackson.databind.node.JsonNodeFactory
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.plugin.domain.PluginActionResultMapping
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.domain.PluginConfigurationReferenceType.FIXED
import com.ritense.plugin.domain.PluginConfigurationReferenceType.VALUE_RESOLVER
import com.ritense.plugin.service.PluginService.Companion.PROCESS_LINK_TYPE_PLUGIN
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.domain.ActivityTypeWithEventName
import java.util.UUID

@JsonTypeName(PROCESS_LINK_TYPE_PLUGIN)
class PluginProcessLinkDeployDto(
    override val processDefinitionId: String,
    override val activityId: String,
    override val activityType: ActivityTypeWithEventName,
    val pluginConfigurationId: UUID? = null,
    val pluginActionDefinitionKey: String,
    val actionProperties: ObjectNode? = JsonNodeFactory.instance.objectNode(),
    val referenceType: PluginConfigurationReferenceType = PluginConfigurationReferenceType.FIXED,
    val pluginDefinitionKey: String? = null,
    val actionResultMappings: List<PluginActionResultMapping> = emptyList(),
    val pluginConfigurationIdExpression: String? = null,
) : ProcessLinkDeployDto {
    override val processLinkType: String
        get() = PROCESS_LINK_TYPE_PLUGIN

    companion object {
        // Non-UUID pluginConfigurationId (e.g. pv:configId) → pluginConfigurationIdExpression
        @JvmStatic
        @JsonCreator
        fun fromJson(
            processDefinitionId: String,
            activityId: String,
            activityType: ActivityTypeWithEventName,
            pluginConfigurationId: String? = null,
            pluginActionDefinitionKey: String,
            actionProperties: ObjectNode? = JsonNodeFactory.instance.objectNode(),
            referenceType: PluginConfigurationReferenceType? = null,
            pluginDefinitionKey: String? = null,
            actionResultMappings: List<PluginActionResultMapping>? = null,
            pluginConfigurationIdExpression: String? = null,
        ): PluginProcessLinkDeployDto {
            val configurationIdText = pluginConfigurationId?.trim()?.takeIf { it.isNotEmpty() }
            val configurationId = configurationIdText?.let(::parseUuid)
            val textExpression = configurationIdText?.takeIf { configurationId == null }
            val explicitExpression = pluginConfigurationIdExpression?.trim()?.takeIf { it.isNotEmpty() }
            require(textExpression == null || explicitExpression == null || textExpression == explicitExpression) {
                "Process link for activity '$activityId' has both pluginConfigurationId '$textExpression' and " +
                    "pluginConfigurationIdExpression '$explicitExpression'. Use only one of them."
            }
            val expression = explicitExpression ?: textExpression
            val type = when {
                expression != null && (referenceType == null || referenceType == FIXED) -> VALUE_RESOLVER
                else -> referenceType ?: FIXED
            }
            return PluginProcessLinkDeployDto(
                processDefinitionId = processDefinitionId,
                activityId = activityId,
                activityType = activityType,
                pluginConfigurationId = configurationId,
                pluginActionDefinitionKey = pluginActionDefinitionKey,
                actionProperties = actionProperties,
                referenceType = type,
                pluginDefinitionKey = pluginDefinitionKey,
                actionResultMappings = actionResultMappings ?: emptyList(),
                pluginConfigurationIdExpression = expression,
            )
        }

        private fun parseUuid(value: String): UUID? {
            if (value.length != 36) {
                return null
            }
            return try {
                UUID.fromString(value)
            } catch (_: IllegalArgumentException) {
                null
            }
        }
    }
}
