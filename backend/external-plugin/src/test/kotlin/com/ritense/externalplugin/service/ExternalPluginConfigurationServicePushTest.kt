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
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginGrantedEgress
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.exception.ExternalPluginNotFoundException
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedCapabilityRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEgressRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEventRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.plugin.service.EncryptionService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

/**
 * Guards [ExternalPluginConfigurationService.pushToHost]'s security behaviour — the content-hash
 * binding and the re-acceptance freeze — and the [ExternalPluginConfigurationService.revokeTokens]
 * generation bump.
 */
class ExternalPluginConfigurationServicePushTest {

    private val objectMapper = ObjectMapper()

    private lateinit var configurationRepository: ExternalPluginConfigurationRepository
    private lateinit var definitionRepository: ExternalPluginDefinitionRepository
    private lateinit var hostRepository: ExternalPluginHostRepository
    private lateinit var grantedEndpointRepository: ExternalPluginGrantedEndpointRepository
    private lateinit var grantedEventRepository: ExternalPluginGrantedEventRepository
    private lateinit var grantedCapabilityRepository: ExternalPluginGrantedCapabilityRepository
    private lateinit var grantedEgressRepository: ExternalPluginGrantedEgressRepository
    private lateinit var hostClient: ExternalPluginHostClient
    private lateinit var encryptionService: EncryptionService
    private lateinit var propertyEncryptor: PluginPropertyEncryptor
    private lateinit var serviceTokenService: ExternalPluginServiceTokenService
    private lateinit var service: ExternalPluginConfigurationService

    private val definition = ExternalPluginDefinition(
        id = UUID.randomUUID(),
        pluginId = "case-summary",
        version = "1.0.0",
        hostId = UUID.randomUUID(),
        baseUrl = "https://plugin-host.example.com/plugins/case-summary",
        status = ExternalPluginDefinitionStatus.AVAILABLE,
        contentHash = "sha256:accepted",
    )

    private val configuration = ExternalPluginConfiguration(
        id = UUID.randomUUID(),
        definitionId = definition.id,
        title = "Primary",
    )

    private val host = ExternalPluginHost(
        id = definition.hostId,
        name = "host",
        baseUrl = "https://plugin-host.example.com",
        secret = "encrypted-secret",
        status = ExternalPluginHostStatus.CONNECTED,
    )

    @BeforeEach
    fun setUp() {
        configurationRepository = mock()
        definitionRepository = mock()
        hostRepository = mock()
        grantedEndpointRepository = mock()
        grantedEventRepository = mock()
        grantedCapabilityRepository = mock()
        grantedEgressRepository = mock()
        hostClient = mock()
        encryptionService = mock()
        propertyEncryptor = mock()
        serviceTokenService = mock()
        whenever(configurationRepository.save(any<ExternalPluginConfiguration>())).thenAnswer { it.getArgument(0) }
        whenever(configurationRepository.findById(configuration.id)).thenReturn(Optional.of(configuration))
        whenever(definitionRepository.findById(definition.id)).thenReturn(Optional.of(definition))
        whenever(hostRepository.findById(host.id)).thenReturn(Optional.of(host))
        whenever(encryptionService.decrypt("encrypted-secret")).thenReturn("admin-token")
        whenever(propertyEncryptor.decryptSecretFields(any(), anyOrNull())).thenAnswer { it.getArgument(0) }
        whenever(serviceTokenService.issue(any(), any())).thenReturn("svc-token")
        service = ExternalPluginConfigurationService(
            configurationRepository,
            definitionRepository,
            hostRepository,
            grantedEndpointRepository,
            grantedEventRepository,
            grantedCapabilityRepository,
            grantedEgressRepository,
            hostClient,
            propertyEncryptor,
            encryptionService,
            objectMapper,
            serviceTokenService,
            mock<ExternalPluginHostUsageResolver>(),
            "gzac.events",
            "http://localhost:8080",
        )
    }

