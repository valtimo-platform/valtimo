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

package com.ritense.externalplugin.processlink.web.dto

import com.fasterxml.jackson.annotation.JsonTypeName
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.externalplugin.domain.ExternalPluginProcessLink.Companion.PROCESS_LINK_TYPE
import com.ritense.plugin.domain.PluginActionResultMapping
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.processlink.web.rest.dto.ProcessLinkUpdateRequestDto
import java.util.UUID

/**
 * See [ExternalPluginProcessLinkCreateRequestDto] for why [pluginVersion]/[pluginDefinitionKey] are
 * nullable here (only required for `BUILDING_BLOCK`).
 */
@JsonTypeName(PROCESS_LINK_TYPE)
data class ExternalPluginProcessLinkUpdateRequestDto(
    override val id: UUID,
    val externalPluginConfigurationId: UUID? = null,
    val actionKey: String,
    val actionProperties: ObjectNode? = null,
    val referenceType: PluginConfigurationReferenceType = PluginConfigurationReferenceType.FIXED,
    val pluginDefinitionKey: String? = null,
    val pluginVersion: String? = null,
    val actionResultMappings: List<PluginActionResultMapping> = emptyList(),
) : ProcessLinkUpdateRequestDto {
    override val processLinkType: String
        get() = PROCESS_LINK_TYPE
}
