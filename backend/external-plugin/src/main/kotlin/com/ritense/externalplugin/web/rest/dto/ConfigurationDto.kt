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
import com.ritense.externalplugin.domain.ExternalPluginGrantedCapability
import com.ritense.externalplugin.domain.ExternalPluginGrantedEgress
import com.ritense.externalplugin.domain.ExternalPluginGrantedEndpoint
import com.ritense.externalplugin.domain.ExternalPluginGrantedEvent
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

data class GrantedEventEntry(
    val eventType: String,
)

data class GrantedEventResponse(
    val id: UUID,
    val configurationId: UUID,
    val eventType: String,
    val grantedAt: Instant,
) {
    companion object {
        fun from(entity: ExternalPluginGrantedEvent) = GrantedEventResponse(
            id = entity.id,
            configurationId = entity.configurationId,
            eventType = entity.eventType,
            grantedAt = entity.grantedAt,
        )
    }
}

data class GrantedCapabilityResponse(
    val id: UUID,
    val configurationId: UUID,
    val capability: String,
    val grantedAt: Instant,
) {
    companion object {
        fun from(entity: ExternalPluginGrantedCapability) = GrantedCapabilityResponse(
            id = entity.id,
            configurationId = entity.configurationId,
            capability = entity.capability.value,
            grantedAt = entity.grantedAt,
        )
    }
}

data class GrantedEgressResponse(
    val id: UUID,
    val configurationId: UUID,
    val target: String,
    val grantedAt: Instant,
) {
    companion object {
        fun from(entity: ExternalPluginGrantedEgress) = GrantedEgressResponse(
            id = entity.id,
            configurationId = entity.configurationId,
            target = entity.target,
            grantedAt = entity.grantedAt,
        )
    }
}

data class ConfigurationCreateRequest(
    val definitionId: UUID,
    val title: String,
    val properties: ObjectNode,
    val grantedEndpoints: List<GrantedEndpointEntry>,
    val grantedEvents: List<GrantedEventEntry> = emptyList(),
    val grantedCapabilities: List<String> = emptyList(),
    /**
     * Origins from the manifest's `permissions.egress` the admin accepted. Like capabilities and
     * events this is all-or-nothing against the manifest and immutable afterwards, which is why
     * [ConfigurationUpdateRequest] has no counterpart. Environment-specific destinations are not
     * listed here — they are derived at push time from the `x-egress-target` properties.
     */
    val grantedEgress: List<String> = emptyList(),
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
    /** Current revocation counter — bumped by `POST /configuration/{id}/revoke-tokens`. */
    val tokenGeneration: Long,
) {
    companion object {
        fun from(configuration: ExternalPluginConfiguration) = ConfigurationResponse(
            id = configuration.id,
            definitionId = configuration.definitionId,
            title = configuration.title,
            createdAt = configuration.createdAt,
            tokenGeneration = configuration.tokenGeneration,
        )
    }
}

data class ConfigurationDetailResponse(
    val id: UUID,
    val definitionId: UUID,
    val title: String,
    val properties: ObjectNode,
    val grantedEndpoints: List<GrantedEndpointResponse>,
    val grantedEvents: List<GrantedEventResponse>,
    val grantedCapabilities: List<GrantedCapabilityResponse>,
    val grantedEgress: List<GrantedEgressResponse>,
    /**
     * Origins derived from this configuration's own `x-egress-target` property values, recomputed on
     * read rather than stored — they track the configuration and change with it. Shown alongside the
     * manifest-declared grants so an admin sees the full destination set the host will permit.
     */
    val derivedEgress: List<String>,
    val createdAt: Instant,
)