    @Test
    fun `pushToHost sends the pinned content hash so the host can refuse a changed package`() {
        service.pushToHost(configuration, definition, host)

        verify(hostClient).pushConfiguration(
            baseUrl = eq("https://plugin-host.example.com"),
            adminToken = eq("admin-token"),
            configId = eq(configuration.id.toString()),
            pluginId = eq("case-summary"),
            pluginVersion = eq("1.0.0"),
            properties = any(),
            serviceToken = eq("svc-token"),
            gzacBaseUrl = any(),
            // The ownership claim is the host-row UUID — it scopes which configs this GZAC's
            // reconciliation pass may ever delete on the shared host.
            ownerId = eq(host.id.toString()),
            expectedContentHash = eq("sha256:accepted"),
            eventSubscriptions = any(),
            grantedCapabilities = any(),
            grantedEndpoints = any(),
            allowedEgress = any(),
            eventBrokerUrl = anyOrNull(),
            eventBrokerExchange = any(),
            eventBrokerExchangeType = any(),
            eventQueueMode = any(),
            eventQueueTtlMs = anyOrNull(),
        )
    }

    @Test
    fun `pushToHost unions the manifest egress grants with the x-egress-target origins`() {
        // Provenance is invisible to the host: one merged list, so it never has to know which source
        // an entry came from. Deriving here rather than at create time is what keeps the
        // configuration-driven half in step when an admin edits the URL.
        definition.configSchema = objectMapper.readTree(
            """
            {
              "type": "object",
              "properties": {
                "smartDocumentsUrl": {"type": "string", "format": "uri", "x-egress-target": true}
              }
            }
            """.trimIndent(),
        ) as ObjectNode
        configuration.properties = objectMapper.createObjectNode()
            .put("smartDocumentsUrl", "https://sd.acme-acc.internal:8443/api")
        whenever(grantedEgressRepository.findAllByConfigurationId(configuration.id)).thenReturn(
            listOf(
                ExternalPluginGrantedEgress(
                    id = UUID.randomUUID(),
                    configurationId = configuration.id,
                    target = "api.kvk.nl",
                )
            )
        )

        service.pushToHost(configuration, definition, host)

        val captor = argumentCaptor<List<String>>()
        verify(hostClient).pushConfiguration(
            baseUrl = any(),
            adminToken = any(),
            configId = any(),
            pluginId = any(),
            pluginVersion = any(),
            properties = any(),
            serviceToken = any(),
            gzacBaseUrl = any(),
            ownerId = any(),
            expectedContentHash = anyOrNull(),
            eventSubscriptions = any(),
            grantedCapabilities = any(),
            grantedEndpoints = any(),
            allowedEgress = captor.capture(),
            eventBrokerUrl = anyOrNull(),
            eventBrokerExchange = any(),
            eventBrokerExchangeType = any(),
            eventQueueMode = any(),
            eventQueueTtlMs = anyOrNull(),
        )
        assertThat(captor.firstValue)
            .containsExactly("api.kvk.nl", "https://sd.acme-acc.internal:8443")
    }

    @Test
    fun `pushToHost sends an empty allowlist when nothing was granted — deny by default`() {
        service.pushToHost(configuration, definition, host)

        val captor = argumentCaptor<List<String>>()
        verify(hostClient).pushConfiguration(
            baseUrl = any(),
            adminToken = any(),
            configId = any(),
            pluginId = any(),
            pluginVersion = any(),
            properties = any(),
            serviceToken = any(),
            gzacBaseUrl = any(),
            ownerId = any(),
            expectedContentHash = anyOrNull(),
            eventSubscriptions = any(),
            grantedCapabilities = any(),
            grantedEndpoints = any(),
            allowedEgress = captor.capture(),
            eventBrokerUrl = anyOrNull(),
            eventBrokerExchange = any(),
            eventBrokerExchangeType = any(),
            eventQueueMode = any(),
            eventQueueTtlMs = anyOrNull(),
        )
        assertThat(captor.firstValue).isEmpty()
    }

    @Test
    fun `pushToHost refuses while the definition's changed content awaits re-acceptance`() {
        definition.pendingContentHash = "sha256:changed"

        val pushed = service.pushToHost(configuration, definition, host)

        assertThat(pushed).isFalse()
        // Nothing reaches the host — in particular no fresh service token is minted or shipped.
        verifyNoInteractions(hostClient)
        verifyNoInteractions(serviceTokenService)
    }

