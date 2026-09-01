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
import com.ritense.externalplugin.exception.ExternalPluginHostValidationException
import com.ritense.externalplugin.exception.ExternalPluginNotFoundException
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedCapabilityRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEgressRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEventRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.externalplugin.web.rest.dto.HostResponse
import com.ritense.plugin.service.EncryptionService
import com.ritense.plugin.web.rest.dto.PluginUsageDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
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
    private val grantedEgressRepository: ExternalPluginGrantedEgressRepository,
    private val encryptionService: EncryptionService,
    private val hostClient: ExternalPluginHostClient,
    private val hostUsageResolver: ExternalPluginHostUsageResolver,
) {

    fun list(): List<ExternalPluginHost> = hostRepository.findAll()

    fun get(id: UUID): ExternalPluginHost = hostRepository.findById(id)
        .orElseThrow { ExternalPluginNotFoundException("External plugin host", id) }

    @Transactional(readOnly = true)
    fun findById(id: UUID): ExternalPluginHost? = hostRepository.findById(id).orElse(null)

    @Transactional(readOnly = true)
    fun findByBaseUrl(baseUrl: String): ExternalPluginHost? =
        hostRepository.findByBaseUrl(baseUrl.trimEnd('/'))

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
        /** Browser origins allowed to embed this host's plugin screens. See [updateFrontendOrigins]. */
        frontendOrigins: List<String> = emptyList(),
        id: UUID = UUID.randomUUID(),
    ): ExternalPluginHost {
        val normalizedBaseUrl = baseUrl.trimEnd('/')
        val brokerAmqpUrl = eventBrokerAmqpUrl?.takeIf { it.isNotBlank() }
        validateConnection(normalizedBaseUrl, brokerAmqpUrl)
        val resolvedTtlMs = resolveEventQueueTtlMs(eventQueueMode, eventQueueTtlMs)
        val host = ExternalPluginHost(
            id = id,
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
            frontendOrigins = joinFrontendOrigins(normalizeFrontendOrigins(frontendOrigins)),
        )
        return hostRepository.save(host)
    }

    /**
     * Rules for any *resulting* host state — [register] and [update] both run this, so a repoint
     * cannot reach a state registration would have refused.
     *
     * Throws [ExternalPluginHostValidationException], not [IllegalArgumentException]: it maps to a
     * 400 whose text the host modal renders inline.
     */
    private fun validateConnection(baseUrl: String, brokerAmqpUrl: String?) {
        if (!isConnectableBaseUrl(baseUrl)) {
            throw ExternalPluginHostValidationException(
                "'$baseUrl' is not a reachable address for the base URL. 0.0.0.0 (and " +
                    "the IPv6 equivalent ::) is a bind address, not a connect address — use the " +
                    "host name or IP address GZAC can reach the plugin host on, for example " +
                    "http://localhost:8090."
            )
        }
        if (brokerAmqpUrl != null && REDACTED_USERINFO.containsMatchIn(brokerAmqpUrl)) {
            throw ExternalPluginHostValidationException(
                "The event broker URL still contains the redacted placeholder " +
                    "'${HostResponse.AMQP_USERINFO_REDACTION}'. Enter the full AMQP URL including " +
                    "credentials, or leave the field exactly as it was returned to keep the stored one."
            )
        }
        // HMAC authenticates the push body but does not encrypt it.
        if (brokerAmqpUrl != null && !isSecureTransport(baseUrl)) {
            throw ExternalPluginHostValidationException(
                "Refusing to register host '$baseUrl' with event broker credentials over an " +
                    "unencrypted transport. The configuration push carries the broker AMQP URL and " +
                    "credentials, so the host must be reachable over HTTPS (or a loopback address for " +
                    "local development). Enable TLS on the host, or leave the event broker blank to " +
                    "disable events for configurations on this host."
            )
        }
    }

    /**
     * Repoints a host in place. Everything but [ExternalPluginHost.kind] is mutable, so following a
     * moved host or broker does not mean recreating it — which would orphan its configurations.
     *
     * "Unchanged" semantics, since the API never returns the real values: blank [secret] keeps the
     * stored one, and a redacted [eventBrokerAmqpUrl] keeps the stored credentials.
     *
     * On an address or credential change: tokens revoked, old address purged after commit. Caller
     * must re-discover afterwards to re-push with fresh tokens — see [HostUpdateResult].
     */
    fun update(
        hostId: UUID,
        name: String,
        baseUrl: String,
        secret: String?,
        gzacCallbackBaseUrl: String?,
        eventBrokerAmqpUrl: String?,
        eventBrokerExchange: String?,
        eventQueueMode: EventQueueMode,
        eventQueueTtlMs: Long?,
        frontendOrigins: List<String>,
    ): HostUpdateResult {
        val host = get(hostId)
        val normalizedBaseUrl = baseUrl.trimEnd('/')

        // findByBaseUrl returns a single row — a second host here would make it throw.
        if (normalizedBaseUrl != host.baseUrl) {
            hostRepository.findByBaseUrl(normalizedBaseUrl)?.takeIf { it.id != hostId }?.let { other ->
                throw ExternalPluginHostValidationException(
                    "'$normalizedBaseUrl' is already registered as '${other.name}'. Two hosts cannot " +
                        "share a base URL."
                )
            }
        }

        val resolvedBroker = resolveBrokerAmqpUrl(host, eventBrokerAmqpUrl)
        validateConnection(normalizedBaseUrl, resolvedBroker)
        // Resolved before mutating — a rejected TTL or origin must not half-mutate the entity.
        val resolvedTtlMs = resolveEventQueueTtlMs(eventQueueMode, eventQueueTtlMs)
        val resolvedOrigins = joinFrontendOrigins(normalizeFrontendOrigins(frontendOrigins))

        val oldBaseUrl = host.baseUrl
        val oldAdminToken = runCatching { encryptionService.decrypt(host.secret) }.getOrNull()
        val addressChanged = normalizedBaseUrl != host.baseUrl
        // Compared, not assumed changed: the descriptor always sends a secret, and an unchanged
        // redeploy must not revoke every token on each boot.
        val secretChanged = !secret.isNullOrBlank() && oldAdminToken != secret
        val brokerChanged = resolvedBroker != host.eventBrokerAmqpUrl

        host.name = name
        host.baseUrl = normalizedBaseUrl
        if (secretChanged) host.secret = encryptionService.encrypt(secret!!)
        host.gzacCallbackBaseUrl = gzacCallbackBaseUrl?.trimEnd('/')
        host.eventBrokerAmqpUrl = resolvedBroker
        host.eventBrokerExchange = eventBrokerExchange?.takeIf { it.isNotBlank() }
        host.eventQueueMode = eventQueueMode
        host.eventQueueTtlMs = resolvedTtlMs
        host.frontendOrigins = resolvedOrigins

        val saved = hostRepository.save(host)

        val credentialsChanged = secretChanged || brokerChanged
        val configurationIds = if (addressChanged || credentialsChanged) {
            revokeTokensUnderHost(hostId)
        } else {
            emptyList()
        }
        if (addressChanged) {
            purgeConfigurationsFromOldAddress(hostId, oldBaseUrl, oldAdminToken, configurationIds)
        }

        return HostUpdateResult(
            host = saved,
            addressChanged = addressChanged,
            credentialsChanged = credentialsChanged,
        )
    }

    /**
     * The stored URL when the caller echoed back its redacted form, else the requested one (blank →
     * null). The resource resolves the redacted `/host-defaults` value; only the row resolves this one.
     */
    private fun resolveBrokerAmqpUrl(host: ExternalPluginHost, requested: String?): String? {
        if (requested.isNullOrBlank()) return null
        if (requested == HostResponse.redactAmqpUserInfo(host.eventBrokerAmqpUrl)) {
            return host.eventBrokerAmqpUrl
        }
        return requested
    }

    /**
     * Kills every outstanding token of this host's configurations by bumping their generation
     * counters (see [ExternalPluginConfigurationService.revokeTokens]). Whatever still runs at the
     * old address must be assumed hostile once GZAC stops talking to it.
     *
     * Returns the configuration ids — also exactly what needs purging from the old address.
     */
    private fun revokeTokensUnderHost(hostId: UUID): List<UUID> =
        definitionRepository.findAllByHostId(hostId)
            .flatMap { configurationRepository.findAllByDefinitionId(it.id) }
            .map { configuration ->
                configuration.tokenGeneration += 1
                configurationRepository.save(configuration).id
            }

    /**
     * Best-effort purge of the address just moved away from, with its *old* credentials. Without
     * it the configurations are orphaned there forever — GZAC stops polling, so reconciliation can
     * never prune them. Same trap [delete] works around, and same scope choice: a dead old address
     * only logs, nothing retries.
     *
     * After commit, so it lands before the caller's re-discovery repopulates the new address.
     */
    private fun purgeConfigurationsFromOldAddress(
        hostId: UUID,
        oldBaseUrl: String,
        oldAdminToken: String?,
        configurationIds: List<UUID>,
    ) {
        if (oldAdminToken == null || configurationIds.isEmpty()) return
        runAfterCommit {
            configurationIds.forEach { configurationId ->
                try {
                    val deleted = hostClient.deleteConfiguration(
                        oldBaseUrl,
                        oldAdminToken,
                        configurationId.toString(),
                    )
                    if (!deleted) {
                        logger.warn { "Failed to delete configuration $configurationId from the previous plugin host address $oldBaseUrl after repointing host $hostId" }
                    }
                } catch (e: Exception) {
                    logger.warn(e) { "Failed to delete configuration $configurationId from the previous plugin host address $oldBaseUrl after repointing host $hostId" }
                }
            }
        }
    }

    /**
     * Browser origins allowed to embed this host's plugin screens, served as `frame-ancestors` from
     * the next push. Empty means nothing may frame them.
     *
     * Convenience over [update]; the rest stays as stored, so no repoint side effects fire.
     */
    fun updateFrontendOrigins(hostId: UUID, frontendOrigins: List<String>): ExternalPluginHost =
        updateUnchangedExcept(hostId) { host ->
            update(
                hostId = hostId,
                name = host.name,
                baseUrl = host.baseUrl,
                secret = null,
                gzacCallbackBaseUrl = host.gzacCallbackBaseUrl,
                eventBrokerAmqpUrl = host.eventBrokerAmqpUrl,
                eventBrokerExchange = host.eventBrokerExchange,
                eventQueueMode = host.eventQueueMode,
                eventQueueTtlMs = host.eventQueueTtlMs,
                frontendOrigins = frontendOrigins,
            )
        }

    private fun joinFrontendOrigins(origins: List<String>): String? =
        origins.joinToString(",").takeIf { it.isNotEmpty() }

    /**
     * Per-host queue declaration knobs. The next configuration push propagates them, and the host
     * swaps its queue. Convenience over [update]; the rest stays as stored.
     */
    fun updateEventQueue(
        hostId: UUID,
        eventQueueMode: EventQueueMode,
        eventQueueTtlMs: Long?,
    ): ExternalPluginHost =
        updateUnchangedExcept(hostId) { host ->
            update(
                hostId = hostId,
                name = host.name,
                baseUrl = host.baseUrl,
                secret = null,
                gzacCallbackBaseUrl = host.gzacCallbackBaseUrl,
                eventBrokerAmqpUrl = host.eventBrokerAmqpUrl,
                eventBrokerExchange = host.eventBrokerExchange,
                eventQueueMode = eventQueueMode,
                eventQueueTtlMs = eventQueueTtlMs,
                frontendOrigins = host.frontendOriginList,
            )
        }

    private fun updateUnchangedExcept(
        hostId: UUID,
        block: (ExternalPluginHost) -> HostUpdateResult,
    ): ExternalPluginHost = block(get(hostId)).host

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

        val host = hostRepository.findById(hostId).orElse(null)
        val definitions = definitionRepository.findAllByHostId(hostId)
        val configurationIds = mutableListOf<UUID>()
        for (definition in definitions) {
            val configurations = configurationRepository.findAllByDefinitionId(definition.id)
            configurationIds += configurations.map { it.id }
            for (configuration in configurations) {
                grantedEndpointRepository.deleteAllByConfigurationId(configuration.id)
                grantedEventRepository.deleteAllByConfigurationId(configuration.id)
                grantedCapabilityRepository.deleteAllByConfigurationId(configuration.id)
                grantedEgressRepository.deleteAllByConfigurationId(configuration.id)
            }
            configurationRepository.deleteAll(configurations)
        }
        definitionRepository.deleteAll(definitions)
        hostRepository.deleteById(hostId)

        // Best-effort host-side cleanup after the local delete commits. Without this, every config
        // ever pushed would be orphaned on the host forever: once the host row is gone, GZAC no
        // longer polls the host, so the discovery reconciliation pass can never prune them. If the
        // host is down right now the rows do remain until manually cleaned — GZAC has forgotten
        // the host and cannot retry (deliberate scope choice; documented).
        if (host != null && configurationIds.isNotEmpty()) {
            val baseUrl = host.baseUrl
            val adminToken = encryptionService.decrypt(host.secret)
            runAfterCommit {
                configurationIds.forEach { configurationId ->
                    try {
                        val deleted = hostClient.deleteConfiguration(baseUrl, adminToken, configurationId.toString())
                        if (!deleted) {
                            logger.warn { "Failed to delete configuration $configurationId from plugin host at $baseUrl during host removal" }
                        }
                    } catch (e: Exception) {
                        logger.warn(e) { "Failed to delete configuration $configurationId from plugin host at $baseUrl during host removal" }
                    }
                }
            }
        }
    }

    /**
     * Runs [action] after the surrounding transaction commits, or immediately when no transaction
     * is active. Same pattern as [ExternalPluginConfigurationService]: host HTTP I/O must never
     * run inside a database transaction, and a failed host call must never roll back the local
     * delete.
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
     * `NOT_SUPPORTED`: the upload is a (potentially large/slow) HTTP call to the host and must not
     * run inside a database transaction. The host lookup runs non-transactionally, which is fine —
     * it is a single read.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    fun uploadPlugin(hostId: UUID, fileName: String, fileBytes: ByteArray, overwrite: Boolean = false): JsonNode {
        val host = get(hostId)
        // An app *is* its single plugin — it serves its own manifest and accepts no uploads. The UI
        // hides the upload affordance for apps; this is the server-side backstop.
        require(host.kind != ExternalPluginHostKind.APP) {
            "Host $hostId is an app and does not accept plugin uploads; it serves its own plugin."
        }
        val adminToken = decryptedSecret(host)
        return hostClient.uploadPlugin(host.baseUrl, adminToken, fileName, fileBytes, overwrite)
    }

    companion object {
        private val logger = KotlinLogging.logger {}

        /** AMQP URL whose userinfo is still the redaction marker — an unresolved GET response. */
        private val REDACTED_USERINFO =
            Regex("^amqps?://${Regex.escape(HostResponse.AMQP_USERINFO_REDACTION)}@")

        private val LOOPBACK_HOSTS = setOf("localhost", "127.0.0.1", "::1")

        /**
         * Wildcard bind addresses. A server listening on one of these is reachable on every one of
         * its interfaces, but the address itself names none of them, so GZAC cannot dial it.
         */
        private val BIND_ONLY_HOSTS = setOf("0.0.0.0", "::", "0:0:0:0:0:0:0:0")

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

        /**
         * Validates and canonicalises the browser origins allowed to frame a host's plugin screens.
         * Blank entries (the add-host form's empty repeat rows) are dropped; everything else must be
         * a bare `scheme://host[:port]`. Duplicates collapse, so the same origin entered twice —
         * once with and once without a trailing slash — stores once.
         */
        fun normalizeFrontendOrigins(origins: List<String>): List<String> =
            origins.filter { it.isNotBlank() }.map { normalizeFrontendOrigin(it) }.distinct()

        /**
         * One origin, canonicalised to `scheme://host[:port]`. Rejects anything that is not a bare
         * origin: a wildcard would defeat the point of the allowlist, and a path, query, fragment or
         * userinfo means the operator pasted a full URL — the browser only ever matches the origin,
         * so silently truncating would hide the mistake rather than surface it.
         */
        fun normalizeFrontendOrigin(value: String): String {
            val trimmed = value.trim().trimEnd('/')
            if (trimmed.isEmpty()) invalidFrontendOrigin(value, "it is empty")
            if (trimmed.contains('*')) invalidFrontendOrigin(value, "wildcards are not allowed")
            val uri = runCatching { URI(trimmed) }.getOrNull()
                ?: invalidFrontendOrigin(value, "it is not a valid URL")
            val scheme = uri.scheme?.lowercase()
                ?: invalidFrontendOrigin(value, "it has no scheme")
            if (scheme != "http" && scheme != "https") {
                invalidFrontendOrigin(value, "only http and https origins are supported")
            }
            val host = uri.host ?: invalidFrontendOrigin(value, "it has no host name")
            if (!uri.path.isNullOrEmpty()) invalidFrontendOrigin(value, "it must not contain a path")
            if (uri.query != null || uri.fragment != null) {
                invalidFrontendOrigin(value, "it must not contain a query string or fragment")
            }
            if (uri.userInfo != null) invalidFrontendOrigin(value, "it must not contain credentials")
            // A bracketed IPv6 literal keeps its brackets; anything else lowercases like the browser.
            val normalizedHost = if (host.startsWith("[")) host else host.lowercase()
            return if (uri.port == -1) "$scheme://$normalizedHost" else "$scheme://$normalizedHost:${uri.port}"
        }

        private fun invalidFrontendOrigin(value: String, reason: String): Nothing =
            throw ExternalPluginHostValidationException(
                "'$value' is not a valid frontend origin: $reason. Enter the browser origin only, " +
                    "for example https://valtimo.example.com or http://localhost:4200."
            )

        /**
         * Whether GZAC can actually open a connection to this base URL. Catches the mistake of
         * pasting the address the plugin host *binds* to (`0.0.0.0`, which the host logs on
         * startup) instead of the address it is *reachable* on.
         */
        fun isConnectableBaseUrl(baseUrl: String): Boolean {
            val uri = runCatching { URI(baseUrl) }.getOrNull() ?: return true
            // `host` is null for authorities java.net.URI considers malformed — an underscore in a
            // Docker service name, for one — so fall back to the raw authority rather than
            // rejecting a URL that has always been accepted. This gate only refuses bind addresses.
            val host = uri.host
                ?: uri.authority?.substringAfterLast('@')?.substringBeforeLast(':')
                ?: return true
            return host.removeSurrounding("[", "]").lowercase() !in BIND_ONLY_HOSTS
        }
    }
}

/**
 * What [ExternalPluginHostService.update] changed. A repoint needs a re-discovery, and is worth
 * logging — it moves where a trusted secret and the broker credentials are sent.
 */
data class HostUpdateResult(
    val host: ExternalPluginHost,
    /** Base URL moved: configurations sit on an address GZAC no longer talks to. */
    val addressChanged: Boolean,
    /** Admin secret or broker URL changed. */
    val credentialsChanged: Boolean,
)
