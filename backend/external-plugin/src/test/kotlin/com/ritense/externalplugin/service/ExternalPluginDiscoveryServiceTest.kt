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
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.client.ExternalPluginHostClient.HostConfigurationSummary
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
    private val FALLBACK_GZAC_BASE_URL = "http://localhost:8080"

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
            FALLBACK_GZAC_BASE_URL,
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
    fun `healthy poll announces this GZAC instance and its frontend origins to the host`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        host.gzacCallbackBaseUrl = "http://gzac:8080"
        host.frontendOrigins = "https://valtimo.example.com"
        givenHost(host)
        whenever(hostClient.health(host.baseUrl)).thenReturn(true)
        whenever(hostService.decryptedSecret(host)).thenReturn("admin-token")
        whenever(hostClient.listPlugins(host.baseUrl, "admin-token")).thenReturn(emptyList())
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(emptyList())

        service.discoverAll()

        verify(hostClient).registerGzacInstance(
            host.baseUrl,
            "admin-token",
            "http://gzac:8080",
            listOf("https://valtimo.example.com"),
        )
    }

    @Test
    fun `a legacy host row without a callback url is announced under the same fallback key the config push uses`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        whenever(hostClient.health(host.baseUrl)).thenReturn(true)
        whenever(hostService.decryptedSecret(host)).thenReturn("admin-token")
        whenever(hostClient.listPlugins(host.baseUrl, "admin-token")).thenReturn(emptyList())
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(emptyList())

        service.discoverAll()

        verify(hostClient).registerGzacInstance(any(), any(), eq(FALLBACK_GZAC_BASE_URL), eq(emptyList()))
    }

    @Test
    fun `an unhealthy host is not announced to`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        whenever(hostClient.health(host.baseUrl)).thenReturn(false)

        service.discoverAll()

        verify(hostClient, never()).registerGzacInstance(any(), any(), any(), any())
    }

    @Test
    fun `a failed announcement does not stop the rest of the discovery cycle`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        whenever(hostClient.health(host.baseUrl)).thenReturn(true)
        whenever(hostService.decryptedSecret(host)).thenReturn("admin-token")
        whenever(hostClient.registerGzacInstance(any(), any(), any(), any()))
            .thenThrow(RuntimeException("host unreachable"))
        whenever(hostClient.listPlugins(host.baseUrl, "admin-token")).thenReturn(emptyList())
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(emptyList())

        service.discoverAll()

        verify(hostClient).listPlugins(host.baseUrl, "admin-token")
        assertThat(host.status).isEqualTo(ExternalPluginHostStatus.CONNECTED)
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
    fun `a plugin already registered under another host is skipped and reported as a conflict`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        val otherHostId = UUID.randomUUID()
        givenHost(host)
        givenPluginListing(host, pluginEntry(contentHash = "sha256:aaa"))
        whenever(definitionRepository.findByPluginIdAndVersion("case-summary", "1.0.0"))
            .thenReturn(definition(hostId = otherHostId))
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(emptyList())

        val result = service.discoverHost(host.id)

        assertThat(result).isNotNull()
        assertThat(result!!.reachable).isTrue()
        assertThat(result.registeredDefinitionIds).isEmpty()
        assertThat(result.conflicts)
            .containsExactly(PluginRegistrationConflict("case-summary", "1.0.0", otherHostId))
        // The other host's definition must not be touched, let alone re-homed.
        verify(definitionRepository, never()).save(any())
    }

    @Test
    fun `discoverHost reports the registered definition so registration can tell success from conflict`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        givenPluginListing(host, pluginEntry(contentHash = "sha256:aaa"))
        whenever(definitionRepository.findByPluginIdAndVersion("case-summary", "1.0.0")).thenReturn(null)
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(emptyList())

        val result = service.discoverHost(host.id)

        assertThat(result).isNotNull()
        assertThat(result!!.reachable).isTrue()
        assertThat(result.registeredDefinitionIds).hasSize(1)
        assertThat(result.conflicts).isEmpty()
    }

    @Test
    fun `discoverHost reports an unreachable host without listing plugins`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        whenever(hostClient.health(host.baseUrl)).thenReturn(false)

        val result = service.discoverHost(host.id)

        assertThat(result).isNotNull()
        assertThat(result!!.reachable).isFalse()
        assertThat(result.registeredDefinitionIds).isEmpty()
        assertThat(result.conflicts).isEmpty()
        verify(hostClient, never()).listPlugins(any(), any())
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

    @Test
    fun `pins the package content hash on first discovery`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        givenPluginListing(host, pluginEntry(contentHash = "sha256:aaa"))
        whenever(definitionRepository.findByPluginIdAndVersion("case-summary", "1.0.0")).thenReturn(null)
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(emptyList())

        service.discoverAll()

        val captor = argumentCaptor<ExternalPluginDefinition>()
        verify(definitionRepository).save(captor.capture())
        assertThat(captor.firstValue.contentHash).isEqualTo("sha256:aaa")
        assertThat(captor.firstValue.pendingContentHash).isNull()
    }

    @Test
    fun `backfills the content hash for a definition discovered before hashing existed`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        val definition = definition(hostId = host.id, contentHash = null)
        givenPluginListing(host, pluginEntry(contentHash = "sha256:aaa"))
        whenever(definitionRepository.findByPluginIdAndVersion("case-summary", "1.0.0")).thenReturn(definition)
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(emptyList())

        service.discoverAll()

        assertThat(definition.contentHash).isEqualTo("sha256:aaa")
        assertThat(definition.pendingContentHash).isNull()
    }

    @Test
    fun `flags a changed package for re-acceptance and freezes the accepted manifest data`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        val definition = definition(hostId = host.id, contentHash = "sha256:aaa").apply { name = "Accepted name" }
        givenPluginListing(host, pluginEntry(contentHash = "sha256:bbb", name = "Tampered name"))
        whenever(definitionRepository.findByPluginIdAndVersion("case-summary", "1.0.0")).thenReturn(definition)
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(emptyList())

        service.discoverAll()

        assertThat(definition.contentHash).isEqualTo("sha256:aaa")
        assertThat(definition.pendingContentHash).isEqualTo("sha256:bbb")
        // The stored manifest data reflects what the admin accepted, not the changed package.
        assertThat(definition.name).isEqualTo("Accepted name")
        assertThat(definition.status).isEqualTo(ExternalPluginDefinitionStatus.AVAILABLE)
    }

    @Test
    fun `withholds configuration pushes for a definition awaiting re-acceptance`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        val definition = definition(hostId = host.id, contentHash = "sha256:aaa", pendingContentHash = "sha256:bbb")
        val configuration = ExternalPluginConfiguration(UUID.randomUUID(), definition.id, "Primary")
        givenPluginListing(host, pluginEntry(contentHash = "sha256:bbb"))
        whenever(definitionRepository.findByPluginIdAndVersion("case-summary", "1.0.0")).thenReturn(definition)
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(listOf(configuration))

        service.discoverAll()

        verify(configurationService, never()).pushToHost(any(), any(), any())
    }

    @Test
    fun `clears the re-acceptance flag when the host serves the pinned content again`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        val definition = definition(hostId = host.id, contentHash = "sha256:aaa", pendingContentHash = "sha256:bbb")
        givenPluginListing(host, pluginEntry(contentHash = "sha256:aaa"))
        whenever(definitionRepository.findByPluginIdAndVersion("case-summary", "1.0.0")).thenReturn(definition)
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(emptyList())

        service.discoverAll()

        assertThat(definition.contentHash).isEqualTo("sha256:aaa")
        assertThat(definition.pendingContentHash).isNull()
    }

    @Test
    fun `reconciliation deletes host configs this GZAC owns but no longer has — and nothing else`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        val definition = definition(hostId = host.id)
        val live = ExternalPluginConfiguration(UUID.randomUUID(), definition.id, "Live")
        whenever(hostClient.health(host.baseUrl)).thenReturn(true)
        whenever(hostService.decryptedSecret(host)).thenReturn("admin-token")
        whenever(hostClient.listPlugins(host.baseUrl, "admin-token")).thenReturn(emptyList())
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(listOf(live))
        whenever(configurationService.pushToHost(live, definition, host)).thenReturn(true)

        val orphanId = UUID.randomUUID().toString()
        whenever(hostClient.listConfigurations(host.baseUrl, "admin-token")).thenReturn(
            listOf(
                // Owned and still present locally → kept.
                HostConfigurationSummary(live.id.toString(), host.id.toString()),
                // Owned but no longer in GZAC → the orphan this pass exists for.
                HostConfigurationSummary(orphanId, host.id.toString()),
                // Owned by another GZAC sharing the host → never touched.
                HostConfigurationSummary("foreign-cfg", UUID.randomUUID().toString()),
                // Unowned (pre-ownership pusher) → never touched.
                HostConfigurationSummary("unowned-cfg", null),
            ),
        )
        whenever(hostClient.deleteConfiguration(host.baseUrl, "admin-token", orphanId)).thenReturn(true)

        service.discoverAll()

        verify(hostClient).deleteConfiguration(host.baseUrl, "admin-token", orphanId)
        verify(hostClient, never()).deleteConfiguration(any(), any(), eq(live.id.toString()))
        verify(hostClient, never()).deleteConfiguration(any(), any(), eq("foreign-cfg"))
        verify(hostClient, never()).deleteConfiguration(any(), any(), eq("unowned-cfg"))
        // Reconciliation never gets in the way of the re-push or the CONNECTED flip.
        verify(configurationService).pushToHost(live, definition, host)
        assertThat(host.status).isEqualTo(ExternalPluginHostStatus.CONNECTED)
    }

    @Test
    fun `reconciliation is skipped entirely for a host that predates the configuration listing`() {
        val host = host(status = ExternalPluginHostStatus.UNREACHABLE, consecutiveFailures = failureThreshold)
        givenHost(host)
        whenever(hostClient.health(host.baseUrl)).thenReturn(true)
        whenever(hostService.decryptedSecret(host)).thenReturn("admin-token")
        whenever(hostClient.listPlugins(host.baseUrl, "admin-token")).thenReturn(emptyList())
        // null = the host answered 404/405 — an older host or a minimal app.
        whenever(hostClient.listConfigurations(host.baseUrl, "admin-token")).thenReturn(null)
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(emptyList())

        service.discoverAll()

        verify(hostClient, never()).deleteConfiguration(any(), any(), any())
        // The rest of the poll (and the CONNECTED flip) proceeds as if reconciliation didn't exist.
        assertThat(host.status).isEqualTo(ExternalPluginHostStatus.CONNECTED)
        assertThat(host.consecutiveFailures).isEqualTo(0)
    }

    @Test
    fun `a failed configuration listing fails the poll — no deletes, no pushes, failure counted`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        val definition = definition(hostId = host.id)
        whenever(hostClient.health(host.baseUrl)).thenReturn(true)
        whenever(hostService.decryptedSecret(host)).thenReturn("admin-token")
        whenever(hostClient.listPlugins(host.baseUrl, "admin-token")).thenReturn(emptyList())
        whenever(hostClient.listConfigurations(host.baseUrl, "admin-token"))
            .thenThrow(IllegalStateException("malformed configuration listing"))
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(listOf(definition))

        service.discoverAll()

        // Deleting on a half-parsed listing could nuke live configs — nothing may proceed.
        verify(hostClient, never()).deleteConfiguration(any(), any(), any())
        verify(configurationService, never()).pushToHost(any(), any(), any())
        assertThat(host.consecutiveFailures).isEqualTo(1)
        // Below the threshold the previous status is kept; the counter does the flipping.
        assertThat(host.status).isEqualTo(ExternalPluginHostStatus.CONNECTED)
    }

    @Test
    fun `a host that answers health but rejects the admin token flips to UNREACHABLE, not CONNECTED`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED, consecutiveFailures = failureThreshold - 1)
        givenHost(host)
        whenever(hostClient.health(host.baseUrl)).thenReturn(true)
        whenever(hostService.decryptedSecret(host)).thenReturn("admin-token")
        whenever(hostClient.listPlugins(host.baseUrl, "admin-token"))
            .thenThrow(RuntimeException("401 Unauthorized"))

        service.discoverAll()

        // Before this change the bare /health 200 flipped the host CONNECTED and the listPlugins
        // failure was swallowed — a host with a wrong admin token advertised as usable forever.
        assertThat(host.consecutiveFailures).isEqualTo(failureThreshold)
        assertThat(host.status).isEqualTo(ExternalPluginHostStatus.UNREACHABLE)
    }

    @Test
    fun `one failed orphan delete does not abort the rest of the cycle`() {
        val host = host(status = ExternalPluginHostStatus.CONNECTED)
        givenHost(host)
        val definition = definition(hostId = host.id)
        val live = ExternalPluginConfiguration(UUID.randomUUID(), definition.id, "Live")
        whenever(hostClient.health(host.baseUrl)).thenReturn(true)
        whenever(hostService.decryptedSecret(host)).thenReturn("admin-token")
        whenever(hostClient.listPlugins(host.baseUrl, "admin-token")).thenReturn(emptyList())
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(listOf(live))
        whenever(configurationService.pushToHost(live, definition, host)).thenReturn(true)

        val failingOrphan = UUID.randomUUID().toString()
        val healthyOrphan = UUID.randomUUID().toString()
        whenever(hostClient.listConfigurations(host.baseUrl, "admin-token")).thenReturn(
            listOf(
                HostConfigurationSummary(failingOrphan, host.id.toString()),
                HostConfigurationSummary(healthyOrphan, host.id.toString()),
            ),
        )
        whenever(hostClient.deleteConfiguration(host.baseUrl, "admin-token", failingOrphan)).thenReturn(false)
        whenever(hostClient.deleteConfiguration(host.baseUrl, "admin-token", healthyOrphan)).thenReturn(true)

        service.discoverAll()

        // The failed delete is retried on the next cycle; everything else this cycle still happens.
        verify(hostClient).deleteConfiguration(host.baseUrl, "admin-token", healthyOrphan)
        verify(configurationService).pushToHost(live, definition, host)
        assertThat(host.status).isEqualTo(ExternalPluginHostStatus.CONNECTED)
    }

    private fun givenPluginListing(host: ExternalPluginHost, vararg entries: JsonNode) {
        whenever(hostClient.health(host.baseUrl)).thenReturn(true)
        whenever(hostService.decryptedSecret(host)).thenReturn("admin-token")
        whenever(hostClient.listPlugins(host.baseUrl, "admin-token")).thenReturn(entries.toList())
    }

    private fun pluginEntry(contentHash: String, name: String = "Case summary") = objectMapper.readTree(
        """
        {
          "pluginId": "case-summary",
          "version": "1.0.0",
          "contentHash": "$contentHash",
          "manifest": {
            "pluginId": "case-summary",
            "version": "1.0.0",
            "translations": {"en": {"name": "$name", "description": "Summarises a case"}}
          }
        }
        """.trimIndent(),
    )

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
        contentHash: String? = null,
        pendingContentHash: String? = null,
    ): ExternalPluginDefinition = ExternalPluginDefinition(
        id = UUID.randomUUID(),
        pluginId = "case-summary",
        version = "1.0.0",
        hostId = hostId,
        baseUrl = "https://plugin-host.example.com/plugins/case-summary",
        status = ExternalPluginDefinitionStatus.AVAILABLE,
        consecutiveMisses = consecutiveMisses,
        contentHash = contentHash,
        pendingContentHash = pendingContentHash,
    )
}
