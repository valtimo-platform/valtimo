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

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.networknt.schema.JsonSchemaFactory
import com.networknt.schema.SpecVersion
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginGrantedEndpoint
import com.ritense.externalplugin.domain.ExternalPluginGrantedEvent
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.exception.ExternalPluginConfigurationInUseException
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEventRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.externalplugin.web.rest.dto.GrantedEndpointEntry
import com.ritense.externalplugin.web.rest.dto.GrantedEventEntry
import com.ritense.plugin.service.EncryptionService
import com.ritense.plugin.web.rest.dto.PluginUsageDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@Service
@SkipComponentScan
@Transactional
class ExternalPluginConfigurationService(
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val hostRepository: ExternalPluginHostRepository,
    private val grantedEndpointRepository: ExternalPluginGrantedEndpointRepository,
    private val grantedEventRepository: ExternalPluginGrantedEventRepository,
    private val hostClient: ExternalPluginHostClient,
    private val propertyEncryptor: PluginPropertyEncryptor,
    private val encryptionService: EncryptionService,
    private val objectMapper: ObjectMapper,
    private val serviceTokenService: ExternalPluginServiceTokenService,
    private val hostUsageResolver: ExternalPluginHostUsageResolver,
    /**
     * Default exchange GZAC publishes to (from `valtimo.outbox.publisher.rabbitmq.exchange`).
     * Used as a fallback when a host row has `eventBrokerExchange = null`.
     */
    private val defaultEventBrokerExchange: String,
    /**
     * Fallback callback URL — local-dev default `http://localhost:{server.port}`. Only used when
     * a host row was created before `gzacCallbackBaseUrl` became required (legacy data); new hosts
     * always carry a non-null value entered in the add-host UI.
     */
    private val fallbackGzacBaseUrl: String,
) {

    @Transactional(readOnly = true)
    fun list(definitionId: UUID? = null): List<ExternalPluginConfiguration> = if (definitionId != null) {
        configurationRepository.findAllByDefinitionId(definitionId)
    } else {
        configurationRepository.findAll()
    }

    @Transactional(readOnly = true)
    fun get(id: UUID): ExternalPluginConfiguration = configurationRepository.findById(id)
        .orElseThrow { IllegalArgumentException("External plugin configuration $id not found") }

    fun create(
        definitionId: UUID,
        title: String,
        properties: ObjectNode,
        grantedEndpoints: List<GrantedEndpointEntry>,
        grantedEvents: List<GrantedEventEntry>,
    ): ExternalPluginConfiguration {
        val definition = definitionRepository.findById(definitionId)
            .orElseThrow { IllegalArgumentException("External plugin definition $definitionId not found") }

        validateAgainstSchema(properties, definition.configSchema)
        validateGrantedEndpointsCoverManifest(grantedEndpoints, definition)
        validateGrantedEventsCoverManifest(grantedEvents, definition)

        val encrypted = propertyEncryptor.encryptSecretFields(properties.deepCopy(), definition.configSchema)

        val configuration = ExternalPluginConfiguration(
            id = UUID.randomUUID(),
            definitionId = definitionId,
            title = title,
            properties = encrypted,
            createdAt = Instant.now(),
        )
        val saved = configurationRepository.save(configuration)

        saveGrantedEndpoints(saved.id, grantedEndpoints)
        saveGrantedEvents(saved.id, grantedEvents)

        // Push decrypted config to the plugin host
        try {
            val host = hostRepository.findById(definition.hostId).orElse(null)
            if (host != null) {
                pushToHost(saved, definition, host)
            }
        } catch (e: Exception) {
            logger.warn(e) { "Failed to push configuration ${saved.id} to plugin host (will be synced on next discovery)" }
        }

        return saved
    }

    /**
     * Pushes a configuration to its plugin host along with a freshly-issued service token and the
     * GZAC base URL the host should call back on. Used both for new configurations and for the
     * discovery service's periodic re-sync.
     */
    fun pushToHost(
        configuration: ExternalPluginConfiguration,
        definition: ExternalPluginDefinition,
        host: ExternalPluginHost,
    ): Boolean {
        val adminToken = encryptionService.decrypt(host.secret)
        val decrypted = decryptedProperties(configuration)
        val serviceToken = serviceTokenService.issue(configuration, definition)
        // The granted set is the authoritative subscription list — the host dispatches strictly
        // based on this, not on the manifest's declared `eventSubscriptions`. A later manifest
        // update that adds an event type cannot silently start delivering it without admin re-grant.
        val grantedEventTypes = grantedEventRepository.findAllByConfigurationId(configuration.id)
            .map { it.eventType }
        val pushed = hostClient.pushConfiguration(
            baseUrl = host.baseUrl,
            adminToken = adminToken,
            configId = configuration.id.toString(),
            pluginId = definition.pluginId,
            pluginVersion = definition.version,
            properties = decrypted,
            serviceToken = serviceToken,
            gzacBaseUrl = host.gzacCallbackBaseUrl ?: fallbackGzacBaseUrl,
            eventSubscriptions = grantedEventTypes,
            eventBrokerUrl = host.eventBrokerAmqpUrl,
            eventBrokerExchange = host.eventBrokerExchange ?: defaultEventBrokerExchange,
            eventBrokerExchangeType = "fanout",
        )
        if (pushed) {
            logger.info { "Pushed configuration ${configuration.id} for plugin '${definition.pluginId}' to host ${host.id}" }
        }
        return pushed
    }

    fun update(
        id: UUID,
        title: String,
        properties: ObjectNode,
        grantedEndpoints: List<GrantedEndpointEntry>? = null,
    ): ExternalPluginConfiguration {
        val config = configurationRepository.findById(id)
            .orElseThrow { IllegalArgumentException("External plugin configuration $id not found") }
        val definition = definitionRepository.findById(config.definitionId)
            .orElseThrow { IllegalArgumentException("External plugin definition ${config.definitionId} not found") }

        validateAgainstSchema(properties, definition.configSchema)

        if (grantedEndpoints != null) {
            validateGrantedEndpointsCoverManifest(grantedEndpoints, definition)
            grantedEndpointRepository.deleteAllByConfigurationId(id)
            // Flush the delete before re-inserting: Hibernate orders inserts ahead of deletes
            // within a flush, which would trip the (configuration_id, http_method, endpoint_pattern)
            // unique constraint when the replacement set overlaps the previous grants.
            grantedEndpointRepository.flush()
            saveGrantedEndpoints(id, grantedEndpoints)
        }

        val encrypted = propertyEncryptor.encryptSecretFields(properties.deepCopy(), definition.configSchema)

        config.title = title
        config.properties = encrypted
        val saved = configurationRepository.save(config)

        // Push updated decrypted config to the plugin host
        try {
            val host = hostRepository.findById(definition.hostId).orElse(null)
            if (host != null) {
                pushToHost(saved, definition, host)
            }
        } catch (e: Exception) {
            logger.warn(e) { "Failed to push updated configuration ${saved.id} to plugin host (will be synced on next discovery)" }
        }

        return saved
    }

    /**
     * Mirrors [ExternalPluginHostService.findUsages] but scoped to a single configuration. Used
     * by the management UI to disable the delete control proactively; the server-side guard in
     * [delete] still enforces the same invariant, so an empty list here does not authorise
     * deletion — a concurrent process-link creation will still surface as an
     * [ExternalPluginConfigurationInUseException].
     */
    @Transactional(readOnly = true)
    fun findUsages(configurationId: UUID): List<PluginUsageDto> =
        hostUsageResolver.findUsagesForConfiguration(configurationId)

    fun delete(id: UUID) {
        val config = configurationRepository.findById(id)
            .orElseThrow { IllegalArgumentException("External plugin configuration $id not found") }

        val usages = hostUsageResolver.findUsagesForConfiguration(id)
        if (usages.isNotEmpty()) {
            throw ExternalPluginConfigurationInUseException(id, usages)
        }

        val definition = definitionRepository.findById(config.definitionId).orElse(null)

        grantedEndpointRepository.deleteAllByConfigurationId(id)
        grantedEventRepository.deleteAllByConfigurationId(id)
        configurationRepository.delete(config)

        // Remove config from the plugin host
        if (definition != null) {
            try {
                val host = hostRepository.findById(definition.hostId).orElse(null)
                if (host != null) {
                    val adminToken = encryptionService.decrypt(host.secret)
                    hostClient.deleteConfiguration(host.baseUrl, adminToken, id.toString())
                    logger.info { "Deleted configuration $id from host ${host.id}" }
                }
            } catch (e: Exception) {
                logger.warn(e) { "Failed to delete configuration $id from plugin host" }
            }
        }
    }

    @Transactional(readOnly = true)
    fun getGrantedEndpoints(configurationId: UUID): List<ExternalPluginGrantedEndpoint> =
        grantedEndpointRepository.findAllByConfigurationId(configurationId)

    @Transactional(readOnly = true)
    fun getGrantedEvents(configurationId: UUID): List<ExternalPluginGrantedEvent> =
        grantedEventRepository.findAllByConfigurationId(configurationId)

    @Transactional(readOnly = true)
    fun decryptedProperties(configuration: ExternalPluginConfiguration): ObjectNode {
        val definition = definitionRepository.findById(configuration.definitionId)
            .orElseThrow { IllegalArgumentException("External plugin definition ${configuration.definitionId} not found") }
        val source = configuration.properties ?: objectMapper.createObjectNode()
        return propertyEncryptor.decryptSecretFields(source.deepCopy(), definition.configSchema)
    }

    private fun saveGrantedEndpoints(configurationId: UUID, endpoints: List<GrantedEndpointEntry>) {
        endpoints.forEach { entry ->
            grantedEndpointRepository.save(
                ExternalPluginGrantedEndpoint(
                    id = UUID.randomUUID(),
                    configurationId = configurationId,
                    httpMethod = entry.method.uppercase(),
                    endpointPattern = entry.pattern,
                )
            )
        }
    }

    private fun saveGrantedEvents(configurationId: UUID, events: List<GrantedEventEntry>) {
        events.forEach { entry ->
            grantedEventRepository.save(
                ExternalPluginGrantedEvent(
                    id = UUID.randomUUID(),
                    configurationId = configurationId,
                    eventType = entry.eventType,
                )
            )
        }
    }

    /**
     * All-or-nothing parity with endpoints (§3.1): the admin's acknowledgement covers the full
     * declared set, recorded as the authoritative subscription list for this configuration.
     */
    private fun validateGrantedEventsCoverManifest(
        grantedEvents: List<GrantedEventEntry>,
        definition: ExternalPluginDefinition,
    ) {
        val manifest = definition.manifestJson ?: return
        val declared = manifest.get("eventSubscriptions") ?: return
        if (!declared.isArray || declared.isEmpty) return

        val grantedTypes = grantedEvents.map { it.eventType }.toSet()
        val requiredTypes = declared.mapNotNull { it.asText().takeIf { s -> s.isNotBlank() } }.toSet()

        val missing = requiredTypes - grantedTypes
        if (missing.isNotEmpty()) {
            throw IllegalArgumentException(
                "All event subscriptions declared in the plugin manifest must be granted. " +
                    "Missing: ${missing.joinToString(", ")}"
            )
        }
    }

    private fun validateGrantedEndpointsCoverManifest(
        grantedEndpoints: List<GrantedEndpointEntry>,
        definition: ExternalPluginDefinition,
    ) {
        val manifest = definition.manifestJson ?: return
        val permissions = manifest.get("permissions") ?: return
        val declaredEndpoints = permissions.get("endpoints") ?: return
        if (!declaredEndpoints.isArray) return

        val grantedKeys = grantedEndpoints.map { "${it.method.uppercase()}:${it.pattern}" }.toSet()
        val requiredKeys = declaredEndpoints.mapNotNull { ep ->
            val method = ep.get("method")?.asText() ?: return@mapNotNull null
            val pattern = ep.get("pattern")?.asText() ?: return@mapNotNull null
            "${method.uppercase()}:$pattern"
        }.toSet()

        val missing = requiredKeys - grantedKeys
        if (missing.isNotEmpty()) {
            throw IllegalArgumentException(
                "All endpoints declared in the plugin manifest must be granted. " +
                    "Missing: ${missing.joinToString(", ")}"
            )
        }
    }

    private fun validateAgainstSchema(properties: ObjectNode, schemaNode: com.fasterxml.jackson.databind.node.ObjectNode?) {
        if (schemaNode == null || schemaNode.isEmpty) return
        val factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012)
        val schema = factory.getSchema(schemaNode)
        val errors = schema.validate(properties)
        if (errors.isNotEmpty()) {
            val message = errors.joinToString("; ") { it.message }
            throw IllegalArgumentException("Configuration does not match schema: $message")
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
