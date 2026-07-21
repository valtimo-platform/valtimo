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
import com.ritense.externalplugin.domain.ExternalPluginCapability
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginGrantedCapability
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedCapabilityRepository
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
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

/**
 * Guards the capability grant validation in [ExternalPluginConfigurationService.create]: only the
 * capabilities known to the platform ([ExternalPluginCapability]) can be granted, and every
 * capability the manifest declares must be granted. Free-form strings never reach the database.
 */
class ExternalPluginConfigurationServiceTest {

    private val objectMapper = ObjectMapper()
    private val definitionId = UUID.randomUUID()

    private lateinit var configurationRepository: ExternalPluginConfigurationRepository
    private lateinit var definitionRepository: ExternalPluginDefinitionRepository
    private lateinit var hostRepository: ExternalPluginHostRepository
    private lateinit var grantedCapabilityRepository: ExternalPluginGrantedCapabilityRepository
    private lateinit var propertyEncryptor: PluginPropertyEncryptor
    private lateinit var service: ExternalPluginConfigurationService

    @BeforeEach
    fun setUp() {
        configurationRepository = mock()
        definitionRepository = mock()
        hostRepository = mock()
        grantedCapabilityRepository = mock()
        propertyEncryptor = mock()
        whenever(configurationRepository.save(any<ExternalPluginConfiguration>())).thenAnswer { it.getArgument(0) }
        whenever(propertyEncryptor.encryptSecretFields(any(), anyOrNull())).thenAnswer { it.getArgument(0) }
        whenever(hostRepository.findById(any())).thenReturn(Optional.empty())
        service = ExternalPluginConfigurationService(
            configurationRepository,
            definitionRepository,
            hostRepository,
            mock<ExternalPluginGrantedEndpointRepository>(),
            mock<ExternalPluginGrantedEventRepository>(),
            grantedCapabilityRepository,
            mock<ExternalPluginHostClient>(),
            propertyEncryptor,
            mock<EncryptionService>(),
            objectMapper,
            mock<ExternalPluginServiceTokenService>(),
            mock<ExternalPluginHostUsageResolver>(),
            "gzac.events",
            "http://localhost:8080",
        )
    }

    @Test
    fun `create rejects unknown granted capability name`() {
        stubDefinition(manifestJson = null)

        assertThatThrownBy { create(grantedCapabilities = listOf("filesystem")) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("Unknown capability 'filesystem'")
            .hasMessageContaining("gzac_api, http_request, kv, log")

        verify(configurationRepository, never()).save(any())
        verify(grantedCapabilityRepository, never()).save(any())
    }

    @Test
    fun `create rejects when a manifest-declared capability is not granted`() {
        stubDefinition(manifestJson = manifestWithCapabilities("gzac_api", "kv"))

        assertThatThrownBy { create(grantedCapabilities = listOf("gzac_api")) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("All capabilities declared in the plugin manifest must be granted")
            .hasMessageContaining("kv")

        verify(configurationRepository, never()).save(any())
    }

    @Test
    fun `create persists granted capabilities as typed values`() {
        stubDefinition(manifestJson = manifestWithCapabilities("http_request", "log"))

        val saved = create(grantedCapabilities = listOf("http_request", "log"))

        val captor = argumentCaptor<ExternalPluginGrantedCapability>()
        verify(grantedCapabilityRepository, times(2)).save(captor.capture())
        assertThat(captor.allValues).allSatisfy { assertThat(it.configurationId).isEqualTo(saved.id) }
        assertThat(captor.allValues.map { it.capability }).containsExactlyInAnyOrder(
            ExternalPluginCapability.HTTP_REQUEST,
            ExternalPluginCapability.LOG,
        )
    }

    private fun create(grantedCapabilities: List<String>): ExternalPluginConfiguration = service.create(
        definitionId = definitionId,
        title = "Test configuration",
        properties = objectMapper.createObjectNode(),
        grantedEndpoints = emptyList(),
        grantedEvents = emptyList(),
        grantedCapabilities = grantedCapabilities,
    )

    private fun stubDefinition(manifestJson: ObjectNode?) {
        val definition = ExternalPluginDefinition(
            id = definitionId,
            pluginId = "test-plugin",
            version = "1.0.0",
            hostId = UUID.randomUUID(),
            baseUrl = "https://plugin-host.example.com",
            status = ExternalPluginDefinitionStatus.AVAILABLE,
            manifestJson = manifestJson,
        )
        whenever(definitionRepository.findById(definitionId)).thenReturn(Optional.of(definition))
    }

    private fun manifestWithCapabilities(vararg capabilities: String): ObjectNode =
        objectMapper.createObjectNode().apply {
            putObject("permissions").putArray("capabilities").apply {
                capabilities.forEach { add(it) }
            }
        }
}
