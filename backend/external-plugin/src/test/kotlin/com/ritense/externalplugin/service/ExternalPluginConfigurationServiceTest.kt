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
import com.ritense.externalplugin.domain.ExternalPluginGrantedEndpoint
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedCapabilityRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEventRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.externalplugin.web.rest.dto.GrantedEndpointEntry
import com.ritense.externalplugin.web.rest.dto.GrantedEventEntry
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
    private lateinit var grantedEndpointRepository: ExternalPluginGrantedEndpointRepository
    private lateinit var grantedCapabilityRepository: ExternalPluginGrantedCapabilityRepository
    private lateinit var encryptionService: EncryptionService
    private lateinit var propertyEncryptor: PluginPropertyEncryptor
    private lateinit var service: ExternalPluginConfigurationService

    @BeforeEach
    fun setUp() {
        configurationRepository = mock()
        definitionRepository = mock()
        hostRepository = mock()
        grantedEndpointRepository = mock()
        grantedCapabilityRepository = mock()
        encryptionService = mock()
        propertyEncryptor = mock()
        whenever(configurationRepository.save(any<ExternalPluginConfiguration>())).thenAnswer { it.getArgument(0) }
        whenever(propertyEncryptor.encryptSecretFields(any(), anyOrNull())).thenAnswer { it.getArgument(0) }
        whenever(hostRepository.findById(any())).thenReturn(Optional.empty())
        service = ExternalPluginConfigurationService(
            configurationRepository,
            definitionRepository,
            hostRepository,
            grantedEndpointRepository,
            mock<ExternalPluginGrantedEventRepository>(),
            grantedCapabilityRepository,
            mock<ExternalPluginHostClient>(),
            propertyEncryptor,
            encryptionService,
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
            .hasMessageContaining("gzac_api, http_request, kv, log, frontend_data")

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

    @Test
    fun `create persists granted endpoints when they cover the manifest`() {
        stubDefinition(manifestJson = manifestWithEndpoints("GET" to "/api/v1/document/*"))

        val saved = service.create(
            definitionId = definitionId,
            title = "Covered",
            properties = objectMapper.createObjectNode(),
            grantedEndpoints = listOf(GrantedEndpointEntry("GET", "/api/v1/document/*")),
            grantedEvents = emptyList(),
        )

        val captor = argumentCaptor<ExternalPluginGrantedEndpoint>()
        verify(grantedEndpointRepository).save(captor.capture())
        assertThat(captor.firstValue.configurationId).isEqualTo(saved.id)
        assertThat(captor.firstValue.endpointPattern).isEqualTo("/api/v1/document/*")
    }

    @Test
    fun `create requires every manifest-declared endpoint to be granted`() {
        stubDefinition(
            manifestJson = manifestWithEndpoints(
                "GET" to "/api/v1/document/*",
                "POST" to "/api/v1/case/*",
            ),
        )

        assertThatThrownBy {
            service.create(
                definitionId = definitionId,
                title = "Partial",
                properties = objectMapper.createObjectNode(),
                grantedEndpoints = listOf(GrantedEndpointEntry("GET", "/api/v1/document/*")),
                grantedEvents = emptyList(),
            )
        }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("All endpoints declared in the plugin manifest must be granted")
            .hasMessageContaining("POST:/api/v1/case/*")

        verify(configurationRepository, never()).save(any())
        verify(grantedEndpointRepository, never()).save(any())
    }

    @Test
    fun `create rejects a granted endpoint the manifest does not declare`() {
        stubDefinition(manifestJson = manifestWithEndpoints("GET" to "/api/v1/document/*"))

        assertThatThrownBy {
            service.create(
                definitionId = definitionId,
                title = "Overreach",
                properties = objectMapper.createObjectNode(),
                grantedEndpoints = listOf(
                    GrantedEndpointEntry("GET", "/api/v1/document/*"),
                    GrantedEndpointEntry("DELETE", "/api/v1/case/*"),
                ),
                grantedEvents = emptyList(),
            )
        }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("Granted endpoints must be declared in the plugin manifest")
            .hasMessageContaining("DELETE:/api/v1/case/*")

        verify(configurationRepository, never()).save(any())
        verify(grantedEndpointRepository, never()).save(any())
    }

    @Test
    fun `create rejects a granted event subscription the manifest does not declare`() {
        stubDefinition(manifestJson = manifestWithEvents("case.created"))

        assertThatThrownBy {
            service.create(
                definitionId = definitionId,
                title = "Extra event",
                properties = objectMapper.createObjectNode(),
                grantedEndpoints = emptyList(),
                grantedEvents = listOf(GrantedEventEntry("case.created"), GrantedEventEntry("case.deleted")),
            )
        }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("Granted event subscriptions must be declared in the plugin manifest")
            .hasMessageContaining("case.deleted")

        verify(configurationRepository, never()).save(any())
    }

    @Test
    fun `create rejects a granted capability the manifest does not declare`() {
        stubDefinition(manifestJson = manifestWithCapabilities("gzac_api"))

        assertThatThrownBy { create(grantedCapabilities = listOf("gzac_api", "kv")) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("Granted capabilities must be declared in the plugin manifest")
            .hasMessageContaining("kv")

        verify(configurationRepository, never()).save(any())
        verify(grantedCapabilityRepository, never()).save(any())
    }

    @Test
    fun `update keeps the stored ciphertext when a secret property is omitted from the payload`() {
        val secretAwareService = serviceWithRealEncryptor()
        val configId = UUID.randomUUID()
        val storedProperties = objectMapper.createObjectNode()
            .put("url", "https://old.example.com")
            .put("apiKey", "stored-ciphertext")
        val config = ExternalPluginConfiguration(
            id = configId,
            definitionId = definitionId,
            title = "Config",
            properties = storedProperties,
        )
        whenever(configurationRepository.findById(configId)).thenReturn(Optional.of(config))
        stubDefinition(manifestJson = null, configSchema = secretSchema())
        whenever(encryptionService.decrypt("stored-ciphertext")).thenReturn("plain-secret")

        // The browser round-trips the masked GET response: the secret field is absent.
        val incoming = objectMapper.createObjectNode().put("url", "https://new.example.com")
        val saved = secretAwareService.update(configId, "Config", incoming)

        assertThat(saved.properties?.get("apiKey")?.asText()).isEqualTo("stored-ciphertext")
        assertThat(saved.properties?.get("url")?.asText()).isEqualTo("https://new.example.com")
        // The placeholder was never (re-)encrypted.
        verify(encryptionService, never()).encrypt(any())
    }

    @Test
    fun `update encrypts a newly supplied secret value`() {
        val secretAwareService = serviceWithRealEncryptor()
        val configId = UUID.randomUUID()
        val config = ExternalPluginConfiguration(
            id = configId,
            definitionId = definitionId,
            title = "Config",
            properties = objectMapper.createObjectNode().put("apiKey", "stored-ciphertext"),
        )
        whenever(configurationRepository.findById(configId)).thenReturn(Optional.of(config))
        stubDefinition(manifestJson = null, configSchema = secretSchema())
        whenever(encryptionService.encrypt("new-secret")).thenReturn("new-ciphertext")

        val incoming = objectMapper.createObjectNode().put("apiKey", "new-secret")
        val saved = secretAwareService.update(configId, "Config", incoming)

        assertThat(saved.properties?.get("apiKey")?.asText()).isEqualTo("new-ciphertext")
    }

    @Test
    fun `maskedProperties omits x-secret fields entirely`() {
        val secretAwareService = serviceWithRealEncryptor()
        stubDefinition(manifestJson = null, configSchema = secretSchema())
        val config = ExternalPluginConfiguration(
            id = UUID.randomUUID(),
            definitionId = definitionId,
            title = "Config",
            properties = objectMapper.createObjectNode()
                .put("url", "https://example.com")
                .put("apiKey", "stored-ciphertext"),
        )

        val masked = secretAwareService.maskedProperties(config)

        assertThat(masked.has("apiKey")).isFalse()
        assertThat(masked.get("url").asText()).isEqualTo("https://example.com")
        // Never decrypted for the read model.
        verify(encryptionService, never()).decrypt(any())
    }

    private fun serviceWithRealEncryptor(): ExternalPluginConfigurationService = ExternalPluginConfigurationService(
        configurationRepository,
        definitionRepository,
        hostRepository,
        grantedEndpointRepository,
        mock<ExternalPluginGrantedEventRepository>(),
        grantedCapabilityRepository,
        mock<ExternalPluginHostClient>(),
        PluginPropertyEncryptor(encryptionService),
        encryptionService,
        objectMapper,
        mock<ExternalPluginServiceTokenService>(),
        mock<ExternalPluginHostUsageResolver>(),
        "gzac.events",
        "http://localhost:8080",
    )

    private fun secretSchema(): ObjectNode = objectMapper.readTree(
        """
        {
          "type": "object",
          "properties": {
            "url": {"type": "string"},
            "apiKey": {"type": "string", "x-secret": true}
          }
        }
        """.trimIndent(),
    ) as ObjectNode

    private fun manifestWithEndpoints(vararg endpoints: Pair<String, String>): ObjectNode =
        objectMapper.createObjectNode().apply {
            putObject("permissions").putArray("endpoints").apply {
                endpoints.forEach { (method, pattern) ->
                    addObject().put("method", method).put("pattern", pattern)
                }
            }
        }

    private fun create(grantedCapabilities: List<String>): ExternalPluginConfiguration = service.create(
        definitionId = definitionId,
        title = "Test configuration",
        properties = objectMapper.createObjectNode(),
        grantedEndpoints = emptyList(),
        grantedEvents = emptyList(),
        grantedCapabilities = grantedCapabilities,
    )

    private fun stubDefinition(manifestJson: ObjectNode?, configSchema: ObjectNode? = null) {
        val definition = ExternalPluginDefinition(
            id = definitionId,
            pluginId = "test-plugin",
            version = "1.0.0",
            hostId = UUID.randomUUID(),
            baseUrl = "https://plugin-host.example.com",
            status = ExternalPluginDefinitionStatus.AVAILABLE,
            manifestJson = manifestJson,
            configSchema = configSchema,
        )
        whenever(definitionRepository.findById(definitionId)).thenReturn(Optional.of(definition))
    }

    private fun manifestWithCapabilities(vararg capabilities: String): ObjectNode =
        objectMapper.createObjectNode().apply {
            putObject("permissions").putArray("capabilities").apply {
                capabilities.forEach { add(it) }
            }
        }

    private fun manifestWithEvents(vararg eventTypes: String): ObjectNode =
        objectMapper.createObjectNode().apply {
            putArray("eventSubscriptions").apply {
                eventTypes.forEach { add(it) }
            }
        }
}
