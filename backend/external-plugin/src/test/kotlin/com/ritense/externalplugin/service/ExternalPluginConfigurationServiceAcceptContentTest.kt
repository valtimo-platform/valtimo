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
import com.ritense.externalplugin.domain.ExternalPluginGrantedCapability
import com.ritense.externalplugin.domain.ExternalPluginGrantedEgress
import com.ritense.externalplugin.domain.ExternalPluginGrantedEndpoint
import com.ritense.externalplugin.domain.ExternalPluginGrantedEvent
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
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

/**
 * Guards [ExternalPluginConfigurationService.acceptContent]: one acceptance act that pins the
 * reviewed hash, promotes the pending manifest to the accepted one, and re-grants every
 * configuration to exactly the promoted manifest's declared sets.
 */
class ExternalPluginConfigurationServiceAcceptContentTest {

    private val objectMapper = ObjectMapper()

    private lateinit var configurationRepository: ExternalPluginConfigurationRepository
    private lateinit var definitionRepository: ExternalPluginDefinitionRepository
    private lateinit var grantedEndpointRepository: ExternalPluginGrantedEndpointRepository
    private lateinit var grantedEventRepository: ExternalPluginGrantedEventRepository
    private lateinit var grantedCapabilityRepository: ExternalPluginGrantedCapabilityRepository
    private lateinit var grantedEgressRepository: ExternalPluginGrantedEgressRepository
    private lateinit var service: ExternalPluginConfigurationService

    private val definition = ExternalPluginDefinition(
        id = UUID.randomUUID(),
        pluginId = "case-summary",
        version = "1.0.0",
        hostId = UUID.randomUUID(),
        baseUrl = "https://app.example.com/plugins/case-summary",
        status = ExternalPluginDefinitionStatus.AVAILABLE,
        contentHash = "manifest-sha256:accepted",
        pendingContentHash = "manifest-sha256:changed",
    )

    private val configuration = ExternalPluginConfiguration(
        id = UUID.randomUUID(),
        definitionId = definition.id,
        title = "Primary",
    )

    @BeforeEach
    fun setUp() {
        configurationRepository = mock()
        definitionRepository = mock()
        grantedEndpointRepository = mock()
        grantedEventRepository = mock()
        grantedCapabilityRepository = mock()
        grantedEgressRepository = mock()
        whenever(definitionRepository.findById(definition.id)).thenReturn(Optional.of(definition))
        whenever(definitionRepository.save(any<ExternalPluginDefinition>())).thenAnswer { it.getArgument(0) }
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(listOf(configuration))
        service = ExternalPluginConfigurationService(
            configurationRepository,
            definitionRepository,
            mock<ExternalPluginHostRepository>(),
            grantedEndpointRepository,
            grantedEventRepository,
            grantedCapabilityRepository,
            grantedEgressRepository,
            mock<ExternalPluginHostClient>(),
            mock<PluginPropertyEncryptor>(),
            mock<EncryptionService>(),
            objectMapper,
            mock<ExternalPluginServiceTokenService>(),
            mock<ExternalPluginHostUsageResolver>(),
            "gzac.events",
            "http://localhost:8080",
        )
    }

    @Test
    fun `re-pins the pending hash and clears the flag`() {
        val accepted = service.acceptContent(definition.id, "manifest-sha256:changed")

        assertThat(accepted.contentHash).isEqualTo("manifest-sha256:changed")
        assertThat(accepted.pendingContentHash).isNull()
        assertThat(accepted.requiresReacceptance).isFalse()
        verify(definitionRepository).save(definition)
    }

