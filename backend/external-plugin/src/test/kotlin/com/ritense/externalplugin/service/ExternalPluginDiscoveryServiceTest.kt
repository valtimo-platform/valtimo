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
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.SimpleTransactionStatus
import org.springframework.transaction.support.TransactionTemplate
import java.util.Optional
import java.util.UUID

class ExternalPluginDiscoveryServiceTest {

    private val objectMapper = ObjectMapper()
    private val failureThreshold = 3

    private lateinit var hostRepository: ExternalPluginHostRepository
    private lateinit var definitionRepository: ExternalPluginDefinitionRepository
    private lateinit var configurationRepository: ExternalPluginConfigurationRepository
    private lateinit var configurationService: ExternalPluginConfigurationService
    private lateinit var hostService: ExternalPluginHostService
    private lateinit var hostClient: ExternalPluginHostClient
    private lateinit var service: ExternalPluginDiscoveryService

    @BeforeEach
    fun setUp() {
        hostRepository = mock()
        definitionRepository = mock()
        configurationRepository = mock()
        configurationService = mock()
        hostService = mock()
        hostClient = mock()
        val transactionManager = mock<PlatformTransactionManager>()
        whenever(transactionManager.getTransaction(anyOrNull())).thenReturn(SimpleTransactionStatus())
        service = ExternalPluginDiscoveryService(
            hostRepository,
            definitionRepository,
            configurationRepository,
            configurationService,
            hostService,
            hostClient,
            TransactionTemplate(transactionManager),
            failureThreshold,
        )
    }

