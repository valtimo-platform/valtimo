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
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.domain.EventQueueMode
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostKind
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.exception.ExternalPluginHostInUseException
import com.ritense.externalplugin.exception.ExternalPluginNotFoundException
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedCapabilityRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEventRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.plugin.service.EncryptionService
import com.ritense.plugin.web.rest.dto.PluginUsageDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.net.URI
import java.util.UUID

@Service
@SkipComponentScan
@Transactional
class ExternalPluginHostService(
    private val hostRepository: ExternalPluginHostRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val grantedEndpointRepository: ExternalPluginGrantedEndpointRepository,
    private val grantedEventRepository: ExternalPluginGrantedEventRepository,
    private val grantedCapabilityRepository: ExternalPluginGrantedCapabilityRepository,
    private val encryptionService: EncryptionService,
    private val hostClient: ExternalPluginHostClient,
    private val hostUsageResolver: ExternalPluginHostUsageResolver,
) {

    fun list(): List<ExternalPluginHost> = hostRepository.findAll()

    fun get(id: UUID): ExternalPluginHost = hostRepository.findById(id)
        .orElseThrow { ExternalPluginNotFoundException("External plugin host", id) }

    fun decryptedSecret(host: ExternalPluginHost): String = encryptionService.decrypt(host.secret)

    fun register(
        name: String,
        baseUrl: String,
        secret: String,
        gzacCallbackBaseUrl: String,
        eventBrokerAmqpUrl: String?,
        eventBrokerExchange: String?,
        eventQueueMode: EventQueueMode = EventQueueMode.LIVE,
        eventQueueTtlMs: Long? = null,
        kind: ExternalPluginHostKind = ExternalPluginHostKind.PLUGIN_HOST,
    ): ExternalPluginHost {
        val normalizedBaseUrl = baseUrl.trimEnd('/')
        val brokerAmqpUrl = eventBrokerAmqpUrl?.takeIf { it.isNotBlank() }
        // The config push delivers the broker AMQP URL and credentials in its body. HMAC binds and
        // authenticates that body but does not encrypt it, so a broker may only be configured on a
        // host the push can reach over a confidential transport. Registration is the single gate:
        // the base URL is immutable afterwards, so no later push can reach an insecure host.
        require(brokerAmqpUrl == null || isSecureTransport(normalizedBaseUrl)) {
            "Refusing to register host '$normalizedBaseUrl' with event broker credentials over an " +
                "unencrypted transport. The configuration push carries the broker AMQP URL and " +
                "credentials, so the host must be reachable over HTTPS (or a loopback address for " +
                "local development). Enable TLS on the host, or leave the event broker blank to " +
                "disable events for configurations on this host."
        }
        val resolvedTtlMs = resolveEventQueueTtlMs(eventQueueMode, eventQueueTtlMs)
        val host = ExternalPluginHost(
            id = UUID.randomUUID(),
            name = name,
            baseUrl = normalizedBaseUrl,
            secret = encryptionService.encrypt(secret),
            status = ExternalPluginHostStatus.UNREACHABLE,
            kind = kind,
            gzacCallbackBaseUrl = gzacCallbackBaseUrl.trimEnd('/'),
            eventBrokerAmqpUrl = brokerAmqpUrl,
            eventBrokerExchange = eventBrokerExchange?.takeIf { it.isNotBlank() },
            eventQueueMode = eventQueueMode,
            eventQueueTtlMs = resolvedTtlMs,
        )
        return hostRepository.save(host)
    }

    /**
     * Updates only the per-host event-queue declaration knobs. The base URL, secret, broker URL
     * and broker exchange remain immutable — those are the security-sensitive fields. Mode and TTL
     * only affect the queue declaration on the plugin-host side; the next configuration push
     * propagates the change so the host swaps its queue.
     */
    fun updateEventQueue(
        hostId: UUID,
        eventQueueMode: EventQueueMode,
        eventQueueTtlMs: Long?,
    ): ExternalPluginHost {
        val host = get(hostId)
        host.eventQueueMode = eventQueueMode
        host.eventQueueTtlMs = resolveEventQueueTtlMs(eventQueueMode, eventQueueTtlMs)
        return hostRepository.save(host)
    }

    private fun resolveEventQueueTtlMs(mode: EventQueueMode, ttlMs: Long?): Long? = when (mode) {
        EventQueueMode.LIVE -> {
            require(ttlMs == null) {
                "eventQueueTtlMs must be null when eventQueueMode is LIVE (got $ttlMs)."
            }
            null
        }
        EventQueueMode.DURABLE -> {
            val value = ttlMs ?: DEFAULT_EVENT_QUEUE_TTL_MS
            require(value in MIN_EVENT_QUEUE_TTL_MS..MAX_EVENT_QUEUE_TTL_MS) {
                "eventQueueTtlMs must be between $MIN_EVENT_QUEUE_TTL_MS (1h) and " +
                    "$MAX_EVENT_QUEUE_TTL_MS (30d), got $value."
            }
            value
        }
    }

    /**
     * Exposes what currently references any configuration under this host — BPMN process links,
     * external-plugin case tabs and case widgets, and building-block mappings.
     * The UI uses this to disable the delete control proactively; the server-side guard in
     * [delete] still enforces the same invariant, so an empty list here does not authorise
     * deletion — a concurrently created reference between this call and the delete call would
     * still surface as an [ExternalPluginHostInUseException].
     */
    @Transactional(readOnly = true)
    fun findUsages(hostId: UUID): List<PluginUsageDto> = hostUsageResolver.findUsagesForHost(hostId)

    fun delete(hostId: UUID) {
        val usages = hostUsageResolver.findUsagesForHost(hostId)
        if (usages.isNotEmpty()) {
            throw ExternalPluginHostInUseException(hostId, usages)
        }

        val definitions = definitionRepository.findAllByHostId(hostId)
        for (definition in definitions) {
            val configurations = configurationRepository.findAllByDefinitionId(definition.id)
            for (configuration in configurations) {
                grantedEndpointRepository.deleteAllByConfigurationId(configuration.id)
                grantedEventRepository.deleteAllByConfigurationId(configuration.id)
                grantedCapabilityRepository.deleteAllByConfigurationId(configuration.id)
            }
            configurationRepository.deleteAll(configurations)
        }
        definitionRepository.deleteAll(definitions)
        hostRepository.deleteById(hostId)
    }

    /**
     * `NOT_SUPPORTED`: the upload is a (potentially large/slow) HTTP call to the host and must not
     * run inside a database transaction. The host lookup runs non-transactionally, which is fine —
     * it is a single read.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    fun uploadPlugin(hostId: UUID, fileName: String, fileBytes: ByteArray): JsonNode {
        val host = get(hostId)
        // An app *is* its single plugin — it serves its own manifest and accepts no uploads. The UI
        // hides the upload affordance for apps; this is the server-side backstop.
        require(host.kind != ExternalPluginHostKind.APP) {
            "Host $hostId is an app and does not accept plugin uploads; it serves its own plugin."
        }
        val adminToken = decryptedSecret(host)
        return hostClient.uploadPlugin(host.baseUrl, adminToken, fileName, fileBytes)
    }

    companion object {
        private val LOOPBACK_HOSTS = setOf("localhost", "127.0.0.1", "::1")

        /** Default queue inactivity TTL for new DURABLE hosts: 72 hours. */
        const val DEFAULT_EVENT_QUEUE_TTL_MS: Long = 72L * 60 * 60 * 1000

        /** Minimum allowed TTL: 1 hour. Below this a brief restart can blow away the queue. */
        const val MIN_EVENT_QUEUE_TTL_MS: Long = 60L * 60 * 1000

        /** Maximum allowed TTL: 30 days. Past this, buffered events are likely stale. */
        const val MAX_EVENT_QUEUE_TTL_MS: Long = 30L * 24 * 60 * 60 * 1000

        /**
         * Whether a host base URL provides a confidential transport for the broker credentials and
         * service token carried in a configuration push. HTTPS encrypts the channel end-to-end; a
         * loopback address keeps the traffic on the local machine. Plain HTTP to any other host is
         * eavesdroppable — HMAC authenticates the push but does not encrypt it.
         */
        fun isSecureTransport(baseUrl: String): Boolean {
            val uri = runCatching { URI(baseUrl) }.getOrNull() ?: return false
            if (uri.scheme?.lowercase() == "https") return true
            val host = uri.host?.removeSurrounding("[", "]")?.lowercase() ?: return false
            return host in LOOPBACK_HOSTS
        }
    }
}