    @Test
    fun `promotes the reviewed pending manifest and re-grants every configuration to its declared sets`() {
        val pendingManifest = objectMapper.readTree(
            """
            {
              "eventSubscriptions": ["com.ritense.valtimo.document.created"],
              "permissions": {
                "endpoints": [{"method": "get", "pattern": "/api/v1/document/*"}],
                "capabilities": ["gzac_api", "http_request"],
                "egress": ["api.kvk.nl"]
              },
              "configurationSchema": {"type": "object"}
            }
            """.trimIndent()
        ) as ObjectNode
        definition.manifestJson = objectMapper.readTree("""{"permissions": {}}""") as ObjectNode
        definition.pendingManifestJson = pendingManifest

        val accepted = service.acceptContent(definition.id, "manifest-sha256:changed")

        // What the admin reviewed becomes the accepted manifest immediately — the re-grant below
        // and any subsequent edit validate against it without waiting for the next discovery poll.
        assertThat(accepted.manifestJson).isEqualTo(pendingManifest)
        assertThat(accepted.configSchema).isEqualTo(pendingManifest.get("configurationSchema"))
        assertThat(accepted.pendingManifestJson).isNull()

        // All four granted sets are replaced by exactly the promoted manifest's declared sets —
        // an accept that only re-issued endpoints would leave the other grants silently stale.
        verify(grantedEndpointRepository).deleteAllByConfigurationId(configuration.id)
        verify(grantedEventRepository).deleteAllByConfigurationId(configuration.id)
        verify(grantedCapabilityRepository).deleteAllByConfigurationId(configuration.id)
        verify(grantedEgressRepository).deleteAllByConfigurationId(configuration.id)
        val endpointCaptor = argumentCaptor<ExternalPluginGrantedEndpoint>()
        verify(grantedEndpointRepository).save(endpointCaptor.capture())
        assertThat(endpointCaptor.firstValue.httpMethod).isEqualTo("GET")
        assertThat(endpointCaptor.firstValue.endpointPattern).isEqualTo("/api/v1/document/*")
        val eventCaptor = argumentCaptor<ExternalPluginGrantedEvent>()
        verify(grantedEventRepository).save(eventCaptor.capture())
        assertThat(eventCaptor.firstValue.eventType).isEqualTo("com.ritense.valtimo.document.created")
        val capabilityCaptor = argumentCaptor<ExternalPluginGrantedCapability>()
        verify(grantedCapabilityRepository, times(2)).save(capabilityCaptor.capture())
        assertThat(capabilityCaptor.allValues.map { it.capability.value })
            .containsExactlyInAnyOrder("gzac_api", "http_request")
        val egressCaptor = argumentCaptor<ExternalPluginGrantedEgress>()
        verify(grantedEgressRepository).save(egressCaptor.capture())
        assertThat(egressCaptor.firstValue.target).isEqualTo("api.kvk.nl")
    }

    @Test
    fun `without a pending manifest it only pins - nothing to re-grant against`() {
        definition.pendingManifestJson = null

        val accepted = service.acceptContent(definition.id, "manifest-sha256:changed")

        assertThat(accepted.pendingContentHash).isNull()
        verify(grantedEndpointRepository, never()).deleteAllByConfigurationId(any())
        verify(grantedEventRepository, never()).deleteAllByConfigurationId(any())
    }

    @Test
    fun `rejects a stale hash - the content changed again since the admin reviewed it`() {
        assertThatThrownBy { service.acceptContent(definition.id, "manifest-sha256:stale") }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("changed again")

        assertThat(definition.contentHash).isEqualTo("manifest-sha256:accepted")
        assertThat(definition.pendingContentHash).isEqualTo("manifest-sha256:changed")
        verify(definitionRepository, never()).save(any())
        verify(grantedEndpointRepository, never()).deleteAllByConfigurationId(any())
    }

    @Test
    fun `rejects a definition without a pending change`() {
        definition.pendingContentHash = null

        assertThatThrownBy { service.acceptContent(definition.id, "manifest-sha256:whatever") }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("no pending content change")
        verify(definitionRepository, never()).save(any())
    }

    @Test
    fun `fails clearly for an unknown definition`() {
        val unknownId = UUID.randomUUID()
        whenever(definitionRepository.findById(unknownId)).thenReturn(Optional.empty())

        assertThatThrownBy { service.acceptContent(unknownId, "manifest-sha256:whatever") }
            .isInstanceOf(ExternalPluginNotFoundException::class.java)
    }
}
