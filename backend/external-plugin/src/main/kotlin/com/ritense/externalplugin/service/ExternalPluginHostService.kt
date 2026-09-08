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
import com.ritense.plugin.service.EncryptionService
import com.ritense.plugin.web.rest.dto.PluginUsageDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.utils.SecurityUtils
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
    /** Allowed host origins, `scheme://host[:port]`, optional leading `*.`. Empty = no restriction. */
    private val allowedHostOrigins: List<String> = emptyList(),
    /** Opt-in: plain HTTP to a non-loopback host. Off by default — pushes carry secrets. */
    private val allowPlaintextHostTransport: Boolean = false,
) {

    fun list(): List<ExternalPluginHost> = hostRepository.findAll()

    fun get(id: UUID): ExternalPluginHost = hostRepository.findById(id)
        .orElseThrow { ExternalPluginNotFoundException("External plugin host", id) }

    @Transactional(readOnly = true)
    fun findById(id: UUID): ExternalPluginHost? = hostRepository.findById(id).orElse(null)

    @Transactional(readOnly = true)
    fun findByBaseUrl(baseUrl: String): ExternalPluginHost? =
        hostRepository.findByBaseUrl(baseUrl.trim().trimEnd('/'))

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
        // Every rejection below throws ExternalPluginHostValidationException rather than
        // IllegalArgumentException so it surfaces as a 400 carrying this text, which the add-host
        // modal renders next to the fields the admin already filled in.
        val normalizedBaseUrl = normalizeHostBaseUrl(baseUrl, "base URL")
        val normalizedCallbackUrl = normalizeHostBaseUrl(gzacCallbackBaseUrl, "GZAC callback base URL")
        val brokerAmqpUrl = eventBrokerAmqpUrl?.takeIf { it.isNotBlank() }?.let { normalizeBrokerUrl(it) }
        if (!isConnectableBaseUrl(normalizedBaseUrl)) {
            throw ExternalPluginHostValidationException(
                "'$normalizedBaseUrl' is not a reachable address for the base URL. 0.0.0.0 (and " +
                    "the IPv6 equivalent ::) is a bind address, not a connect address — use the " +
                    "host name or IP address GZAC can reach the plugin host on, for example " +
                    "http://localhost:8090."
            )
        }
        // Push body carries service token + decrypted secret properties + broker credentials.
        // HMAC signs it, does not encrypt it. Re-runs on every baseUrl change in updateConnection.
        requireAllowedHostOrigin(normalizedBaseUrl)
        requireConfidentialTransport(normalizedBaseUrl, "Refusing to register host")
        val resolvedTtlMs = resolveEventQueueTtlMs(eventQueueMode, eventQueueTtlMs)
        val host = ExternalPluginHost(
            id = id,
            name = name,
            baseUrl = normalizedBaseUrl,
            secret = encryptionService.encrypt(secret),
            status = ExternalPluginHostStatus.UNREACHABLE,
            kind = kind,
            gzacCallbackBaseUrl = normalizedCallbackUrl,
            eventBrokerAmqpUrl = brokerAmqpUrl,
            eventBrokerExchange = eventBrokerExchange?.takeIf { it.isNotBlank() },
            eventQueueMode = eventQueueMode,
            eventQueueTtlMs = resolvedTtlMs,
            frontendOrigins = joinFrontendOrigins(normalizeFrontendOrigins(frontendOrigins)),
        )
        return hostRepository.save(host)
    }

    /**
     * Updates only the browser origins allowed to embed this host's plugin screens. Connection
     * fields have their own update path, [updateConnection], which re-runs the registration-time
     * transport checks.
     *
     * The origins reach the plugin host on the next push (registration, this update, or any
     * discovery poll), which serves them as `frame-ancestors`. An empty list means no page may
     * frame this host's plugins.
     */
    fun updateFrontendOrigins(hostId: UUID, frontendOrigins: List<String>): ExternalPluginHost {
        val host = get(hostId)
        host.frontendOrigins = joinFrontendOrigins(normalizeFrontendOrigins(frontendOrigins))
        return hostRepository.save(host)
    }

    private fun joinFrontendOrigins(origins: List<String>): String? =
        origins.joinToString(",").takeIf { it.isNotEmpty() }

    /**
     * Updates only the per-host event-queue declaration knobs. The connection fields (base URL,
     * secret, broker URL, broker exchange) are edited through [updateConnection], which re-runs
     * the transport checks. Mode and TTL only affect the queue declaration on the plugin-host
     * side; the next configuration push propagates the change so the host swaps its queue.
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
     * Updates the connection fields of a registered host or app so an operator can repoint it in
     * place — moved broker, moved host, rotated admin token — without recreating it and orphaning
     * its configurations (#618).
     *
     * Field semantics: `null` leaves a field unchanged. [secret] additionally treats blank as
     * unchanged (an untouched password field). The broker fields treat blank as *clear* — they are
     * the only optional ones at registration. [name], [baseUrl] and [gzacCallbackBaseUrl] reject
     * blank: they are required at registration and clearing them would break the row.
     *
     * Every check register() runs re-runs here against the *effective* result, so the invariant
     * "no push carries broker credentials to a host reachable only over plaintext" survives any
     * combination of edits: broker added to an http host, baseUrl flipped to http under an
     * existing broker, or both at once.
     *
     * The caller is expected to follow up with a single-host re-discovery, which announces the
     * (possibly new) callback URL and re-pushes every configuration with the new values.
     *
     * A change of base URL, secret or broker URL is also a revocation event: every outstanding
     * service/user token under the host dies by generation bump, and the re-discovery's push mints
     * fresh ones ([revokeTokensUnderHost]). A base-url change additionally deletes the
     * configurations, best-effort, from the address just left — GZAC stops polling it, so nothing
     * else would ever clean them up there ([purgeConfigurationsFromOldAddress]).
     */
    fun updateConnection(
        hostId: UUID,
        name: String? = null,
        baseUrl: String? = null,
        secret: String? = null,
        gzacCallbackBaseUrl: String? = null,
        eventBrokerAmqpUrl: String? = null,
        eventBrokerExchange: String? = null,
    ): ExternalPluginHost {
        val host = get(hostId)

        name?.let {
            if (it.isBlank()) throw ExternalPluginHostValidationException("The host name must not be blank.")
        }
        val normalizedCallbackUrl = gzacCallbackBaseUrl?.let {
            if (it.isBlank()) {
                throw ExternalPluginHostValidationException(
                    "The GZAC callback base URL must not be blank — the host needs it to reach " +
                        "this GZAC for plugin callbacks."
                )
            }
            // Host calls back here with a service token — and a live user token for as:"user".
            normalizeHostBaseUrl(it, "GZAC callback base URL")
        }
        val normalizedBaseUrl = baseUrl?.let {
            if (it.isBlank()) throw ExternalPluginHostValidationException("The base URL must not be blank.")
            normalizeHostBaseUrl(it, "base URL")
        }
        if (eventBrokerAmqpUrl != null && eventBrokerAmqpUrl.contains("$AMQP_USERINFO_REDACTION@")) {
            throw ExternalPluginHostValidationException(
                "The event broker AMQP URL looks like a redacted value " +
                    "('$AMQP_USERINFO_REDACTION@'). Re-enter the full URL including credentials, " +
                    "or omit the field to leave the stored value unchanged."
            )
        }

        val effectiveBaseUrl = normalizedBaseUrl ?: host.baseUrl
        // Blank broker URL clears it (events disabled); null leaves the stored value in place.
        val effectiveBrokerUrl = when {
            eventBrokerAmqpUrl == null -> host.eventBrokerAmqpUrl
            eventBrokerAmqpUrl.isBlank() -> null
            else -> normalizeBrokerUrl(eventBrokerAmqpUrl)
        }
        // Bind address first — precise diagnostic beats the generic transport refusal.
        if (!isConnectableBaseUrl(effectiveBaseUrl)) {
            throw ExternalPluginHostValidationException(
                "'$effectiveBaseUrl' is not a reachable address for the base URL. 0.0.0.0 (and " +
                    "the IPv6 equivalent ::) is a bind address, not a connect address — use the " +
                    "host name or IP address GZAC can reach the plugin host on, for example " +
                    "http://localhost:8090."
            )
        }
        if (normalizedBaseUrl != null) requireAllowedHostOrigin(normalizedBaseUrl)
        // Skipped for a pure rename of an existing plaintext row — else it could never be renamed.
        if (normalizedBaseUrl != null || effectiveBrokerUrl != null) {
            requireConfidentialTransport(effectiveBaseUrl, "Refusing to update host")
        }
        if (normalizedBaseUrl != null && normalizedBaseUrl != host.baseUrl) {
            hostRepository.findByBaseUrl(normalizedBaseUrl)?.takeIf { it.id != hostId }?.let { other ->
                throw ExternalPluginHostValidationException(
                    "'$normalizedBaseUrl' is already registered as host '${other.name}' " +
                        "(${other.id}). Two host rows must not share one base URL."
                )
            }
        }

        val baseUrlChanged = normalizedBaseUrl != null && normalizedBaseUrl != host.baseUrl
        val oldBaseUrl = host.baseUrl
        // Decrypted before the mutations below: the purge authenticates against the old address
        // with the old token, and re-entering the stored secret must not count as a rotation.
        val oldAdminToken = if (baseUrlChanged || !secret.isNullOrBlank()) {
            runCatching { encryptionService.decrypt(host.secret) }.getOrNull()
        } else {
            null
        }
        val secretChanged = !secret.isNullOrBlank() && secret != oldAdminToken
        val brokerChanged = effectiveBrokerUrl != host.eventBrokerAmqpUrl

        val changes = describeConnectionChanges(
            host = host,
            name = name,
            baseUrl = normalizedBaseUrl,
            gzacCallbackBaseUrl = normalizedCallbackUrl,
            brokerUrl = effectiveBrokerUrl,
            brokerUrlSupplied = eventBrokerAmqpUrl != null,
            eventBrokerExchange = eventBrokerExchange,
            secretChanged = secretChanged,
        )

        name?.let { host.name = it }
        normalizedBaseUrl?.let { host.baseUrl = it }
        if (secretChanged) host.secret = encryptionService.encrypt(secret!!)
        normalizedCallbackUrl?.let { host.gzacCallbackBaseUrl = it }
        eventBrokerAmqpUrl?.let { host.eventBrokerAmqpUrl = effectiveBrokerUrl }
        eventBrokerExchange?.let { host.eventBrokerExchange = it.takeIf { ex -> ex.isNotBlank() } }

        if (changes.isNotEmpty()) {
            // Can redirect every configuration secret to a new address — must leave a trace.
            logger.info {
                "External plugin host ${host.id} ('${host.name}') connection updated by " +
                    "'${SecurityUtils.getCurrentUserLogin() ?: "system"}': ${changes.joinToString("; ")}"
            }
        }
        if (baseUrlChanged || secretChanged) {
            // Fresh start against the new reality; the follow-up discovery records truthful status.
            host.consecutiveFailures = 0
            // Old status attested the old address. Else the row shows CONNECTED for
            // failureThreshold more polls after a repoint to a dead address.
            host.status = ExternalPluginHostStatus.UNREACHABLE
        }
        if (baseUrlChanged) {
            // definition.baseUrl is denormalized from the host row and feeds bundle/logo URLs —
            // rewrite it now instead of serving the dead old address until the next poll.
            val definitions = definitionRepository.findAllByHostId(hostId)
            definitions.forEach { it.baseUrl = "${host.baseUrl}/plugins/${it.pluginId}" }
            definitionRepository.saveAll(definitions)
        }

        val configurationIds = if (baseUrlChanged || secretChanged || brokerChanged) {
            revokeTokensUnderHost(hostId)
        } else {
            emptyList()
        }
        if (baseUrlChanged) {
            purgeConfigurationsFromOldAddress(hostId, oldBaseUrl, oldAdminToken, configurationIds)
        }
        return hostRepository.save(host)
    }

    /**
     * Kills every outstanding token (service *and* user) of this host's configurations by bumping
     * their generation counters — [ExternalPluginConfigurationService.revokeTokens]'s mechanism,
     * minus its per-configuration re-push: the caller's follow-up re-discovery re-pushes the whole
     * host with fresh tokens in one pass. Whatever still holds a token minted before a repoint or
     * credential rotation must be assumed hostile once GZAC stops talking to it.
     *
     * Returns the configuration ids — exactly the set a repoint then purges from the old address.
     */
    private fun revokeTokensUnderHost(hostId: UUID): List<UUID> =
        definitionRepository.findAllByHostId(hostId)
            .flatMap { configurationRepository.findAllByDefinitionId(it.id) }
            .map { configuration ->
                configuration.tokenGeneration += 1
                configurationRepository.save(configuration).id
            }

    /**
     * Best-effort cleanup of the address a repoint just left, authenticated with its *old* admin
     * token. Without it the configurations are orphaned there forever: GZAC no longer polls the
     * old address, so the discovery reconciliation pass can never prune them — the same trap
     * [delete] works around, with the same scope choice: a dead old address only logs, nothing
     * retries.
     *
     * Runs after commit — host I/O stays out of the transaction, and it lands before the caller's
     * re-discovery populates the new address.
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
                    val deleted = hostClient.deleteConfiguration(oldBaseUrl, oldAdminToken, configurationId.toString())
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
     * Refuses a base URL that cannot carry a push confidentially. Unconditional — the body carries
     * the service token and decrypted secret properties, not just broker credentials.
     */
    private fun requireConfidentialTransport(baseUrl: String, refusalPrefix: String) {
        if (allowPlaintextHostTransport || isSecureTransport(baseUrl)) return
        throw ExternalPluginHostValidationException(
            "$refusalPrefix '$baseUrl': the configuration push carries a GZAC service token, the " +
                "plugin's decrypted secret properties and any event broker credentials, so the " +
                "host must be reachable over HTTPS (or a loopback address for local " +
                "development). Enable TLS on the host, or set '$ALLOW_PLAINTEXT_PROPERTY=true' to " +
                "accept the risk on a trusted network."
        )
    }

    /**
     * Refuses a base URL outside the operator allowlist. No-op when unset (the default). Stops a
     * repoint — or a stolen admin session — from collecting every configuration's secrets.
     */
    private fun requireAllowedHostOrigin(baseUrl: String) {
        if (allowedHostOrigins.isEmpty()) return
        if (allowedHostOrigins.any { matchesAllowedOrigin(baseUrl, it) }) return
        throw ExternalPluginHostValidationException(
            "'$baseUrl' is not an allowed plugin host address. This deployment restricts plugin " +
                "hosts to ${allowedHostOrigins.joinToString(", ")} ('$ALLOWED_ORIGINS_PROPERTY'). " +
                "Point the host at one of those origins, or have an operator add this one to the " +
                "allowlist."
        )
    }

    /**
     * Changed connection fields, for the audit log. Broker userinfo redacted, secret reported as a
     * fact only. Call before mutating the entity.
     */
    private fun describeConnectionChanges(
        host: ExternalPluginHost,
        name: String?,
        baseUrl: String?,
        gzacCallbackBaseUrl: String?,
        brokerUrl: String?,
        brokerUrlSupplied: Boolean,
        eventBrokerExchange: String?,
        secretChanged: Boolean,
    ): List<String> = buildList {
        if (name != null && name != host.name) add("name '${host.name}' -> '$name'")
        if (baseUrl != null && baseUrl != host.baseUrl) add("baseUrl '${host.baseUrl}' -> '$baseUrl'")
        if (gzacCallbackBaseUrl != null && gzacCallbackBaseUrl != host.gzacCallbackBaseUrl) {
            add("gzacCallbackBaseUrl '${host.gzacCallbackBaseUrl}' -> '$gzacCallbackBaseUrl'")
        }
        if (brokerUrlSupplied && brokerUrl != host.eventBrokerAmqpUrl) {
            add(
                "eventBrokerAmqpUrl '${redactAmqpUserInfo(host.eventBrokerAmqpUrl)}' -> " +
                    "'${redactAmqpUserInfo(brokerUrl)}'"
            )
        }
        val newExchange = eventBrokerExchange?.takeIf { it.isNotBlank() }
        if (eventBrokerExchange != null && newExchange != host.eventBrokerExchange) {
            add("eventBrokerExchange '${host.eventBrokerExchange}' -> '$newExchange'")
        }
        if (secretChanged) add("secret rotated")
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

        /** Replaces AMQP userinfo in responses; [updateConnection] refuses URLs echoing it back. */
        const val AMQP_USERINFO_REDACTION = "***"

        const val ALLOWED_ORIGINS_PROPERTY = "valtimo.external-plugin.allowed-host-origins"

        const val ALLOW_PLAINTEXT_PROPERTY = "valtimo.external-plugin.allow-plaintext-host-transport"

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
         * Validates and canonicalises a host-facing base URL (the host's address, or the GZAC
         * callback address). Fails closed, unlike [isConnectableBaseUrl]: consumers concatenate
         * this value raw into a request URI and an iframe `src`. Paths are allowed — reverse
         * proxies put hosts under a prefix.
         */
        fun normalizeHostBaseUrl(value: String, field: String): String {
            val trimmed = value.trim().trimEnd('/')
            if (trimmed.isEmpty()) invalidHostBaseUrl(value, field, "it is blank")
            if (trimmed.any { it.isWhitespace() }) invalidHostBaseUrl(value, field, "it contains whitespace")
            if (trimmed.contains('*')) invalidHostBaseUrl(value, field, "wildcards are not allowed")
            val uri = runCatching { URI(trimmed) }.getOrNull()
                ?: invalidHostBaseUrl(value, field, "it is not a valid URL")
            val scheme = uri.scheme?.lowercase() ?: invalidHostBaseUrl(value, field, "it has no scheme")
            if (scheme != "http" && scheme != "https") {
                invalidHostBaseUrl(value, field, "only http and https are supported, not '$scheme'")
            }
            // Raw authority, not `host`: URI reports no host for an underscored Docker name.
            val authority = uri.authority?.takeIf { it.isNotBlank() }
                ?: invalidHostBaseUrl(value, field, "it has no host name")
            if (authority.contains('@')) invalidHostBaseUrl(value, field, "it must not contain credentials")
            if (uri.query != null || uri.fragment != null) {
                invalidHostBaseUrl(value, field, "it must not contain a query string or fragment")
            }
            return trimmed
        }

        private fun invalidHostBaseUrl(value: String, field: String, reason: String): Nothing =
            throw ExternalPluginHostValidationException(
                "'$value' is not a valid $field: $reason. Enter the address GZAC can reach, for " +
                    "example https://plugin-host.example.com or http://localhost:8090."
            )

        /**
         * Validates an event broker URL. Scheme is enforced on write so an unexpected one cannot
         * carry a password past [redactAmqpUserInfo] into an API response.
         */
        fun normalizeBrokerUrl(value: String): String {
            val trimmed = value.trim()
            val scheme = runCatching { URI(trimmed) }.getOrNull()?.scheme?.lowercase()
            if (scheme != "amqp" && scheme != "amqps") {
                throw ExternalPluginHostValidationException(
                    "'${redactAmqpUserInfo(trimmed)}' is not a valid event broker AMQP URL: it " +
                        "must be a parseable URL with scheme amqp or amqps, for example " +
                        "amqp://user:password@rabbitmq:5672. Percent-encode any reserved " +
                        "character in the credentials."
                )
            }
            return trimmed
        }

        /**
         * Replaces broker-URL userinfo with `***@`. Scheme- and case-agnostic, and scoped to the
         * authority so an `@` in a vhost path is not mistaken for a credential separator.
         */
        fun redactAmqpUserInfo(url: String?): String? {
            if (url.isNullOrBlank()) return url
            val separator = url.indexOf("://")
            // No authority — redact wholesale rather than risk echoing a credential.
            if (separator < 0) return if (url.contains('@')) AMQP_USERINFO_REDACTION else url
            val authorityStart = separator + 3
            val authorityEnd = url.indexOf('/', authorityStart).takeIf { it >= 0 } ?: url.length
            val at = url.lastIndexOf('@', authorityEnd - 1)
            if (at < authorityStart) return url
            return url.substring(0, authorityStart) + AMQP_USERINFO_REDACTION + url.substring(at)
        }

        /**
         * Whether [baseUrl]'s origin matches one allowlist entry. A leading `*.` matches one or
         * more labels but never the bare apex — `*.example.com` excludes `example.com`.
         */
        fun matchesAllowedOrigin(baseUrl: String, pattern: String): Boolean {
            val uri = runCatching { URI(baseUrl) }.getOrNull() ?: return false
            val scheme = uri.scheme?.lowercase() ?: return false
            val authority = uri.authority?.lowercase() ?: return false
            // Split by hand — '*' is illegal in a URI authority, so URI() would drop these entries.
            val normalized = pattern.trim().trimEnd('/').lowercase()
            val separator = normalized.indexOf("://")
            if (separator < 0) return false
            if (scheme != normalized.substring(0, separator)) return false
            val patternAuthority = normalized.substring(separator + 3)
            if (patternAuthority.isEmpty()) return false
            if (patternAuthority.startsWith("*.")) {
                // Keep the dot: ".example.com" cannot match "notexample.com".
                val suffix = patternAuthority.substring(1)
                return authority.endsWith(suffix) && authority.length > suffix.length
            }
            return authority == patternAuthority
        }

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