    @Test
    fun `revokeTokens bumps the generation and immediately re-pushes a fresh token`() {
        val revoked = service.revokeTokens(configuration.id)

        assertThat(revoked.tokenGeneration).isEqualTo(1L)
        verify(configurationRepository).save(configuration)
        // The after-commit push runs immediately outside a transaction: the host receives a token
        // of the *new* generation, so only leaked/hoarded tokens die.
        verify(serviceTokenService).issue(eq(configuration), eq(definition))
        verify(hostClient).pushConfiguration(
            baseUrl = any(),
            adminToken = any(),
            configId = eq(configuration.id.toString()),
            pluginId = any(),
            pluginVersion = any(),
            properties = any(),
            serviceToken = eq("svc-token"),
            gzacBaseUrl = any(),
            ownerId = any(),
            expectedContentHash = anyOrNull(),
            eventSubscriptions = any(),
            grantedCapabilities = any(),
            grantedEndpoints = any(),
            allowedEgress = any(),
            eventBrokerUrl = anyOrNull(),
            eventBrokerExchange = any(),
            eventBrokerExchangeType = any(),
            eventQueueMode = any(),
            eventQueueTtlMs = anyOrNull(),
        )
    }

    @Test
    fun `revokeTokens fails clearly for an unknown configuration`() {
        val unknownId = UUID.randomUUID()
        whenever(configurationRepository.findById(unknownId)).thenReturn(Optional.empty())

        assertThatThrownBy { service.revokeTokens(unknownId) }
            .isInstanceOf(ExternalPluginNotFoundException::class.java)
        verify(configurationRepository, never()).save(any())
    }

    @Test
    fun `applyApprovedOverwrite pins the new hash and re-grants every configuration to the new manifest`() {
        definition.pendingContentHash = "sha256:stale-flag"
        whenever(definitionRepository.findByPluginIdAndVersion("case-summary", "1.0.0")).thenReturn(definition)
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(listOf(configuration))
        val manifest = objectMapper.readTree(
            """
            {
              "eventSubscriptions": ["com.ritense.valtimo.document.created"],
              "permissions": {
                "endpoints": [{"method": "get", "pattern": "/api/v1/document/*"}],
                "capabilities": ["gzac_api", "not-a-real-capability"]
              }
            }
            """.trimIndent()
        )

        service.applyApprovedOverwrite("case-summary", "1.0.0", "sha256:new", manifest)

        assertThat(definition.contentHash).isEqualTo("sha256:new")
        assertThat(definition.pendingContentHash).isNull()
        verify(definitionRepository).save(definition)

        // Old grants are replaced by exactly the new declared sets.
        verify(grantedEndpointRepository).deleteAllByConfigurationId(configuration.id)
        verify(grantedEventRepository).deleteAllByConfigurationId(configuration.id)
        verify(grantedCapabilityRepository).deleteAllByConfigurationId(configuration.id)
        val endpointCaptor = argumentCaptor<com.ritense.externalplugin.domain.ExternalPluginGrantedEndpoint>()
        verify(grantedEndpointRepository).save(endpointCaptor.capture())
        assertThat(endpointCaptor.firstValue.httpMethod).isEqualTo("GET")
        assertThat(endpointCaptor.firstValue.endpointPattern).isEqualTo("/api/v1/document/*")
        val eventCaptor = argumentCaptor<com.ritense.externalplugin.domain.ExternalPluginGrantedEvent>()
        verify(grantedEventRepository).save(eventCaptor.capture())
        assertThat(eventCaptor.firstValue.eventType).isEqualTo("com.ritense.valtimo.document.created")
        // The unknown capability is skipped instead of failing after the host already replaced
        // the package.
        val capabilityCaptor = argumentCaptor<com.ritense.externalplugin.domain.ExternalPluginGrantedCapability>()
        verify(grantedCapabilityRepository).save(capabilityCaptor.capture())
        assertThat(capabilityCaptor.firstValue.capability.value).isEqualTo("gzac_api")
    }

    @Test
    fun `applyApprovedOverwrite is a no-op for a definition GZAC never discovered`() {
        whenever(definitionRepository.findByPluginIdAndVersion("unknown", "9.9.9")).thenReturn(null)

        service.applyApprovedOverwrite("unknown", "9.9.9", "sha256:new", objectMapper.createObjectNode())

        verify(definitionRepository, never()).save(any())
        verify(grantedEndpointRepository, never()).deleteAllByConfigurationId(any())
    }
}
