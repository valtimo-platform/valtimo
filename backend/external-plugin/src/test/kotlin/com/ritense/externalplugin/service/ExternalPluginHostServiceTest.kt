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

import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.domain.EventQueueMode
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEventRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.plugin.service.EncryptionService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

/**
 * Guards the rule that the broker AMQP URL and credentials — carried in cleartext inside the
 * HMAC-signed configuration push body — are never associated with a host the push can only reach
 * over an unencrypted transport. Registration is the single enforcement point because the host base
 * URL cannot change afterwards.
 */
class ExternalPluginHostServiceTest {

    private lateinit var hostRepository: ExternalPluginHostRepository
    private lateinit var encryptionService: EncryptionService
    private lateinit var service: ExternalPluginHostService

    @BeforeEach
    fun setUp() {
        hostRepository = mock()
        encryptionService = mock()
        whenever(encryptionService.encrypt(any())).thenReturn("encrypted-secret")
        whenever(hostRepository.save(any<ExternalPluginHost>())).thenAnswer { it.getArgument(0) }
        service = ExternalPluginHostService(
            hostRepository,
            mock<ExternalPluginDefinitionRepository>(),
            mock<ExternalPluginConfigurationRepository>(),
            mock<ExternalPluginGrantedEndpointRepository>(),
            mock<ExternalPluginGrantedEventRepository>(),
            encryptionService,
            mock<ExternalPluginHostClient>(),
            mock<ExternalPluginHostUsageResolver>(),
        )
    }

    @Test
    fun `allows broker credentials over https`() {
        val host = service.register(
            name = "remote",
            baseUrl = "https://plugin-host.example.com",
            secret = "admin-token",
            gzacCallbackBaseUrl = "https://gzac.example.com",
            eventBrokerAmqpUrl = "amqp://guest:guest@broker:5672",
            eventBrokerExchange = null,
        )

        assertThat(host.baseUrl).isEqualTo("https://plugin-host.example.com")
        assertThat(host.eventBrokerAmqpUrl).isEqualTo("amqp://guest:guest@broker:5672")
    }

    @Test
    fun `allows broker credentials over loopback http for local development`() {
        listOf("http://localhost:8090", "http://127.0.0.1:8090").forEach { baseUrl ->
            val host = service.register(
                name = "local",
                baseUrl = baseUrl,
                secret = "admin-token",
                gzacCallbackBaseUrl = "http://localhost:8080",
                eventBrokerAmqpUrl = "amqp://guest:guest@localhost:5672",
                eventBrokerExchange = null,
            )

            assertThat(host.eventBrokerAmqpUrl).isEqualTo("amqp://guest:guest@localhost:5672")
        }
    }

    @Test
    fun `rejects broker credentials over plaintext http to a remote host`() {
        assertThatThrownBy {
            service.register(
                name = "remote",
                baseUrl = "http://plugin-host:8090",
                secret = "admin-token",
                gzacCallbackBaseUrl = "http://localhost:8080",
                eventBrokerAmqpUrl = "amqp://guest:guest@broker:5672",
                eventBrokerExchange = null,
            )
        }.isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("unencrypted transport")
    }

    @Test
    fun `allows a plaintext remote host when no broker is configured`() {
        val host = service.register(
            name = "actions-only",
            baseUrl = "http://plugin-host:8090",
            secret = "admin-token",
            gzacCallbackBaseUrl = "http://localhost:8080",
            eventBrokerAmqpUrl = null,
            eventBrokerExchange = null,
        )

        assertThat(host.baseUrl).isEqualTo("http://plugin-host:8090")
        assertThat(host.eventBrokerAmqpUrl).isNull()
    }

    @Test
    fun `treats a blank broker url as no broker`() {
        val host = service.register(
            name = "actions-only",
            baseUrl = "http://plugin-host:8090",
            secret = "admin-token",
            gzacCallbackBaseUrl = "http://localhost:8080",
            eventBrokerAmqpUrl = "   ",
            eventBrokerExchange = null,
        )

        assertThat(host.eventBrokerAmqpUrl).isNull()
    }

    @Test
    fun `classifies confidential transports`() {
        assertThat(ExternalPluginHostService.isSecureTransport("https://plugin-host:8090")).isTrue()
        assertThat(ExternalPluginHostService.isSecureTransport("HTTPS://plugin-host:8090")).isTrue()
        assertThat(ExternalPluginHostService.isSecureTransport("http://localhost:8090")).isTrue()
        assertThat(ExternalPluginHostService.isSecureTransport("http://127.0.0.1:8090")).isTrue()
        assertThat(ExternalPluginHostService.isSecureTransport("http://[::1]:8090")).isTrue()
    }

