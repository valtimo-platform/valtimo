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
import com.ritense.externalplugin.exception.ExternalPluginHostValidationException
import com.ritense.externalplugin.exception.ExternalPluginNotFoundException
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostKind
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
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
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

/**
 * Guards the rule that broker credentials — cleartext inside the HMAC-signed push body — never end
 * up on a host reachable only over an unencrypted transport. Enforced on every resulting state,
 * registration and repoint alike; the `update` block below is what holds it there.
 */
class ExternalPluginHostServiceTest {

    private lateinit var hostRepository: ExternalPluginHostRepository
    private lateinit var definitionRepository: ExternalPluginDefinitionRepository
    private lateinit var configurationRepository: ExternalPluginConfigurationRepository
    private lateinit var hostClient: ExternalPluginHostClient
    private lateinit var encryptionService: EncryptionService
    private lateinit var service: ExternalPluginHostService

    @BeforeEach
    fun setUp() {
        hostRepository = mock()
        definitionRepository = mock()
        configurationRepository = mock()
        hostClient = mock()
        encryptionService = mock()
        whenever(encryptionService.encrypt(any())).thenReturn("encrypted-secret")
        whenever(encryptionService.decrypt("encrypted-secret")).thenReturn("admin-token")
        whenever(hostRepository.save(any<ExternalPluginHost>())).thenAnswer { it.getArgument(0) }
        whenever(configurationRepository.save(any<ExternalPluginConfiguration>()))
            .thenAnswer { it.getArgument(0) }
        service = ExternalPluginHostService(
            hostRepository,
            definitionRepository,
            configurationRepository,
            mock<ExternalPluginGrantedEndpointRepository>(),
            mock<ExternalPluginGrantedEventRepository>(),
            mock(),
            mock(),
            encryptionService,
            hostClient,
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
        }
            // Not IllegalArgumentException: the mapper turns this type into a 400 whose detail is
            // this message, which is what the add-host modal renders.
            .isInstanceOf(ExternalPluginHostValidationException::class.java)
            .hasMessageContaining("unencrypted transport")
    }

    @Test
    fun `rejects a bind address as base URL and names the field in the message`() {
        listOf("http://0.0.0.0:8090", "http://[::]:8090", "https://0.0.0.0").forEach { baseUrl ->
            assertThatThrownBy {
                service.register(
                    name = "bound-everywhere",
                    baseUrl = baseUrl,
                    secret = "admin-token",
                    gzacCallbackBaseUrl = "http://localhost:8080",
                    eventBrokerAmqpUrl = null,
                    eventBrokerExchange = null,
                )
            }.isInstanceOf(ExternalPluginHostValidationException::class.java)
                .hasMessageContaining("base URL")
                .hasMessageContaining("bind address")
        }
    }

    @Test
    fun `accepts a host name java net URI cannot parse rather than guessing it is unreachable`() {
        // Docker service names may contain underscores, which URI.getHost() rejects. Only genuine
        // bind addresses are refused here.
        val host = service.register(
            name = "docker",
            baseUrl = "http://plugin_host:8090",
            secret = "admin-token",
            gzacCallbackBaseUrl = "http://localhost:8080",
            eventBrokerAmqpUrl = null,
            eventBrokerExchange = null,
        )

        assertThat(host.baseUrl).isEqualTo("http://plugin_host:8090")
    }

    @Test
    fun `classifies connectable base urls`() {
        assertThat(ExternalPluginHostService.isConnectableBaseUrl("http://0.0.0.0:8090")).isFalse()
        assertThat(ExternalPluginHostService.isConnectableBaseUrl("http://[::]:8090")).isFalse()
        assertThat(ExternalPluginHostService.isConnectableBaseUrl("http://localhost:8090")).isTrue()
        assertThat(ExternalPluginHostService.isConnectableBaseUrl("https://plugin-host.example.com")).isTrue()
    }

    // ---------------------------------------------------------------- frontend origins

