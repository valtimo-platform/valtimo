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

package com.ritense.externalplugin.service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@Service
@SkipComponentScan
@Transactional
class ExternalPluginDiscoveryService(
    private val hostRepository: ExternalPluginHostRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val hostClient: ExternalPluginHostClient,
    private val failureThreshold: Int,
) {

    fun discoverAll() {
        hostRepository.findAll().forEach { host ->
            try {
                pollHost(host)
            } catch (e: Exception) {
                logger.warn(e) { "External plugin discovery failed for host ${host.id} (${host.baseUrl})" }
            }
        }
    }

    private fun pollHost(host: ExternalPluginHost) {
        val healthy = hostClient.health(host.baseUrl)
        host.lastHealthCheck = Instant.now()

        if (!healthy) {
            host.consecutiveFailures += 1
            if (host.consecutiveFailures >= failureThreshold) {
                host.status = ExternalPluginHostStatus.UNREACHABLE
            }
            hostRepository.save(host)
            return
        }

        host.consecutiveFailures = 0
        host.status = ExternalPluginHostStatus.CONNECTED
        hostRepository.save(host)

        val plugins = hostClient.listPlugins(host.baseUrl)
        val seenPluginIds = mutableSetOf<String>()
        plugins.forEach { manifest ->
            val pluginId = manifest.get("pluginId")?.asText()
            if (pluginId.isNullOrBlank()) return@forEach
            seenPluginIds += pluginId
            upsertDefinition(host, pluginId, manifest)
        }

        markMissingDefinitions(host, seenPluginIds)
    }

    private fun upsertDefinition(host: ExternalPluginHost, pluginId: String, manifest: JsonNode) {
        val existing = definitionRepository.findByPluginId(pluginId)
        if (existing != null && existing.hostId != host.id) {
            logger.warn {
                "External plugin '$pluginId' already registered on host ${existing.hostId}; ignoring discovery from host ${host.id}"
            }
            return
        }

        val definition = existing ?: ExternalPluginDefinition(
            id = UUID.randomUUID(),
            pluginId = pluginId,
            version = manifest.get("version")?.asText() ?: "0.0.0",
            hostId = host.id,
            baseUrl = "${host.baseUrl}/plugins/$pluginId",
            status = ExternalPluginDefinitionStatus.AVAILABLE,
        )

        definition.version = manifest.get("version")?.asText() ?: definition.version
        definition.name = manifest.get("name")?.asText() ?: definition.name
        definition.description = manifest.get("description")?.asText() ?: definition.description
        definition.provider = manifest.get("provider")?.asText() ?: definition.provider
        definition.minGzacVersion = manifest.path("compatibility").get("minGzacVersion")?.asText() ?: definition.minGzacVersion
        definition.maxGzacVersion = manifest.path("compatibility").get("maxGzacVersion")?.asText() ?: definition.maxGzacVersion
        definition.configSchema = manifest.get("configurationSchema") as? ObjectNode
        definition.manifestJson = if (manifest is ObjectNode) manifest.deepCopy() else null
        definition.baseUrl = "${host.baseUrl}/plugins/$pluginId"
        definition.status = ExternalPluginDefinitionStatus.AVAILABLE
        definition.consecutiveMisses = 0

        definitionRepository.save(definition)
    }

    private fun markMissingDefinitions(host: ExternalPluginHost, seenPluginIds: Set<String>) {
        definitionRepository.findAllByHostId(host.id).forEach { definition ->
            if (definition.pluginId in seenPluginIds) return@forEach
            definition.consecutiveMisses += 1
            if (definition.consecutiveMisses >= failureThreshold) {
                definition.status = ExternalPluginDefinitionStatus.UNAVAILABLE
            }
            definitionRepository.save(definition)
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
