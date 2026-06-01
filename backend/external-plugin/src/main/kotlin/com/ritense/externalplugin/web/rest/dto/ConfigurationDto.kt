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

package com.ritense.externalplugin.web.rest.dto

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginGrantedEndpoint
import java.time.Instant
import java.util.UUID

data class GrantedEndpointEntry(
    val method: String,
    val pattern: String,
)

data class GrantedEndpointResponse(
    val id: UUID,
    val configurationId: UUID,
    val httpMethod: String,
    val endpointPattern: String,
    val grantedAt: Instant,
) {
    companion object {
        fun from(entity: ExternalPluginGrantedEndpoint) = GrantedEndpointResponse(
            id = entity.id,
            configurationId = entity.configurationId,
            httpMethod = entity.httpMethod,
            endpointPattern = entity.endpointPattern,
            grantedAt = entity.grantedAt,
        )
    }
}

data class ConfigurationCreateRequest(
    val definitionId: UUID,
    val title: String,
    val properties: ObjectNode,
    val grantedEndpoints: List<GrantedEndpointEntry>,
)

data class ConfigurationUpdateRequest(
    val title: String,
    val properties: ObjectNode,
    val grantedEndpoints: List<GrantedEndpointEntry>? = null,
)

data class ConfigurationResponse(
    val id: UUID,
    val definitionId: UUID,
    val title: String,
    val createdAt: Instant,
) {
    companion object {
        fun from(configuration: ExternalPluginConfiguration) = ConfigurationResponse(
            id = configuration.id,
            definitionId = configuration.definitionId,
            title = configuration.title,
            createdAt = configuration.createdAt,
        )
    }
}

data class ConfigurationDetailResponse(
    val id: UUID,
    val definitionId: UUID,
    val title: String,
    val properties: ObjectNode,
    val grantedEndpoints: List<GrantedEndpointResponse>,
    val createdAt: Instant,
)