    @Test
    fun `register stores normalized frontend origins`() {
        val host = service.register(
            name = "local",
            baseUrl = "https://plugin-host.example.com",
            secret = "admin-token",
            gzacCallbackBaseUrl = "https://gzac.example.com",
            eventBrokerAmqpUrl = null,
            eventBrokerExchange = null,
            frontendOrigins = listOf("https://Valtimo.Example.com/", "  ", "http://localhost:4200"),
        )

        assertThat(host.frontendOrigins).isEqualTo("https://valtimo.example.com,http://localhost:4200")
        assertThat(host.frontendOriginList)
            .containsExactly("https://valtimo.example.com", "http://localhost:4200")
    }

    @Test
    fun `register leaves frontend origins null when none are supplied`() {
        val host = registerMinimal()

        assertThat(host.frontendOrigins).isNull()
        assertThat(host.frontendOriginList).isEmpty()
    }

    @Test
    fun `updateFrontendOrigins replaces the stored list`() {
        val existing = registerMinimal()
        whenever(hostRepository.findById(existing.id)).thenReturn(Optional.of(existing))

        val updated = service.updateFrontendOrigins(
            existing.id,
            listOf("https://valtimo.example.com", "https://valtimo.example.com/"),
        )

        // The duplicate — same origin, trailing slash — collapses.
        assertThat(updated.frontendOriginList).containsExactly("https://valtimo.example.com")
    }

    @Test
    fun `updateFrontendOrigins with an empty list clears the allowlist so nothing may frame the host`() {
        val existing = registerMinimal()
        existing.frontendOrigins = "https://valtimo.example.com"
        whenever(hostRepository.findById(existing.id)).thenReturn(Optional.of(existing))

        val updated = service.updateFrontendOrigins(existing.id, emptyList())

        assertThat(updated.frontendOrigins).isNull()
        assertThat(updated.frontendOriginList).isEmpty()
    }

    @Test
    fun `normalizeFrontendOrigin canonicalises scheme, host case and trailing slash`() {
        assertThat(ExternalPluginHostService.normalizeFrontendOrigin("HTTPS://Valtimo.Example.com/"))
            .isEqualTo("https://valtimo.example.com")
        assertThat(ExternalPluginHostService.normalizeFrontendOrigin(" http://localhost:4200 "))
            .isEqualTo("http://localhost:4200")
        assertThat(ExternalPluginHostService.normalizeFrontendOrigin("http://[::1]:4200"))
            .isEqualTo("http://[::1]:4200")
    }

