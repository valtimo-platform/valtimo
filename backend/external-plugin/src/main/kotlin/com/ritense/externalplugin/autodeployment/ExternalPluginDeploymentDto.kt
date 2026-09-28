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

package com.ritense.externalplugin.autodeployment

import com.fasterxml.jackson.databind.node.JsonNodeFactory
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.externalplugin.domain.EventQueueMode
import com.ritense.externalplugin.domain.ExternalPluginHostKind
import com.ritense.externalplugin.web.rest.dto.GrantedEndpointEntry
import java.util.UUID

data class ExternalPluginDeploymentDto(
    val integrations: List<IntegrationDeploymentDto> = emptyList(),
)

data class IntegrationDeploymentDto(
    val id: UUID,
    val name: String,
    val kind: ExternalPluginHostKind = ExternalPluginHostKind.PLUGIN_HOST,
    val baseUrl: String,
    val secret: String,
    val gzacCallbackBaseUrl: String,
    val eventBrokerAmqpUrl: String? = null,
    val eventBrokerExchange: String? = null,
    val eventQueueMode: EventQueueMode = EventQueueMode.LIVE,
    val eventQueueTtlMs: Long? = null,
    val frontendOrigins: List<String> = emptyList(),
    val packages: List<PackageDeploymentDto> = emptyList(),
    val configurations: List<ConfigurationDeploymentDto> = emptyList(),
)

data class PackageDeploymentDto(
    val resource: String,
    val overwrite: Boolean = false,
)

data class ConfigurationDeploymentDto(
    val id: UUID,
    val title: String,
    val pluginId: String,
    val pluginVersion: String,
    val properties: ObjectNode = JsonNodeFactory.instance.objectNode(),
    val grantedCapabilities: List<String> = emptyList(),
    val grantedEndpoints: List<GrantedEndpointEntry> = emptyList(),
    val grantedEvents: List<String> = emptyList(),
    val grantedEgress: List<String> = emptyList(),
)
