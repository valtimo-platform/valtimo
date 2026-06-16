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
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEventRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.plugin.service.EncryptionService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
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
    private val encryptionService: EncryptionService,
    private val hostClient: ExternalPluginHostClient,
) {

    fun list(): List<ExternalPluginHost> = hostRepository.findAll()

    fun get(id: UUID): ExternalPluginHost = hostRepository.findById(id)
        .orElseThrow { IllegalArgumentException("External plugin host $id not found") }

    fun decryptedSecret(host: ExternalPluginHost): String = encryptionService.decrypt(host.secret)

    fun register(
        name: String,
        baseUrl: String,
        secret: String,
        gzacCallbackBaseUrl: String,
        eventBrokerAmqpUrl: String?,
        eventBrokerExchange: String?,
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
        val host = ExternalPluginHost(
            id = UUID.randomUUID(),
            name = name,
            baseUrl = normalizedBaseUrl,
            secret = encryptionService.encrypt(secret),
            status = ExternalPluginHostStatus.UNREACHABLE,
            gzacCallbackBaseUrl = gzacCallbackBaseUrl.trimEnd('/'),
            eventBrokerAmqpUrl = brokerAmqpUrl,
            eventBrokerExchange = eventBrokerExchange?.takeIf { it.isNotBlank() },
        )
        return hostRepository.save(host)
    }

    fun delete(hostId: UUID) {
        val definitions = definitionRepository.findAllByHostId(hostId)
        for (definition in definitions) {
            val configurations = configurationRepository.findAllByDefinitionId(definition.id)
            for (configuration in configurations) {
                grantedEndpointRepository.deleteAllByConfigurationId(configuration.id)
                grantedEventRepository.deleteAllByConfigurationId(configuration.id)
            }
            configurationRepository.deleteAll(configurations)
        }
        definitionRepository.deleteAll(definitions)
        hostRepository.deleteById(hostId)
    }

    fun uploadPlugin(hostId: UUID, fileName: String, fileBytes: ByteArray): JsonNode {
        val host = get(hostId)
        val adminToken = decryptedSecret(host)
        return hostClient.uploadPlugin(host.baseUrl, adminToken, fileName, fileBytes)
    }

    companion object {
        private val LOOPBACK_HOSTS = setOf("localhost", "127.0.0.1", "::1")

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
