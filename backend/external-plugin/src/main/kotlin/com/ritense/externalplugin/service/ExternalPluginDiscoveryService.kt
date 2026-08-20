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
import com.ritense.externalplugin.client.ExternalPluginHostClient.HostConfigurationSummary
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionTemplate
import java.time.Instant
import java.util.UUID

/**
 * Polls every registered host: health check, manifest discovery, configuration reconciliation
 * (pruning host-side configs this GZAC owns but no longer has) and configuration re-push.
 *
 * Transaction discipline: HTTP calls to the host (health, listings, config pushes/deletes) run
 * **outside** any database transaction; database writes happen in short per-host transactions via
 * [transactionTemplate]. A slow or hanging host therefore never pins a database connection or
 * transaction open, and one host's failure never rolls back another host's bookkeeping.
 *
 * Status discipline: [ExternalPluginHostStatus.CONNECTED] is recorded only after a fully
 * successful poll — the host answered `/health` **and** GZAC fetched its state (plugin and
 * configuration listings) with valid credentials. A host that pings but rejects the admin token
 * counts toward the same failure threshold as an unreachable one, so the UI never advertises a
 * host GZAC cannot actually use.
 */
@Service
@SkipComponentScan
class ExternalPluginDiscoveryService(
    private val hostRepository: ExternalPluginHostRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val configurationService: ExternalPluginConfigurationService,
    private val hostService: ExternalPluginHostService,
    private val hostClient: ExternalPluginHostClient,
    private val transactionTemplate: TransactionTemplate,
    private val failureThreshold: Int,
    /**
     * Instance key used when a host row pre-dates `gzac_callback_base_url`. Must match the fallback
     * `ExternalPluginConfigurationService` uses for `gzacBaseUrl`, or the host would end up with two
     * entries for the same GZAC.
     */
    private val fallbackGzacBaseUrl: String,
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

    /**
     * Polls a single host on demand, outside the periodic cycle. Used right after registering an
     * app so its single plugin is discovered and available to configure immediately instead of on
     * the next polling tick. Best-effort: any failure is swallowed (an unreachable host is simply
     * marked as such by [pollHost]) so registration never fails because discovery could not reach
     * the host yet.
     */
    fun discoverHost(hostId: UUID) {
        val host = hostRepository.findById(hostId).orElse(null) ?: return
        try {
            pollHost(host)
        } catch (e: Exception) {
            logger.warn(e) { "External plugin discovery failed for host ${host.id} (${host.baseUrl})" }
        }
    }

    private fun pollHost(host: ExternalPluginHost) {
        // HTTP health probe outside any transaction.
        if (!hostClient.health(host.baseUrl)) {
            transactionTemplate.executeWithoutResult { recordFailedPoll(host.id, "health probe failed") }
            return
        }
        try {
            val adminToken = hostService.decryptedSecret(host)

            // Re-announce this GZAC instance and the browser origins allowed to frame its plugin
            // screens. Doing it on every poll — not only at registration — is what makes the host's
            // frame-ancestors allowlist self-healing: a newly connected GZAC, a host that lost its
            // database, or an edited origin list all converge within one cycle with neither side
            // restarted. HTTP call, so outside any transaction; a failure is logged and swallowed by
            // pushGzacInstance and retried next cycle, so it never fails the poll.
            pushGzacInstance(host, adminToken)

            // Both listings are fetched over HTTP (outside any transaction) BEFORE any local state
            // is read: the reconciliation safety argument requires the host snapshot to be older
            // than the local read — see [reconcileConfigurations].
            val plugins = hostClient.listPlugins(host.baseUrl, adminToken)
            val hostConfigurations = hostClient.listConfigurations(host.baseUrl, adminToken)

            // Short transaction: upsert discovered definitions and mark missing ones.
            transactionTemplate.executeWithoutResult {
                val seenDefinitionIds = mutableSetOf<UUID>()
                plugins.forEach { manifest ->
                    val pluginId = manifest.get("pluginId")?.asText()
                    if (pluginId.isNullOrBlank()) return@forEach
                    val defId = upsertDefinition(host, pluginId, manifest)
                    if (defId != null) seenDefinitionIds += defId
                }
                markMissingDefinitions(host, seenDefinitionIds)
            }

            // Reconciliation deletes and config pushes are HTTP calls again — outside any transaction.
            reconcileConfigurations(host, adminToken, hostConfigurations)
            syncConfigurations(host)

            // CONNECTED is recorded only now: it attests "state fetched and synced with valid
            // credentials this cycle", not merely "the host answers /health".
            transactionTemplate.executeWithoutResult { recordSuccessfulPoll(host.id) }
        } catch (e: Exception) {
            // A host that answers /health but fails the authenticated state fetch is just as
            // unusable as one that does not answer at all — count it toward the same threshold
            // instead of leaving the host CONNECTED on stale information.
            transactionTemplate.executeWithoutResult {
                recordFailedPoll(host.id, e.message ?: e.javaClass.simpleName)
            }
            throw e
        }
    }

    /**
     * Pushes this GZAC instance's identity and frontend origins to the host. Best-effort: a failure
     * only means the host keeps the origins it already had (or none) until the next poll, so it must
     * never abort the rest of the discovery cycle.
     */
    private fun pushGzacInstance(host: ExternalPluginHost, adminToken: String) {
        try {
            hostClient.registerGzacInstance(
                host.baseUrl,
                adminToken,
                host.gzacCallbackBaseUrl ?: fallbackGzacBaseUrl,
                host.frontendOriginList,
            )
        } catch (e: Exception) {
            logger.warn(e) { "Failed to register this GZAC instance with plugin host ${host.id} (${host.baseUrl})" }
        }
    }

    private fun recordFailedPoll(hostId: UUID, reason: String) {
        val host = hostRepository.findById(hostId).orElse(null) ?: return
        host.lastHealthCheck = Instant.now()
        host.consecutiveFailures += 1
        if (host.consecutiveFailures >= failureThreshold && host.status != ExternalPluginHostStatus.UNREACHABLE) {
            host.status = ExternalPluginHostStatus.UNREACHABLE
            logger.warn {
                "Marking external plugin host $hostId as UNREACHABLE after " +
                    "${host.consecutiveFailures} consecutive failed polls (last failure: $reason)"
            }
        }
        hostRepository.save(host)
    }

    private fun recordSuccessfulPoll(hostId: UUID) {
        val host = hostRepository.findById(hostId).orElse(null) ?: return
        host.lastHealthCheck = Instant.now()
        host.consecutiveFailures = 0
        host.status = ExternalPluginHostStatus.CONNECTED
        hostRepository.save(host)
    }

    /**
     * Deletes host-side configurations that this GZAC owns but no longer has — the healing pass
     * for "config deleted while the host was down/unreachable" and for any other host-side drift.
     *
     * Ownership scope: only entries whose `ownerId` equals this host row's UUID are candidates.
     * Configs owned by another GZAC connected to the same host, and unowned entries (pushed by a
     * GZAC that predates ownership), are never touched. [hostConfigurations] is `null` when the
     * host predates the listing endpoint — reconciliation is then skipped entirely.
     *
     * Safety: the host snapshot was fetched BEFORE the local set is read here, so a configuration
     * created concurrently is absent from the snapshot (never a candidate), and one deleted
     * concurrently is still in the local set (pruned next cycle). Configuration ids are
     * GZAC-generated UUIDs and never reused, so no id can be recreated between the two reads.
     */
    private fun reconcileConfigurations(
        host: ExternalPluginHost,
        adminToken: String,
        hostConfigurations: List<HostConfigurationSummary>?,
    ) {
        if (hostConfigurations == null) return
        val ownerId = host.id.toString()
        val owned = hostConfigurations.filter { it.ownerId == ownerId }
        if (owned.isEmpty()) return

        // Short transaction: read this GZAC's current configuration set for the host.
        val localIds = transactionTemplate.execute {
            definitionRepository.findAllByHostId(host.id)
                .flatMap { definition -> configurationRepository.findAllByDefinitionId(definition.id) }
                .map { configuration -> configuration.id.toString() }
                .toSet()
        } ?: return

        val orphans = owned.filter { it.configurationId !in localIds }
        if (orphans.isEmpty()) return

        val deletedIds = mutableListOf<String>()
        orphans.forEach { orphan ->
            // deleteConfiguration handles its own exceptions and treats 404 as success.
            if (hostClient.deleteConfiguration(host.baseUrl, adminToken, orphan.configurationId)) {
                deletedIds += orphan.configurationId
            } else {
                logger.warn {
                    "Failed to delete orphaned configuration ${orphan.configurationId} from host " +
                        "${host.id}; will retry on the next discovery cycle"
                }
            }
        }
        if (deletedIds.isNotEmpty()) {
            logger.info {
                "Reconciliation removed ${deletedIds.size} orphaned configuration(s) no longer " +
                    "present in GZAC from host ${host.id}: $deletedIds"
            }
        }
    }

    private fun syncConfigurations(host: ExternalPluginHost) {
        val definitions = definitionRepository.findAllByHostId(host.id)
        if (definitions.isEmpty()) return

        definitions.forEach { definition ->
            if (definition.requiresReacceptance) {
                // No pushes means no fresh service tokens: the last one the host holds expires
                // within its (short) TTL, after which the changed plugin can no longer call back
                // into GZAC until an admin re-accepts the new content.
                logger.warn {
                    "Withholding configuration pushes for plugin '${definition.pluginId}@${definition.version}': " +
                        "package content changed on host ${host.id} and awaits re-acceptance"
                }
                return@forEach
            }
            val configs = configurationRepository.findAllByDefinitionId(definition.id)
            configs.forEach { config ->
                try {
                    val pushed = configurationService.pushToHost(config, definition, host)
                    if (!pushed) {
                        logger.warn { "Failed to push configuration ${config.id} for plugin '${definition.pluginId}' to host ${host.id}" }
                    }
                } catch (e: Exception) {
                    logger.warn(e) { "Failed to push configuration ${config.id} for plugin '${definition.pluginId}' to host ${host.id}" }
                }
            }
        }
    }

    private fun upsertDefinition(host: ExternalPluginHost, pluginId: String, pluginEntry: JsonNode): UUID? {
        // Plugin-host returns: {pluginId, version, contentHash, manifest: {pluginId, version,
        // translations, ...}}. The manifest carries no top-level name/description — those live
        // per-locale under `translations` (see localizedManifestValue).
        val manifest = pluginEntry.get("manifest") ?: pluginEntry
        val version = pluginEntry.get("version")?.asText() ?: manifest.get("version")?.asText() ?: "0.0.0"
        val discoveredContentHash = pluginEntry.get("contentHash")?.asText()?.takeIf { it.isNotBlank() }

        val existing = definitionRepository.findByPluginIdAndVersion(pluginId, version)
        if (existing != null && existing.hostId != host.id) {
            logger.warn {
                "External plugin '$pluginId@$version' already registered on host ${existing.hostId}; ignoring discovery from host ${host.id}"
            }
            return null
        }

        val definition = existing ?: ExternalPluginDefinition(
            id = UUID.randomUUID(),
            pluginId = pluginId,
            version = version,
            hostId = host.id,
            baseUrl = "${host.baseUrl}/plugins/$pluginId",
            status = ExternalPluginDefinitionStatus.AVAILABLE,
        )

        // Content pinning: the hash of the package as first discovered is what the admin's
        // acceptance covers. Anything else the host serves later under the same pluginId@version is
        // a change of the running code, so the definition is flagged and its stored (accepted)
        // manifest/schema stay frozen until an admin re-accepts — see acceptContent on the
        // definition service. A host without hash support (older host) skips pinning entirely.
        if (discoveredContentHash != null) {
            val pinnedContentHash = definition.contentHash
            when {
                pinnedContentHash == null -> definition.contentHash = discoveredContentHash
                discoveredContentHash != pinnedContentHash -> {
                    if (definition.pendingContentHash != discoveredContentHash) {
                        logger.warn {
                            "Package content of external plugin '$pluginId@$version' on host ${host.id} changed " +
                                "(pinned $pinnedContentHash, now $discoveredContentHash) — " +
                                "flagged for re-acceptance; configuration pushes are withheld"
                        }
                        definition.pendingContentHash = discoveredContentHash
                    }
                    // The plugin is present on the host, just changed — keep it visible.
                    definition.status = ExternalPluginDefinitionStatus.AVAILABLE
                    definition.consecutiveMisses = 0
                    definitionRepository.save(definition)
                    return definition.id
                }
                definition.pendingContentHash != null -> {
                    // The host serves the pinned bytes again (e.g. a tampered package was rolled
                    // back) — the flag has served its purpose.
                    logger.info {
                        "Package content of external plugin '$pluginId@$version' matches the pinned hash again; " +
                            "clearing the re-acceptance flag"
                    }
                    definition.pendingContentHash = null
                }
            }
        }

        val newConfigSchema = manifest.get("configurationSchema") as? ObjectNode
        warnOnDroppedSecretFlags(definition, newConfigSchema)
        warnOnDroppedEgressTargetFlags(definition, newConfigSchema)

        definition.name = localizedManifestValue(manifest, "name") ?: definition.name
        definition.description = localizedManifestValue(manifest, "description") ?: definition.description
        definition.provider = manifest.get("provider")?.asText() ?: definition.provider
        definition.minGzacVersion = manifest.path("compatibility").get("minGzacVersion")?.asText() ?: definition.minGzacVersion
        definition.maxGzacVersion = manifest.path("compatibility").get("maxGzacVersion")?.asText() ?: definition.maxGzacVersion
        definition.configSchema = newConfigSchema
        definition.manifestJson = if (manifest is ObjectNode) manifest.deepCopy() else null
        definition.baseUrl = "${host.baseUrl}/plugins/$pluginId"
        definition.status = ExternalPluginDefinitionStatus.AVAILABLE
        definition.consecutiveMisses = 0

        definitionRepository.save(definition)
        return definition.id
    }

    /**
     * A property that loses its `x-secret: true` flag between manifest versions silently changes
     * from "encrypted at rest, masked in the API" to plain text on the next save. That is almost
     * always a plugin-author mistake, so surface it loudly for the operator.
     */
    private fun warnOnDroppedSecretFlags(definition: ExternalPluginDefinition, newConfigSchema: ObjectNode?) {
        val previousSecrets = secretFieldNames(definition.configSchema)
        if (previousSecrets.isEmpty()) return
        val droppedSecrets = previousSecrets - secretFieldNames(newConfigSchema)
        if (droppedSecrets.isNotEmpty()) {
            logger.warn {
                "Plugin '${definition.pluginId}@${definition.version}' dropped the x-secret flag from " +
                    "previously secret propert${if (droppedSecrets.size == 1) "y" else "ies"} " +
                    "${droppedSecrets.joinToString(", ")} in its new configuration schema — these values " +
                    "will no longer be encrypted or masked"
            }
        }
    }

    /**
     * A property that loses its `x-egress-target: true` flag stops contributing its URL to the
     * configuration's egress allowlist, so the next push silently narrows what the plugin can reach
     * and its outbound calls start failing. The mirror image of [warnOnDroppedSecretFlags]: almost
     * always a plugin-author mistake, and invisible without this.
     */
    private fun warnOnDroppedEgressTargetFlags(definition: ExternalPluginDefinition, newConfigSchema: ObjectNode?) {
        val previous = PluginEgressTargets.egressTargetFieldNames(definition.configSchema)
        if (previous.isEmpty()) return
        val dropped = previous - PluginEgressTargets.egressTargetFieldNames(newConfigSchema)
        if (dropped.isNotEmpty()) {
            logger.warn {
                "Plugin '${definition.pluginId}@${definition.version}' dropped the x-egress-target flag from " +
                    "propert${if (dropped.size == 1) "y" else "ies"} ${dropped.joinToString(", ")} in its new " +
                    "configuration schema — the URLs they hold will no longer be allowed as http_request " +
                    "destinations, and calls to them will be refused"
            }
        }
    }

    private fun secretFieldNames(schema: JsonNode?): Set<String> {
        val schemaProperties = schema?.get("properties") ?: return emptySet()
        return schemaProperties.fields().asSequence()
            .filter { (_, fieldSchema) -> fieldSchema.get("x-secret")?.asBoolean(false) == true }
            .map { (field, _) -> field }
            .toSet()
    }

    private fun markMissingDefinitions(host: ExternalPluginHost, seenDefinitionIds: Set<UUID>) {
        definitionRepository.findAllByHostId(host.id).forEach { definition ->
            if (definition.id in seenDefinitionIds) return@forEach
            definition.consecutiveMisses += 1
            if (definition.consecutiveMisses >= failureThreshold) {
                definition.status = ExternalPluginDefinitionStatus.UNAVAILABLE
            }
            definitionRepository.save(definition)
        }
    }

    /**
     * Resolves a localised manifest value (`name`, `description`) from the manifest's per-locale
     * `translations` block. The manifest has no top-level `name`/`description`; they live in every
     * locale bucket. Prefers the `en` bucket, then falls back to the first declared locale. The
     * result is stored on the denormalised `name`/`description` columns the management UI uses as a
     * fallback when it cannot localise from the manifest itself.
     */
    private fun localizedManifestValue(manifest: JsonNode, key: String): String? {
        val translations = manifest.path("translations")
        if (!translations.isObject) return null
        translations.path("en").path(key).asText("").takeIf { it.isNotBlank() }?.let { return it }
        val firstLocale = translations.fields().asSequence().firstOrNull()?.value ?: return null
        return firstLocale.path(key).asText("").takeIf { it.isNotBlank() }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