    @Test
    fun `classifies eavesdroppable transports`() {
        assertThat(ExternalPluginHostService.isSecureTransport("http://plugin-host:8090")).isFalse()
        assertThat(ExternalPluginHostService.isSecureTransport("http://10.0.0.5:8090")).isFalse()
        assertThat(ExternalPluginHostService.isSecureTransport("plugin-host:8090")).isFalse()
    }

    @Test
    fun `register defaults event queue mode to LIVE and TTL to null`() {
        val host = registerMinimal()

        assertThat(host.eventQueueMode).isEqualTo(EventQueueMode.LIVE)
        assertThat(host.eventQueueTtlMs).isNull()
    }

    @Test
    fun `register with DURABLE mode and no TTL applies the 72h default`() {
        val host = registerMinimal(mode = EventQueueMode.DURABLE, ttlMs = null)

        assertThat(host.eventQueueMode).isEqualTo(EventQueueMode.DURABLE)
        assertThat(host.eventQueueTtlMs).isEqualTo(ExternalPluginHostService.DEFAULT_EVENT_QUEUE_TTL_MS)
    }

    @Test
    fun `register with DURABLE mode honours an explicit TTL inside the allowed range`() {
        val host = registerMinimal(mode = EventQueueMode.DURABLE, ttlMs = 6L * 60 * 60 * 1000)

        assertThat(host.eventQueueTtlMs).isEqualTo(6L * 60 * 60 * 1000)
    }

    @Test
    fun `register with DURABLE mode rejects a TTL below 1 hour`() {
        assertThatThrownBy {
            registerMinimal(mode = EventQueueMode.DURABLE, ttlMs = 60_000)
        }.isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("eventQueueTtlMs must be between")
    }

    @Test
    fun `register with DURABLE mode rejects a TTL above 30 days`() {
        assertThatThrownBy {
            registerMinimal(mode = EventQueueMode.DURABLE, ttlMs = 31L * 24 * 60 * 60 * 1000)
        }.isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("eventQueueTtlMs must be between")
    }

    @Test
    fun `register with LIVE mode rejects a non-null TTL`() {
        assertThatThrownBy {
            registerMinimal(mode = EventQueueMode.LIVE, ttlMs = 60L * 60 * 1000)
        }.isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("must be null when eventQueueMode is LIVE")
    }

    @Test
    fun `updateEventQueue swaps mode from LIVE to DURABLE with the default TTL`() {
        val existing = registerMinimal()
        whenever(hostRepository.findById(existing.id)).thenReturn(Optional.of(existing))

        val updated = service.updateEventQueue(existing.id, EventQueueMode.DURABLE, null)

        assertThat(updated.eventQueueMode).isEqualTo(EventQueueMode.DURABLE)
        assertThat(updated.eventQueueTtlMs).isEqualTo(ExternalPluginHostService.DEFAULT_EVENT_QUEUE_TTL_MS)
    }

    @Test
    fun `updateEventQueue clears TTL when downgrading from DURABLE to LIVE`() {
        val existing = registerMinimal(mode = EventQueueMode.DURABLE, ttlMs = 6L * 60 * 60 * 1000)
        whenever(hostRepository.findById(existing.id)).thenReturn(Optional.of(existing))

        val updated = service.updateEventQueue(existing.id, EventQueueMode.LIVE, null)

        assertThat(updated.eventQueueMode).isEqualTo(EventQueueMode.LIVE)
        assertThat(updated.eventQueueTtlMs).isNull()
    }

    @Test
    fun `updateEventQueue with LIVE mode rejects a non-null TTL`() {
        val existing = registerMinimal()
        whenever(hostRepository.findById(existing.id)).thenReturn(Optional.of(existing))

        assertThatThrownBy {
            service.updateEventQueue(existing.id, EventQueueMode.LIVE, 60L * 60 * 1000)
        }.isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("must be null when eventQueueMode is LIVE")
    }

    @Test
    fun `updateEventQueue throws when the host does not exist`() {
        val missingId = UUID.randomUUID()
        whenever(hostRepository.findById(missingId)).thenReturn(Optional.empty())

        assertThatThrownBy {
            service.updateEventQueue(missingId, EventQueueMode.LIVE, null)
        }.isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("not found")
    }

    private fun registerMinimal(
        mode: EventQueueMode = EventQueueMode.LIVE,
        ttlMs: Long? = null,
    ): ExternalPluginHost = service.register(
        name = "local",
        baseUrl = "https://plugin-host.example.com",
        secret = "admin-token",
        gzacCallbackBaseUrl = "https://gzac.example.com",
        eventBrokerAmqpUrl = "amqp://guest:guest@broker:5672",
        eventBrokerExchange = null,
        eventQueueMode = mode,
        eventQueueTtlMs = ttlMs,
    )
}