    @Test
    fun `normalizeFrontendOrigin rejects wildcards, paths, non-http schemes and credentials`() {
        listOf(
            "*",
            "https://*.example.com",
            "https://valtimo.example.com/app",
            "https://valtimo.example.com?q=1",
            "ftp://valtimo.example.com",
            "valtimo.example.com",
            "https://user:pw@valtimo.example.com",
        ).forEach { value ->
            assertThatThrownBy { ExternalPluginHostService.normalizeFrontendOrigin(value) }
                .describedAs("origin '%s'", value)
                .isInstanceOf(ExternalPluginHostValidationException::class.java)
                .hasMessageContaining("not a valid frontend origin")
        }
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
    fun `register defaults kind to PLUGIN_HOST`() {
        assertThat(registerMinimal().kind).isEqualTo(ExternalPluginHostKind.PLUGIN_HOST)
    }

    @Test
    fun `register persists the APP kind`() {
        val host = service.register(
            name = "demo-app",
            baseUrl = "https://demo-app.example.com",
            secret = "admin-token",
            gzacCallbackBaseUrl = "https://gzac.example.com",
            eventBrokerAmqpUrl = null,
            eventBrokerExchange = null,
            kind = ExternalPluginHostKind.APP,
        )

        assertThat(host.kind).isEqualTo(ExternalPluginHostKind.APP)
    }

    @Test
    fun `uploadPlugin rejects an app host`() {
        val app = service.register(
            name = "demo-app",
            baseUrl = "https://demo-app.example.com",
            secret = "admin-token",
            gzacCallbackBaseUrl = "https://gzac.example.com",
            eventBrokerAmqpUrl = null,
            eventBrokerExchange = null,
            kind = ExternalPluginHostKind.APP,
        )
        whenever(hostRepository.findById(app.id)).thenReturn(Optional.of(app))

        assertThatThrownBy {
            service.uploadPlugin(app.id, "plugin.zip", ByteArray(0))
        }.isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("does not accept plugin uploads")
    }

    @Test
    fun `register persists a caller-supplied id`() {
        val id = UUID.fromString("11111111-2222-3333-4444-555555555555")

        val host = service.register(
            name = "local",
            baseUrl = "http://localhost:8090",
            secret = "admin-token",
            gzacCallbackBaseUrl = "http://localhost:8080",
            eventBrokerAmqpUrl = null,
            eventBrokerExchange = null,
            id = id,
        )

        assertThat(host.id).isEqualTo(id)
    }

    @Test
    fun `register without an explicit id still generates one`() {
        val first = registerMinimal()
        val second = registerMinimal()

        assertThat(first.id).isNotNull()
        assertThat(first.id).isNotEqualTo(second.id)
    }

    @Test
    fun `findById returns null instead of throwing for an unknown host`() {
        val missingId = UUID.randomUUID()
        whenever(hostRepository.findById(missingId)).thenReturn(Optional.empty())

        assertThat(service.findById(missingId)).isNull()
    }

    @Test
    fun `findByBaseUrl normalises the trailing slash before looking up`() {
        val existing = registerMinimal()
        whenever(hostRepository.findByBaseUrl("http://localhost:8090")).thenReturn(existing)

        assertThat(service.findByBaseUrl("http://localhost:8090/")).isSameAs(existing)
        assertThat(service.findByBaseUrl("http://localhost:8090")).isSameAs(existing)
    }

    @Test
    fun `findByBaseUrl returns null when no host is registered at that address`() {
        whenever(hostRepository.findByBaseUrl(any())).thenReturn(null)

        assertThat(service.findByBaseUrl("http://localhost:9999")).isNull()
    }

    @Test
    fun `updateEventQueue throws when the host does not exist`() {
        val missingId = UUID.randomUUID()
        whenever(hostRepository.findById(missingId)).thenReturn(Optional.empty())

        assertThatThrownBy {
            service.updateEventQueue(missingId, EventQueueMode.LIVE, null)
        }.isInstanceOf(ExternalPluginNotFoundException::class.java)
            .hasMessageContaining("not found")
    }

    // ---------------------------------------------------------------- update / repoint

    @Test
    fun `update rejects downgrading to plaintext while broker credentials are set`() {
        val host = storedHost()

        assertThatThrownBy { updateHost(host, baseUrl = "http://plugin-host:8090") }
            .isInstanceOf(ExternalPluginHostValidationException::class.java)
            .hasMessageContaining("unencrypted transport")
    }

    @Test
    fun `update allows downgrading to plaintext when the broker is cleared in the same call`() {
        val host = storedHost()

        val result = updateHost(host, baseUrl = "http://plugin-host:8090", brokerUrl = null)

        assertThat(result.host.baseUrl).isEqualTo("http://plugin-host:8090")
        assertThat(result.host.eventBrokerAmqpUrl).isNull()
    }

    @Test
    fun `update allows adding broker credentials once the host moved to https`() {
        val host = storedHost(baseUrl = "http://plugin-host:8090", brokerUrl = null)

        val result = updateHost(
            host,
            baseUrl = "https://plugin-host.example.com",
            brokerUrl = "amqp://guest:guest@broker:5672",
        )

        assertThat(result.host.eventBrokerAmqpUrl).isEqualTo("amqp://guest:guest@broker:5672")
    }

    @Test
    fun `update with a blank secret keeps the stored ciphertext`() {
        val host = storedHost()

        listOf(null, "", "   ").forEach { secret ->
            val result = updateHost(host, secret = secret)

            assertThat(result.host.secret).isEqualTo("encrypted-secret")
            assertThat(result.credentialsChanged).isFalse()
        }
        verify(encryptionService, never()).encrypt(any())
    }

    @Test
    fun `update with a secret that matches the stored one does not re-encrypt or revoke`() {
        val host = storedHost()
        val configuration = configurationUnder(host)

        val result = updateHost(host, secret = "admin-token")

        verify(encryptionService, never()).encrypt(any())
        assertThat(result.credentialsChanged).isFalse()
        assertThat(configuration.tokenGeneration).isZero()
    }

    @Test
    fun `update with a new secret re-encrypts and replaces the stored value`() {
        val host = storedHost()
        whenever(encryptionService.encrypt("rotated-token")).thenReturn("encrypted-rotated-token")

        val result = updateHost(host, secret = "rotated-token")

        assertThat(result.host.secret).isEqualTo("encrypted-rotated-token")
        assertThat(result.credentialsChanged).isTrue()
        assertThat(result.addressChanged).isFalse()
    }

    @Test
    fun `update round-trips the redacted stored broker url back to the stored credentials`() {
        val host = storedHost(brokerUrl = "amqp://guest:secret@broker:5672")

        val result = updateHost(host, brokerUrl = "amqp://***@broker:5672")

        assertThat(result.host.eventBrokerAmqpUrl).isEqualTo("amqp://guest:secret@broker:5672")
        assertThat(result.credentialsChanged).isFalse()
    }

    @Test
    fun `update rejects a broker url still carrying the redaction marker`() {
        val host = storedHost(brokerUrl = "amqp://guest:secret@broker:5672")

        // Redacted, but a different broker than the stored one — nothing can resolve it.
        assertThatThrownBy { updateHost(host, brokerUrl = "amqp://***@other-broker:5672") }
            .isInstanceOf(ExternalPluginHostValidationException::class.java)
            .hasMessageContaining("redacted placeholder")
    }

    @Test
    fun `update rejects a base url already registered by another host`() {
        val host = storedHost()
        val other = storedHost(baseUrl = "https://other-host.example.com")
        whenever(hostRepository.findByBaseUrl("https://other-host.example.com")).thenReturn(other)

        assertThatThrownBy { updateHost(host, baseUrl = "https://other-host.example.com") }
            .isInstanceOf(ExternalPluginHostValidationException::class.java)
            .hasMessageContaining("already registered")
    }

    @Test
    fun `update accepts the host's own current base url`() {
        val host = storedHost()
        whenever(hostRepository.findByBaseUrl(host.baseUrl)).thenReturn(host)

        val result = updateHost(host, name = "renamed")

        assertThat(result.host.name).isEqualTo("renamed")
        assertThat(result.addressChanged).isFalse()
    }

    @Test
    fun `update keeps the event queue TTL bounds`() {
        val host = storedHost()

        assertThatThrownBy { updateHost(host, mode = EventQueueMode.LIVE, ttlMs = 60L * 60 * 1000) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("must be null when eventQueueMode is LIVE")

        assertThatThrownBy { updateHost(host, mode = EventQueueMode.DURABLE, ttlMs = 60_000) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("eventQueueTtlMs must be between")
    }

    @Test
    fun `update throws when the host does not exist`() {
        val missingId = UUID.randomUUID()
        whenever(hostRepository.findById(missingId)).thenReturn(Optional.empty())

        assertThatThrownBy {
            service.update(
                missingId,
                "local",
                "https://plugin-host.example.com",
                null,
                "https://gzac.example.com",
                null,
                null,
                EventQueueMode.LIVE,
                null,
                emptyList(),
            )
        }.isInstanceOf(ExternalPluginNotFoundException::class.java)
            .hasMessageContaining("not found")
    }

    @Test
    fun `update reports an address change and applies the rest of the connection surface`() {
        val host = storedHost()

        val result = updateHost(
            host,
            name = "moved",
            baseUrl = "https://new-host.example.com/",
            gzacCallbackBaseUrl = "https://gzac.example.com/",
            brokerExchange = "other-exchange",
            frontendOrigins = listOf("https://Valtimo.Example.com/"),
        )

        assertThat(result.addressChanged).isTrue()
        assertThat(result.credentialsChanged).isFalse()
        assertThat(result.host.name).isEqualTo("moved")
        // Trailing slashes normalised away, or findByBaseUrl stops matching.
        assertThat(result.host.baseUrl).isEqualTo("https://new-host.example.com")
        assertThat(result.host.gzacCallbackBaseUrl).isEqualTo("https://gzac.example.com")
        assertThat(result.host.eventBrokerExchange).isEqualTo("other-exchange")
        assertThat(result.host.frontendOriginList).containsExactly("https://valtimo.example.com")
    }

    @Test
    fun `update reports a credentials change when only the broker url moves`() {
        val host = storedHost()

        val result = updateHost(host, brokerUrl = "amqp://guest:guest@new-broker:5672")

        assertThat(result.credentialsChanged).isTrue()
        assertThat(result.addressChanged).isFalse()
    }

    // ------------------------------------------------- repoint side effects: tokens and purge

    @Test
    fun `update revokes every token under the host when the address changes`() {
        val host = storedHost()
        val first = configurationUnder(host)
        val second = configurationUnder(host, generation = 4)

        updateHost(host, baseUrl = "https://new-host.example.com")

        assertThat(first.tokenGeneration).isEqualTo(1)
        assertThat(second.tokenGeneration).isEqualTo(5)
    }

    @Test
    fun `update revokes every token under the host when only the secret rotates`() {
        val host = storedHost()
        val configuration = configurationUnder(host)

        updateHost(host, secret = "rotated-token")

        assertThat(configuration.tokenGeneration).isEqualTo(1)
    }

    @Test
    fun `update revokes every token under the host when only the broker url changes`() {
        val host = storedHost()
        val configuration = configurationUnder(host)

        updateHost(host, brokerUrl = "amqp://guest:guest@new-broker:5672")

        assertThat(configuration.tokenGeneration).isEqualTo(1)
    }

    @Test
    fun `update leaves tokens alone for a cosmetic edit`() {
        val host = storedHost()
        val configuration = configurationUnder(host)

        updateHost(
            host,
            name = "renamed",
            mode = EventQueueMode.DURABLE,
            ttlMs = null,
            frontendOrigins = listOf("https://valtimo.example.com"),
        )

        assertThat(configuration.tokenGeneration).isZero()
        verify(configurationRepository, never()).save(any<ExternalPluginConfiguration>())
    }

    @Test
    fun `update purges the configurations from the previous address with the previous secret`() {
        val host = storedHost()
        val first = configurationUnder(host)
        val second = configurationUnder(host)

        updateHost(host, baseUrl = "https://new-host.example.com", secret = "rotated-token")

        // Old address, old admin token.
        verify(hostClient).deleteConfiguration(
            eq("https://plugin-host.example.com"),
            eq("admin-token"),
            eq(first.id.toString()),
        )
        verify(hostClient).deleteConfiguration(
            eq("https://plugin-host.example.com"),
            eq("admin-token"),
            eq(second.id.toString()),
        )
    }

    @Test
    fun `update does not purge anything when the address is unchanged`() {
        val host = storedHost()
        configurationUnder(host)

        updateHost(host, secret = "rotated-token")

        verify(hostClient, never()).deleteConfiguration(any(), any(), any())
    }

    @Test
    fun `update survives a plugin host that cannot be reached for the purge`() {
        val host = storedHost()
        val configuration = configurationUnder(host)
        whenever(hostClient.deleteConfiguration(any(), any(), any()))
            .thenThrow(RuntimeException("connection refused"))

        val result = updateHost(host, baseUrl = "https://new-host.example.com")

        assertThat(result.host.baseUrl).isEqualTo("https://new-host.example.com")
        assertThat(configuration.tokenGeneration).isEqualTo(1)
    }

    @Test
    fun `updateFrontendOrigins leaves the rest of the connection surface and the tokens alone`() {
        val host = storedHost(brokerUrl = "amqp://guest:secret@broker:5672")
        val configuration = configurationUnder(host)

        val updated = service.updateFrontendOrigins(host.id, listOf("https://valtimo.example.com"))

        assertThat(updated.baseUrl).isEqualTo("https://plugin-host.example.com")
        assertThat(updated.secret).isEqualTo("encrypted-secret")
        assertThat(updated.eventBrokerAmqpUrl).isEqualTo("amqp://guest:secret@broker:5672")
        assertThat(configuration.tokenGeneration).isZero()
    }

    @Test
    fun `updateEventQueue leaves the rest of the connection surface and the tokens alone`() {
        val host = storedHost(
            brokerUrl = "amqp://guest:secret@broker:5672",
            frontendOrigins = "https://valtimo.example.com",
        )
        val configuration = configurationUnder(host)

        val updated = service.updateEventQueue(host.id, EventQueueMode.DURABLE, null)

        assertThat(updated.eventQueueMode).isEqualTo(EventQueueMode.DURABLE)
        assertThat(updated.eventBrokerAmqpUrl).isEqualTo("amqp://guest:secret@broker:5672")
        assertThat(updated.frontendOriginList).containsExactly("https://valtimo.example.com")
        assertThat(configuration.tokenGeneration).isZero()
    }

    /** Built directly, not via `register`, so the encrypt mock stays untouched. */
    private fun storedHost(
        baseUrl: String = "https://plugin-host.example.com",
        brokerUrl: String? = "amqp://guest:guest@broker:5672",
        frontendOrigins: String? = null,
    ): ExternalPluginHost {
        val host = ExternalPluginHost(
            id = UUID.randomUUID(),
            name = "local",
            baseUrl = baseUrl,
            secret = "encrypted-secret",
            status = ExternalPluginHostStatus.UNREACHABLE,
            gzacCallbackBaseUrl = "https://gzac.example.com",
            eventBrokerAmqpUrl = brokerUrl,
            eventBrokerExchange = null,
            frontendOrigins = frontendOrigins,
        )
        whenever(hostRepository.findById(host.id)).thenReturn(Optional.of(host))
        return host
    }

    /** Stubs one definition-plus-configuration pair under [host]. */
    private fun configurationUnder(
        host: ExternalPluginHost,
        generation: Long = 0,
    ): ExternalPluginConfiguration {
        val definition = ExternalPluginDefinition(
            id = UUID.randomUUID(),
            pluginId = "plugin-${definitionsUnderHost.size}",
            version = "1.0.0",
            hostId = host.id,
            baseUrl = "${host.baseUrl}/plugins/plugin",
            status = ExternalPluginDefinitionStatus.AVAILABLE,
        )
        val configuration = ExternalPluginConfiguration(
            id = UUID.randomUUID(),
            definitionId = definition.id,
            title = "configuration",
            tokenGeneration = generation,
        )
        definitionsUnderHost += definition
        whenever(definitionRepository.findAllByHostId(host.id)).thenReturn(definitionsUnderHost.toList())
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(listOf(configuration))
        return configuration
    }

    private val definitionsUnderHost = mutableListOf<ExternalPluginDefinition>()

    /** `update` with every field defaulting to what is stored. */
    private fun updateHost(
        host: ExternalPluginHost,
        name: String = host.name,
        baseUrl: String = host.baseUrl,
        secret: String? = null,
        gzacCallbackBaseUrl: String? = host.gzacCallbackBaseUrl,
        brokerUrl: String? = host.eventBrokerAmqpUrl,
        brokerExchange: String? = host.eventBrokerExchange,
        mode: EventQueueMode = host.eventQueueMode,
        ttlMs: Long? = host.eventQueueTtlMs,
        frontendOrigins: List<String> = host.frontendOriginList,
    ): HostUpdateResult = service.update(
        host.id,
        name,
        baseUrl,
        secret,
        gzacCallbackBaseUrl,
        brokerUrl,
        brokerExchange,
        mode,
        ttlMs,
        frontendOrigins,
    )

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
