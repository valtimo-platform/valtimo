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
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.networknt.schema.JsonSchemaFactory
import com.networknt.schema.SpecVersion
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.domain.ExternalPluginCapability
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginGrantedCapability
import com.ritense.externalplugin.domain.ExternalPluginGrantedEgress
import com.ritense.externalplugin.domain.ExternalPluginGrantedEndpoint
import com.ritense.externalplugin.domain.ExternalPluginGrantedEvent
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.exception.ExternalPluginConfigurationInUseException
import com.ritense.externalplugin.exception.ExternalPluginNotFoundException
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedCapabilityRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEgressRepository
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
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.time.Instant
import java.util.UUID

/**
 * Transaction boundaries are deliberately per-method (no class-level `@Transactional`): all host
 * HTTP I/O (config pushes/deletes) happens **after** the local transaction commits — see
 * [runAfterCommit] — so a slow or unreachable host can never pin a database transaction open.
 */
@Service
@SkipComponentScan
class ExternalPluginConfigurationService(
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val hostRepository: ExternalPluginHostRepository,
    private val grantedEndpointRepository: ExternalPluginGrantedEndpointRepository,
    private val grantedEventRepository: ExternalPluginGrantedEventRepository,
    private val grantedCapabilityRepository: ExternalPluginGrantedCapabilityRepository,
    private val grantedEgressRepository: ExternalPluginGrantedEgressRepository,
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
        .orElseThrow { ExternalPluginNotFoundException("External plugin configuration", id) }

    @Transactional
    fun create(
        definitionId: UUID,
        title: String,
        properties: ObjectNode,
        grantedEndpoints: List<GrantedEndpointEntry>,
        grantedEvents: List<GrantedEventEntry>,
        grantedCapabilities: List<String> = emptyList(),
        grantedEgress: List<String> = emptyList(),
        id: UUID = UUID.randomUUID(),
        /**
         * Only the descriptor importer passes true. With no manifest every check below silently
         * passes, so any other caller's grants would be stored unvalidated and discovery would then
         * refuse to activate the plugin at all.
         */
        allowPlaceholder: Boolean = false,
    ): ExternalPluginConfiguration {
        val definition = definitionRepository.findById(definitionId)
            .orElseThrow { IllegalArgumentException("External plugin definition $definitionId not found") }
        require(allowPlaceholder || !definition.isPlaceholder) {
            "External plugin '${definition.pluginId}@${definition.version}' has not been discovered on " +
                "its host yet, so its permissions are unknown and a configuration cannot be validated. " +
                "Wait until the host serves the plugin and it becomes available."
        }

        // Rejects unknown capability names before anything is persisted.
        val capabilities = grantedCapabilities.map(ExternalPluginCapability::fromValue)

        validateAgainstSchema(properties, definition.configSchema)
        validateGrantedEndpointsCoverManifest(grantedEndpoints, definition)
        validateGrantedEventsCoverManifest(grantedEvents, definition)
        validateGrantedCapabilitiesCoverManifest(capabilities, definition)
        validateGrantedEgressCoverManifest(grantedEgress, definition)
        validateEgressTargetProperties(properties, definition)

        val encrypted = propertyEncryptor.encryptSecretFields(properties.deepCopy(), definition.configSchema)

        val configuration = ExternalPluginConfiguration(
            id = id,
            definitionId = definitionId,
            title = title,
            properties = encrypted,
            createdAt = Instant.now(),
        )
        val saved = configurationRepository.save(configuration)

        saveGrantedEndpoints(saved.id, grantedEndpoints)
        saveGrantedEvents(saved.id, grantedEvents)
        saveGrantedCapabilities(saved.id, capabilities)
        saveGrantedEgress(saved.id, grantedEgress)

        // Push the decrypted config to the plugin host once the transaction has committed, so the
        // HTTP call never runs inside the database transaction.
        pushToHostAfterCommit(saved, definition)

        return saved
    }

    /**
     * Registers an after-commit push of [configuration] to its host. Failures are surfaced as
     * warnings only: the discovery service re-pushes every configuration on its next cycle, so a
     * failed push self-heals.
     */
    private fun pushToHostAfterCommit(configuration: ExternalPluginConfiguration, definition: ExternalPluginDefinition) {
        runAfterCommit {
            try {
                val host = hostRepository.findById(definition.hostId).orElse(null)
                if (host != null) {
                    val pushed = pushToHost(configuration, definition, host)
                    if (!pushed) {
                        logger.warn {
                            "Failed to push configuration ${configuration.id} to plugin host ${host.id} " +
                                "(will be synced on next discovery)"
                        }
                    }
                }
            } catch (e: Exception) {
                logger.warn(e) {
                    "Failed to push configuration ${configuration.id} to plugin host (will be synced on next discovery)"
                }
            }
        }
    }

    /**
     * Runs [action] after the surrounding transaction commits, or immediately when no transaction
     * is active (e.g. direct calls from the discovery service, which manages its own boundaries).
     */
    private fun runAfterCommit(action: () -> Unit) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(object : TransactionSynchronization {
                override fun afterCommit() = action()
            })
        } else {
            action()
        }
    }

    /**
     * Pushes a configuration to its plugin host along with a freshly-issued service token and the
     * GZAC base URL the host should call back on. Used both for new configurations and for the
     * discovery service's periodic re-sync.
     *
     * Deliberately **not** transactional: this performs HTTP I/O and must never run inside a
     * database transaction. Callers invoke it after their own transaction has committed.
     */
    fun pushToHost(
        configuration: ExternalPluginConfiguration,
        definition: ExternalPluginDefinition,
        host: ExternalPluginHost,
    ): Boolean {
        if (definition.isPlaceholder) {
            logger.debug {
                "Skipping push of configuration ${configuration.id}: plugin " +
                    "'${definition.pluginId}@${definition.version}' has not been discovered on its host yet"
            }
            return false
        }
        if (definition.requiresReacceptance) {
            // Central guard — every push path (create, update, discovery re-sync, token revocation)
            // funnels through here. No push means no fresh service token for plugin code that
            // differs from what the admin accepted.
            logger.warn {
                "Refusing to push configuration ${configuration.id}: plugin " +
                    "'${definition.pluginId}@${definition.version}' changed on its host and awaits re-acceptance"
            }
            return false
        }
        val adminToken = encryptionService.decrypt(host.secret)
        val decrypted = decryptedProperties(configuration)
        val serviceToken = serviceTokenService.issue(configuration, definition)
        // The granted set is the authoritative subscription list — the host dispatches strictly
        // based on this, not on the manifest's declared `eventSubscriptions`. A later manifest
        // update that adds an event type cannot silently start delivering it without admin re-grant.
        val grantedEventTypes = grantedEventRepository.findAllByConfigurationId(configuration.id)
            .map { it.eventType }
        val grantedCaps = grantedCapabilityRepository.findAllByConfigurationId(configuration.id)
            .map { it.capability.value }
        // The granted endpoint list travels with the push so the host enforces it on every
        // `gzac_api` call, independent of GZAC-side token scoping.
        val grantedEndpointPairs = grantedEndpointRepository.findAllByConfigurationId(configuration.id)
            .map { it.httpMethod to it.endpointPattern }
        // The two egress sources are unioned here and pushed as one list, so the host never has to
        // care about provenance. Deriving the configuration-driven half *here* rather than at create
        // time is deliberate: every path that reaches the host — create, update, discovery re-sync,
        // token revocation — funnels through this method with the properties already decrypted, so
        // the allowlist tracks the configuration values with nothing to keep in sync. Unlike the
        // manifest grants, those values legitimately change when a configuration is edited.
        val allowedEgress = (
            grantedEgressRepository.findAllByConfigurationId(configuration.id).map { it.target } +
                PluginEgressTargets.deriveFrom(definition.configSchema, decrypted).origins
            ).distinct()
        if (grantedCaps.contains(ExternalPluginCapability.HTTP_REQUEST.value) && allowedEgress.isEmpty()) {
            logger.warn {
                "Configuration ${configuration.id} has the http_request capability but no egress " +
                    "targets — the host will refuse every outbound call. Declare fixed targets in the " +
                    "manifest's 'permissions.egress', or mark the URL property 'x-egress-target'"
            }
        }
        val pushed = hostClient.pushConfiguration(
            baseUrl = host.baseUrl,
            adminToken = adminToken,
            configId = configuration.id.toString(),
            pluginId = definition.pluginId,
            pluginVersion = definition.version,
            properties = decrypted,
            serviceToken = serviceToken,
            gzacBaseUrl = host.gzacCallbackBaseUrl ?: fallbackGzacBaseUrl,
            // The host-row UUID identifies this GZAC↔host relationship: the host persists it per
            // configuration, and the discovery reconciliation pass only deletes host configs
            // carrying it — so another GZAC sharing the host can never lose configs to this one.
            ownerId = host.id.toString(),
            // The pinned package hash rides along; the host refuses the push (409) if the package
            // on disk no longer matches, closing the window between discovery and this push.
            expectedContentHash = definition.contentHash,
            eventSubscriptions = grantedEventTypes,
            grantedCapabilities = grantedCaps,
            grantedEndpoints = grantedEndpointPairs,
            allowedEgress = allowedEgress,
            eventBrokerUrl = host.eventBrokerAmqpUrl,
            eventBrokerExchange = host.eventBrokerExchange ?: defaultEventBrokerExchange,
            eventBrokerExchangeType = "fanout",
            eventQueueMode = host.eventQueueMode,
            eventQueueTtlMs = host.eventQueueTtlMs,
        )
        if (pushed) {
            logger.info { "Pushed configuration ${configuration.id} for plugin '${definition.pluginId}' to host ${host.id}" }
        }
        return pushed
    }

    @Transactional
    fun update(
        id: UUID,
        title: String,
        properties: ObjectNode,
        grantedEndpoints: List<GrantedEndpointEntry>? = null,
    ): ExternalPluginConfiguration {
        val config = configurationRepository.findById(id)
            .orElseThrow { ExternalPluginNotFoundException("External plugin configuration", id) }
        val definition = definitionRepository.findById(config.definitionId)
            .orElseThrow { ExternalPluginNotFoundException("External plugin definition", config.definitionId) }

        // GET responses omit `x-secret` properties (see maskedProperties), so an absent or blank
        // secret in the update payload means "unchanged": the stored ciphertext is kept as-is and
        // the stored plaintext is substituted for schema validation.
        val secretFields = propertyEncryptor.secretFieldNames(definition.configSchema)
        val unchangedSecretFields = secretFields.filter { field ->
            val incoming = properties.get(field)
            val omitted = incoming == null || incoming.isNull || (incoming.isTextual && incoming.asText().isEmpty())
            omitted && config.properties?.get(field)?.isTextual == true
        }

        val validationCopy = properties.deepCopy()
        unchangedSecretFields.forEach { field ->
            val storedCiphertext = config.properties!!.get(field).asText()
            if (storedCiphertext.isNotEmpty()) {
                validationCopy.put(field, encryptionService.decrypt(storedCiphertext))
            }
        }
        validateAgainstSchema(validationCopy, definition.configSchema)
        // Fail closed: a property marked `x-egress-target` whose value isn't a parseable absolute URL
        // would contribute nothing to the allowlist, leaving the admin believing they granted a
        // destination the host refuses. Reject the edit instead.
        validateEgressTargetProperties(validationCopy, definition)

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
        // Keep the existing ciphertext for untouched secrets instead of encrypting the empty/absent
        // placeholder the browser sent back.
        unchangedSecretFields.forEach { field ->
            encrypted.set<JsonNode>(field, config.properties!!.get(field))
        }

        config.title = title
        config.properties = encrypted
        val saved = configurationRepository.save(config)

        // Push the updated decrypted config to the plugin host after commit (never inside the tx).
        pushToHostAfterCommit(saved, definition)

        return saved
    }

    /**
     * Revokes every outstanding token (service *and* user) minted for this configuration by
     * bumping its generation counter: tokens carry the generation they were minted under and only
     * validate while it matches. After the bump commits, a fresh push hands the host a new token of
     * the new generation, so a *legitimate* host recovers instantly while every leaked or hoarded
     * token is dead. If the push cannot happen (host down, or the definition awaits content
     * re-acceptance) the discovery cycle re-pushes on its next tick — or withholds, which is then
     * exactly the intent.
     */
    @Transactional
    fun revokeTokens(id: UUID): ExternalPluginConfiguration {
        val config = configurationRepository.findById(id)
            .orElseThrow { ExternalPluginNotFoundException("External plugin configuration", id) }
        val definition = definitionRepository.findById(config.definitionId)
            .orElseThrow { ExternalPluginNotFoundException("External plugin definition", config.definitionId) }

        config.tokenGeneration += 1
        val saved = configurationRepository.save(config)
        logger.info {
            "Revoked all tokens for external plugin configuration $id " +
                "(new token generation ${saved.tokenGeneration})"
        }

        pushToHostAfterCommit(saved, definition)
        return saved
    }

    /**
     * Applies an admin-confirmed overwrite of an existing plugin version: the admin
     * re-reviewed the uploaded package's requested permissions in the upload flow, so the new
     * package hash is pinned as the accepted content and every configuration of the definition is
     * re-granted to **exactly** the new manifest's declared endpoint/event/capability sets — the
     * same all-or-nothing footprint the activation screen grants. The subsequent discovery cycle
     * refreshes the stored manifest (the hash now matches the pin) and pushes the new grants.
     *
     * A definition GZAC never discovered is a no-op: discovery will pin the uploaded content on
     * first sight and there are no configurations to re-grant.
     */
    @Transactional
    fun applyApprovedOverwrite(pluginId: String, version: String, contentHash: String?, manifest: JsonNode?) {
        val definition = definitionRepository.findByPluginIdAndVersion(pluginId, version) ?: return

        if (contentHash != null) {
            definition.contentHash = contentHash
            definition.pendingContentHash = null
            definitionRepository.save(definition)
        }
        if (manifest == null) return

        val declaredEndpoints = declaredEndpoints(manifest)
        val declaredEvents = declaredEvents(manifest)
        val declaredCapabilities = declaredCapabilities(manifest)
        val declaredEgress = declaredEgress(manifest)

        configurationRepository.findAllByDefinitionId(definition.id).forEach { configuration ->
            grantedEndpointRepository.deleteAllByConfigurationId(configuration.id)
            grantedEventRepository.deleteAllByConfigurationId(configuration.id)
            grantedCapabilityRepository.deleteAllByConfigurationId(configuration.id)
            grantedEgressRepository.deleteAllByConfigurationId(configuration.id)
            // Flush the deletes before re-inserting — same unique-constraint ordering concern as
            // in [update].
            grantedEndpointRepository.flush()
            grantedEventRepository.flush()
            grantedCapabilityRepository.flush()
            grantedEgressRepository.flush()
            saveGrantedEndpoints(configuration.id, declaredEndpoints)
            saveGrantedEvents(configuration.id, declaredEvents)
            saveGrantedCapabilities(configuration.id, declaredCapabilities)
            saveGrantedEgress(configuration.id, declaredEgress)
            logger.info {
                "Re-granted configuration ${configuration.id} to the overwritten manifest of " +
                    "'$pluginId@$version' (${declaredEndpoints.size} endpoints, " +
                    "${declaredEvents.size} events, ${declaredCapabilities.size} capabilities, " +
                    "${declaredEgress.size} egress targets)"
            }
        }
    }

    @Transactional(readOnly = true)
    fun findGrantMismatches(definition: ExternalPluginDefinition): List<String> {
        val manifest = definition.manifestJson ?: return emptyList()
        val requiredEndpoints = declaredEndpoints(manifest).map { "${it.method.uppercase()}:${it.pattern}" }.toSet()
        val requiredEvents = declaredEvents(manifest).map { it.eventType }.toSet()
        val requiredCapabilities = declaredCapabilities(manifest).map { it.value }.toSet()
        val requiredEgress = declaredEgress(manifest).toSet()

        return configurationRepository.findAllByDefinitionId(definition.id).mapNotNull { configuration ->
            val problems = listOfNotNull(
                difference(
                    "endpoints",
                    requiredEndpoints,
                    grantedEndpointRepository.findAllByConfigurationId(configuration.id)
                        .map { "${it.httpMethod.uppercase()}:${it.endpointPattern}" }.toSet(),
                ),
                difference(
                    "event subscriptions",
                    requiredEvents,
                    grantedEventRepository.findAllByConfigurationId(configuration.id)
                        .map { it.eventType }.toSet(),
                ),
                difference(
                    "capabilities",
                    requiredCapabilities,
                    grantedCapabilityRepository.findAllByConfigurationId(configuration.id)
                        .map { it.capability.value }.toSet(),
                ),
                difference(
                    "egress targets",
                    requiredEgress,
                    grantedEgressRepository.findAllByConfigurationId(configuration.id)
                        .map { it.target }.toSet(),
                ),
            )
            if (problems.isEmpty()) null else "configuration ${configuration.id} " +
                "('${configuration.title}'): ${problems.joinToString("; ")}"
        }
    }

    private fun difference(subject: String, required: Set<String>, granted: Set<String>): String? {
        val missing = required - granted
        val undeclared = granted - required
        if (missing.isEmpty() && undeclared.isEmpty()) return null
        return buildString {
            append(subject)
            append(" ")
            if (missing.isNotEmpty()) append("declared but not granted: ${missing.joinToString(", ")}")
            if (missing.isNotEmpty() && undeclared.isNotEmpty()) append("; ")
            if (undeclared.isNotEmpty()) append("granted but not declared: ${undeclared.joinToString(", ")}")
        }
    }

    private fun declaredEgress(manifest: JsonNode): List<String> {
        val declared = manifest.get("permissions")?.get("egress") ?: return emptyList()
        if (!declared.isArray) return emptyList()
        return declared.mapNotNull { it.asText()?.trim()?.takeIf { entry -> entry.isNotEmpty() } }.distinct()
    }

    private fun declaredEndpoints(manifest: JsonNode): List<GrantedEndpointEntry> {
        val declared = manifest.get("permissions")?.get("endpoints") ?: return emptyList()
        if (!declared.isArray) return emptyList()
        return declared.mapNotNull { endpoint ->
            val method = endpoint.get("method")?.asText()?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
            val pattern = endpoint.get("pattern")?.asText()?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
            GrantedEndpointEntry(method, pattern)
        }
    }

    private fun declaredEvents(manifest: JsonNode): List<GrantedEventEntry> {
        val declared = manifest.get("eventSubscriptions") ?: return emptyList()
        if (!declared.isArray) return emptyList()
        return declared.mapNotNull { it.asText().takeIf { s -> s.isNotBlank() } }.map(::GrantedEventEntry)
    }

    private fun declaredCapabilities(manifest: JsonNode): List<ExternalPluginCapability> {
        val declared = manifest.get("permissions")?.get("capabilities") ?: return emptyList()
        if (!declared.isArray) return emptyList()
        return declared.mapNotNull { capability ->
            val value = capability.asText().takeIf { it.isNotBlank() } ?: return@mapNotNull null
            try {
                ExternalPluginCapability.fromValue(value)
            } catch (e: IllegalArgumentException) {
                // Unknown to this GZAC version — grant what is known rather than failing after the
                // host has already replaced the package; the host-side guard denies the rest anyway.
                logger.warn { "Skipping unknown capability '$value' while re-granting after overwrite: ${e.message}" }
                null
            }
        }
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

    @Transactional
    fun delete(id: UUID) {
        val config = configurationRepository.findById(id)
            .orElseThrow { ExternalPluginNotFoundException("External plugin configuration", id) }

        val usages = hostUsageResolver.findUsagesForConfiguration(id)
        if (usages.isNotEmpty()) {
            throw ExternalPluginConfigurationInUseException(id, usages)
        }

        val definition = definitionRepository.findById(config.definitionId).orElse(null)
        val host = definition?.let { hostRepository.findById(it.hostId).orElse(null) }

        grantedEndpointRepository.deleteAllByConfigurationId(id)
        grantedEventRepository.deleteAllByConfigurationId(id)
        grantedCapabilityRepository.deleteAllByConfigurationId(id)
        grantedEgressRepository.deleteAllByConfigurationId(id)
        configurationRepository.delete(config)

        // Remove the config from the plugin host after the local delete has committed, so the HTTP
        // call never runs inside the database transaction.
        if (host != null) {
            runAfterCommit {
                try {
                    val adminToken = encryptionService.decrypt(host.secret)
                    val deleted = hostClient.deleteConfiguration(host.baseUrl, adminToken, id.toString())
                    if (deleted) {
                        logger.info { "Deleted configuration $id from host ${host.id}" }
                    } else {
                        logger.warn { "Failed to delete configuration $id from plugin host ${host.id}" }
                    }
                } catch (e: Exception) {
                    logger.warn(e) { "Failed to delete configuration $id from plugin host" }
                }
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
    fun getGrantedCapabilities(configurationId: UUID): List<ExternalPluginGrantedCapability> =
        grantedCapabilityRepository.findAllByConfigurationId(configurationId)

    @Transactional(readOnly = true)
    fun getGrantedEgress(configurationId: UUID): List<ExternalPluginGrantedEgress> =
        grantedEgressRepository.findAllByConfigurationId(configurationId)

    /**
     * The origins derived from this configuration's `x-egress-target` property values. Recomputed
     * from the stored properties rather than persisted, exactly as [pushToHost] does, so the UI shows
     * what the host is actually enforcing. Values are read from the *masked* properties, so a URL
     * that is also marked `x-secret` is omitted here rather than leaking to the browser.
     */
    @Transactional(readOnly = true)
    fun getDerivedEgress(configuration: ExternalPluginConfiguration): List<String> {
        val definition = definitionRepository.findById(configuration.definitionId).orElse(null)
            ?: return emptyList()
        return PluginEgressTargets.deriveFrom(definition.configSchema, maskedProperties(configuration)).origins
    }

    /**
     * Decrypted properties for **server-side use only** (the host push). Never expose the result
     * over REST — [maskedProperties] is the read-model for API responses.
     */
    @Transactional(readOnly = true)
    fun decryptedProperties(configuration: ExternalPluginConfiguration): ObjectNode {
        val definition = definitionRepository.findById(configuration.definitionId)
            .orElseThrow { ExternalPluginNotFoundException("External plugin definition", configuration.definitionId) }
        val source = configuration.properties ?: objectMapper.createObjectNode()
        return propertyEncryptor.decryptSecretFields(source.deepCopy(), definition.configSchema)
    }

    /**
     * Properties safe to return to the browser: `x-secret` fields are omitted entirely (mirroring
     * the embedded plugin module's `PluginConfigurationDto`). On update, an absent/blank secret
     * field is treated as "unchanged" — see [update].
     */
    @Transactional(readOnly = true)
    fun maskedProperties(configuration: ExternalPluginConfiguration): ObjectNode {
        val definition = definitionRepository.findById(configuration.definitionId)
            .orElseThrow { ExternalPluginNotFoundException("External plugin definition", configuration.definitionId) }
        val masked = (configuration.properties ?: objectMapper.createObjectNode()).deepCopy()
        propertyEncryptor.secretFieldNames(definition.configSchema).forEach { masked.remove(it) }
        return masked
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
     * All-or-nothing parity with endpoints: the admin's acknowledgement covers the full
     * declared set, recorded as the authoritative subscription list for this configuration.
     */
    private fun validateGrantedEventsCoverManifest(
        grantedEvents: List<GrantedEventEntry>,
        definition: ExternalPluginDefinition,
    ) {
        val manifest = definition.manifestJson ?: return
        val declared = manifest.get("eventSubscriptions")

        val grantedTypes = grantedEvents.map { it.eventType }.toSet()
        val requiredTypes = if (declared != null && declared.isArray) {
            declared.mapNotNull { it.asText().takeIf { s -> s.isNotBlank() } }.toSet()
        } else {
            emptySet()
        }

        requireExactGrantMatch("event subscriptions", requiredTypes, grantedTypes)
    }

    private fun saveGrantedCapabilities(configurationId: UUID, capabilities: List<ExternalPluginCapability>) {
        capabilities.forEach { capability ->
            grantedCapabilityRepository.save(
                ExternalPluginGrantedCapability(
                    id = UUID.randomUUID(),
                    configurationId = configurationId,
                    capability = capability,
                )
            )
        }
    }

    private fun saveGrantedEgress(configurationId: UUID, targets: List<String>) {
        targets.distinct().forEach { target ->
            grantedEgressRepository.save(
                ExternalPluginGrantedEgress(
                    id = UUID.randomUUID(),
                    configurationId = configurationId,
                    target = target,
                )
            )
        }
    }

    /**
     * All-or-nothing parity with the other three grants: the acceptance screen names every origin the
     * manifest declares and the admin accepts the whole set. Compared on the raw manifest strings
     * rather than normalised origins, so what is stored is what the admin saw.
     */
    private fun validateGrantedEgressCoverManifest(
        grantedEgress: List<String>,
        definition: ExternalPluginDefinition,
    ) {
        val manifest = definition.manifestJson ?: return
        val requiredSet = declaredEgress(manifest).toSet()
        val grantedSet = grantedEgress.map { it.trim() }.filter { it.isNotEmpty() }.toSet()

        requireExactGrantMatch("egress targets", requiredSet, grantedSet)
    }

    /**
     * Rejects a configuration whose `x-egress-target` properties don't hold parseable absolute URLs.
     * Fail closed rather than silently contributing nothing: the admin typing the value *is* the
     * grant, so a value GZAC cannot turn into an origin has to surface as an error on the field.
     */
    private fun validateEgressTargetProperties(
        properties: ObjectNode,
        definition: ExternalPluginDefinition,
    ) {
        val invalid = PluginEgressTargets.deriveFrom(definition.configSchema, properties).missingOrInvalid
        if (invalid.isNotEmpty()) {
            throw IllegalArgumentException(
                "Configuration propert${if (invalid.size == 1) "y" else "ies"} " +
                    "${invalid.joinToString(", ")} must contain an absolute http(s) URL: the plugin " +
                    "declares them as egress targets, and the host derives what it may call from them"
            )
        }
    }

    private fun validateGrantedCapabilitiesCoverManifest(
        grantedCapabilities: List<ExternalPluginCapability>,
        definition: ExternalPluginDefinition,
    ) {
        val manifest = definition.manifestJson ?: return
        val declaredCapabilities = manifest.get("permissions")?.get("capabilities")

        val grantedSet = grantedCapabilities.map { it.value }.toSet()
        val requiredSet = if (declaredCapabilities != null && declaredCapabilities.isArray) {
            declaredCapabilities.mapNotNull { it.asText().takeIf { s -> s.isNotBlank() } }.toSet()
        } else {
            emptySet()
        }

        requireExactGrantMatch("capabilities", requiredSet, grantedSet)
    }

    private fun validateGrantedEndpointsCoverManifest(
        grantedEndpoints: List<GrantedEndpointEntry>,
        definition: ExternalPluginDefinition,
    ) {
        val manifest = definition.manifestJson ?: return
        val declaredEndpoints = manifest.get("permissions")?.get("endpoints")

        val grantedKeys = grantedEndpoints.map { "${it.method.uppercase()}:${it.pattern}" }.toSet()
        val requiredKeys = if (declaredEndpoints != null && declaredEndpoints.isArray) {
            declaredEndpoints.mapNotNull { ep ->
                val method = ep.get("method")?.asText() ?: return@mapNotNull null
                val pattern = ep.get("pattern")?.asText() ?: return@mapNotNull null
                "${method.uppercase()}:$pattern"
            }.toSet()
        } else {
            emptySet()
        }

        requireExactGrantMatch("endpoints", requiredKeys, grantedKeys)
    }

    /**
     * Grants must match the manifest declaration exactly: everything declared has to be granted
     * (the admin explicitly acknowledges the plugin's full footprint) and nothing beyond the
     * declaration can be granted (a grant the plugin never asked for is always a mistake).
     */
    private fun requireExactGrantMatch(subject: String, required: Set<String>, granted: Set<String>) {
        val missing = required - granted
        if (missing.isNotEmpty()) {
            throw IllegalArgumentException(
                "All $subject declared in the plugin manifest must be granted. " +
                    "Missing: ${missing.joinToString(", ")}"
            )
        }
        val undeclared = granted - required
        if (undeclared.isNotEmpty()) {
            throw IllegalArgumentException(
                "Granted $subject must be declared in the plugin manifest. " +
                    "Not declared: ${undeclared.joinToString(", ")}"
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