    @Test
    fun `host flips to UNREACHABLE only after the configured number of consecutive failures`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED, consecutiveFailures = failureThreshold - 2)
        givenHost(host)
        whenever(hostClient.health(host.baseUrl)).thenReturn(false)

        service.discoverAll()

        assertThat(host.consecutiveFailures).isEqualTo(failureThreshold - 1)
        assertThat(host.status).isEqualTo(ExternalPluginHostStatus.CONNECTED)
        assertThat(host.lastHealthCheck).isNotNull()

        // One more failed cycle reaches the threshold and flips the status.
        service.discoverAll()

        assertThat(host.consecutiveFailures).isEqualTo(failureThreshold)
        assertThat(host.status).isEqualTo(ExternalPluginHostStatus.UNREACHABLE)
        // An unhealthy host is never asked for its plugin list.
        verify(hostClient, never()).listPlugins(any(), any())
    }

    @Test
    fun `healthy poll resets the failure counter and reconnects the host`() {
        val host = host(status = ExternalPluginHostStatus.UNREACHABLE, consecutiveFailures = failureThreshold)
        givenHost(host)
        whenever(hostClient.health(host.baseUrl)).thenReturn(true)
        whenever(hostService.decryptedSecret(host)).thenReturn("admin-token")
        whenever(hostClient.listPlugins(host.baseUrl, "admin-token")).thenReturn(emptyList())
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(emptyList())

        service.discoverAll()

        assertThat(host.consecutiveFailures).isEqualTo(0)
        assertThat(host.status).isEqualTo(ExternalPluginHostStatus.CONNECTED)
    }

    @Test
    fun `discovered manifest is upserted as a new definition`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        whenever(hostClient.health(host.baseUrl)).thenReturn(true)
        whenever(hostService.decryptedSecret(host)).thenReturn("admin-token")
        whenever(hostClient.listPlugins(host.baseUrl, "admin-token")).thenReturn(
            listOf(
                objectMapper.readTree(
                    """
                    {
                      "pluginId": "case-summary",
                      "version": "1.2.0",
                      "manifest": {
                        "pluginId": "case-summary",
                        "version": "1.2.0",
                        "provider": "Ritense",
                        "compatibility": {"minGzacVersion": "12.0.0"},
                        "translations": {"en": {"name": "Case summary", "description": "Summarises a case"}},
                        "configurationSchema": {"type": "object", "properties": {"apiKey": {"type": "string", "x-secret": true}}}
                      }
                    }
                    """.trimIndent(),
                ),
            ),
        )
        whenever(definitionRepository.findByPluginIdAndVersion("case-summary", "1.2.0")).thenReturn(null)
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(emptyList())

        service.discoverAll()

        val captor = argumentCaptor<ExternalPluginDefinition>()
        verify(definitionRepository).save(captor.capture())
        val saved = captor.firstValue
        assertThat(saved.pluginId).isEqualTo("case-summary")
        assertThat(saved.version).isEqualTo("1.2.0")
        assertThat(saved.hostId).isEqualTo(host.id)
        assertThat(saved.name).isEqualTo("Case summary")
        assertThat(saved.description).isEqualTo("Summarises a case")
        assertThat(saved.provider).isEqualTo("Ritense")
        assertThat(saved.minGzacVersion).isEqualTo("12.0.0")
        assertThat(saved.status).isEqualTo(ExternalPluginDefinitionStatus.AVAILABLE)
        assertThat(saved.configSchema?.path("properties")?.path("apiKey")?.path("x-secret")?.asBoolean()).isTrue()
        assertThat(saved.baseUrl).isEqualTo("${host.baseUrl}/plugins/case-summary")
    }

    @Test
    fun `existing configurations are re-pushed to a healthy host`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        val definition = definition(hostId = host.id)
        val configuration = ExternalPluginConfiguration(
            id = UUID.randomUUID(),
            definitionId = definition.id,
            title = "Primary",
        )
        whenever(hostClient.health(host.baseUrl)).thenReturn(true)
        whenever(hostService.decryptedSecret(host)).thenReturn("admin-token")
        whenever(hostClient.listPlugins(host.baseUrl, "admin-token")).thenReturn(emptyList())
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(listOf(configuration))
        whenever(configurationService.pushToHost(configuration, definition, host)).thenReturn(true)

        service.discoverAll()

        verify(configurationService).pushToHost(configuration, definition, host)
    }

    @Test
    fun `push failure of one configuration does not abort the discovery cycle`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        val definition = definition(hostId = host.id)
        val failing = ExternalPluginConfiguration(UUID.randomUUID(), definition.id, "Failing")
        val healthy = ExternalPluginConfiguration(UUID.randomUUID(), definition.id, "Healthy")
        whenever(hostClient.health(host.baseUrl)).thenReturn(true)
        whenever(hostService.decryptedSecret(host)).thenReturn("admin-token")
        whenever(hostClient.listPlugins(host.baseUrl, "admin-token")).thenReturn(emptyList())
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(listOf(failing, healthy))
        whenever(configurationService.pushToHost(failing, definition, host)).thenThrow(RuntimeException("boom"))
        whenever(configurationService.pushToHost(healthy, definition, host)).thenReturn(true)

        service.discoverAll()

        verify(configurationService).pushToHost(healthy, definition, host)
    }

    @Test
    fun `definition missing from the manifest list is marked UNAVAILABLE after the threshold`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        val definition = definition(hostId = host.id, consecutiveMisses = failureThreshold - 1)
        whenever(hostClient.health(host.baseUrl)).thenReturn(true)
        whenever(hostService.decryptedSecret(host)).thenReturn("admin-token")
        whenever(hostClient.listPlugins(host.baseUrl, "admin-token")).thenReturn(emptyList())
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(emptyList())

        service.discoverAll()

        assertThat(definition.consecutiveMisses).isEqualTo(failureThreshold)
        assertThat(definition.status).isEqualTo(ExternalPluginDefinitionStatus.UNAVAILABLE)
        verify(definitionRepository).save(definition)
    }

    private fun givenHost(host: ExternalPluginHost) {
        whenever(hostRepository.findAll()).thenReturn(listOf(host))
        whenever(hostRepository.findById(eq(host.id))).thenReturn(Optional.of(host))
    }

    private fun host(
        status: ExternalPluginHostStatus,
        consecutiveFailures: Int = 0,
    ): ExternalPluginHost = ExternalPluginHost(
        id = UUID.randomUUID(),
        name = "host",
        baseUrl = "https://plugin-host.example.com",
        secret = "encrypted-secret",
        status = status,
        consecutiveFailures = consecutiveFailures,
    )

    private fun definition(
        hostId: UUID,
        consecutiveMisses: Int = 0,
    ): ExternalPluginDefinition = ExternalPluginDefinition(
        id = UUID.randomUUID(),
        pluginId = "case-summary",
        version = "1.0.0",
        hostId = hostId,
        baseUrl = "https://plugin-host.example.com/plugins/case-summary",
        status = ExternalPluginDefinitionStatus.AVAILABLE,
        consecutiveMisses = consecutiveMisses,
    )
}
