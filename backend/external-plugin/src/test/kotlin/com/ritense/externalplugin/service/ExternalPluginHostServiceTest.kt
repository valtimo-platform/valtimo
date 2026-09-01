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
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostKind
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
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

/**
 * Guards the rule that the broker AMQP URL and credentials — carried in cleartext inside the
 * HMAC-signed configuration push body — are never associated with a host the push can only reach
 * over an unencrypted transport. The check runs at registration and again on every connection
 * update, so the invariant survives any combination of baseUrl/broker edits.
 */
class ExternalPluginHostServiceTest {

    private lateinit var hostRepository: ExternalPluginHostRepository
    private lateinit var definitionRepository: ExternalPluginDefinitionRepository
    private lateinit var encryptionService: EncryptionService
    private lateinit var service: ExternalPluginHostService

    @BeforeEach
    fun setUp() {
        hostRepository = mock()
        definitionRepository = mock()
        encryptionService = mock()
        whenever(encryptionService.encrypt(any())).thenReturn("encrypted-secret")
        whenever(hostRepository.save(any<ExternalPluginHost>())).thenAnswer { it.getArgument(0) }
        service = ExternalPluginHostService(
            hostRepository,
            definitionRepository,
            mock<ExternalPluginConfigurationRepository>(),
            mock<ExternalPluginGrantedEndpointRepository>(),
            mock<ExternalPluginGrantedEventRepository>(),
            mock(),
            mock(),
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

    // ---------------------------------------------------------------- connection updates (#618)

    @Test
    fun `updateConnection repoints the base url and normalises the trailing slash`() {
        val existing = stubExisting()

        val updated = service.updateConnection(existing.id, baseUrl = "https://moved.example.com/")

        assertThat(updated.baseUrl).isEqualTo("https://moved.example.com")
    }

    @Test
    fun `updateConnection with no fields changes nothing`() {
        val existing = stubExisting()
        val before = snapshot(existing)

        val updated = service.updateConnection(existing.id)

        assertThat(snapshot(updated)).isEqualTo(before)
    }

    @Test
    fun `updateConnection refuses a base url change to plaintext while a broker is configured`() {
        val existing = stubExisting()

        assertThatThrownBy {
            service.updateConnection(existing.id, baseUrl = "http://moved-host:8090")
        }.isInstanceOf(ExternalPluginHostValidationException::class.java)
            .hasMessageContaining("unencrypted transport")
        assertThat(existing.baseUrl).isEqualTo("https://plugin-host.example.com")
    }

    @Test
    fun `updateConnection refuses adding a broker to a plaintext remote host`() {
        val existing = stubExisting(brokerAmqpUrl = null, baseUrl = "http://plugin-host:8090")

        assertThatThrownBy {
            service.updateConnection(existing.id, eventBrokerAmqpUrl = "amqp://guest:guest@broker:5672")
        }.isInstanceOf(ExternalPluginHostValidationException::class.java)
            .hasMessageContaining("unencrypted transport")
    }

    @Test
    fun `updateConnection allows broker plus base url changed together to a confidential pair`() {
        val existing = stubExisting(brokerAmqpUrl = null, baseUrl = "http://plugin-host:8090")

        val updated = service.updateConnection(
            existing.id,
            baseUrl = "http://localhost:8090",
            eventBrokerAmqpUrl = "amqp://guest:guest@localhost:5672",
        )

        assertThat(updated.baseUrl).isEqualTo("http://localhost:8090")
        assertThat(updated.eventBrokerAmqpUrl).isEqualTo("amqp://guest:guest@localhost:5672")
    }

    @Test
    fun `updateConnection refuses a bind address as the new base url`() {
        val existing = stubExisting()

        assertThatThrownBy {
            service.updateConnection(existing.id, baseUrl = "http://0.0.0.0:8090")
        }.isInstanceOf(ExternalPluginHostValidationException::class.java)
            .hasMessageContaining("bind address")
    }

    @Test
    fun `updateConnection refuses a base url already registered as another host`() {
        val existing = stubExisting()
        val other = registerMinimal()
        whenever(hostRepository.findByBaseUrl("https://other.example.com")).thenReturn(other)

        assertThatThrownBy {
            service.updateConnection(existing.id, baseUrl = "https://other.example.com")
        }.isInstanceOf(ExternalPluginHostValidationException::class.java)
            .hasMessageContaining("already registered")
    }

    @Test
    fun `updateConnection accepts re-submitting the host's own base url`() {
        val existing = stubExisting()

        val updated = service.updateConnection(existing.id, baseUrl = "${existing.baseUrl}/")

        assertThat(updated.baseUrl).isEqualTo(existing.baseUrl)
    }

    @Test
    fun `updateConnection re-encrypts a new secret and leaves a blank one untouched`() {
        val existing = stubExisting()
        val originalCiphertext = existing.secret
        whenever(encryptionService.encrypt("rotated-token")).thenReturn("encrypted-rotated")

        val untouched = service.updateConnection(existing.id, secret = "  ")
        assertThat(untouched.secret).isEqualTo(originalCiphertext)

        val rotated = service.updateConnection(existing.id, secret = "rotated-token")
        assertThat(rotated.secret).isEqualTo("encrypted-rotated")
    }

    @Test
    fun `updateConnection refuses a broker url echoing the redaction marker`() {
        val existing = stubExisting()

        assertThatThrownBy {
            service.updateConnection(existing.id, eventBrokerAmqpUrl = "amqp://***@broker:5672")
        }.isInstanceOf(ExternalPluginHostValidationException::class.java)
            .hasMessageContaining("redacted")
        assertThat(existing.eventBrokerAmqpUrl).isEqualTo("amqp://guest:guest@broker:5672")
    }

    @Test
    fun `updateConnection clears the broker on a blank url and keeps it on null`() {
        val existing = stubExisting()

        val kept = service.updateConnection(existing.id, name = "renamed")
        assertThat(kept.eventBrokerAmqpUrl).isEqualTo("amqp://guest:guest@broker:5672")

        val cleared = service.updateConnection(existing.id, eventBrokerAmqpUrl = "  ")
        assertThat(cleared.eventBrokerAmqpUrl).isNull()
    }

    @Test
    fun `updateConnection updates name and callback url and rejects blanks for both`() {
        val existing = stubExisting()

        val updated = service.updateConnection(
            existing.id,
            name = "renamed",
            gzacCallbackBaseUrl = "https://gzac-new.example.com/",
        )
        assertThat(updated.name).isEqualTo("renamed")
        assertThat(updated.gzacCallbackBaseUrl).isEqualTo("https://gzac-new.example.com")

        assertThatThrownBy { service.updateConnection(existing.id, name = " ") }
            .isInstanceOf(ExternalPluginHostValidationException::class.java)
        assertThatThrownBy { service.updateConnection(existing.id, gzacCallbackBaseUrl = " ") }
            .isInstanceOf(ExternalPluginHostValidationException::class.java)
    }

    @Test
    fun `updateConnection resets the failure counter on base url or secret change but not otherwise`() {
        val existing = stubExisting()
        existing.consecutiveFailures = 2

        service.updateConnection(existing.id, name = "renamed")
        assertThat(existing.consecutiveFailures).isEqualTo(2)

        service.updateConnection(existing.id, baseUrl = "https://moved.example.com")
        assertThat(existing.consecutiveFailures).isEqualTo(0)

        existing.consecutiveFailures = 2
        service.updateConnection(existing.id, secret = "rotated-token")
        assertThat(existing.consecutiveFailures).isEqualTo(0)
    }

    @Test
    fun `updateConnection rewrites denormalized definition base urls on a repoint`() {
        val existing = stubExisting()
        val definition = ExternalPluginDefinition(
            id = UUID.randomUUID(),
            pluginId = "case-summary",
            version = "0.1.0",
            hostId = existing.id,
            baseUrl = "${existing.baseUrl}/plugins/case-summary",
            status = ExternalPluginDefinitionStatus.AVAILABLE,
        )
        whenever(definitionRepository.findAllByHostId(existing.id)).thenReturn(listOf(definition))

        service.updateConnection(existing.id, baseUrl = "https://moved.example.com")

        assertThat(definition.baseUrl).isEqualTo("https://moved.example.com/plugins/case-summary")
        verify(definitionRepository).saveAll(listOf(definition))

        service.updateConnection(existing.id, name = "renamed")
        // Name-only edits never touch definitions.
        verify(definitionRepository, times(1)).saveAll(any<List<ExternalPluginDefinition>>())
    }

    @Test
    fun `updateConnection throws when the host does not exist`() {
        val missingId = UUID.randomUUID()
        whenever(hostRepository.findById(missingId)).thenReturn(Optional.empty())

        assertThatThrownBy {
            service.updateConnection(missingId, name = "renamed")
        }.isInstanceOf(ExternalPluginNotFoundException::class.java)
    }

    private fun stubExisting(
        baseUrl: String = "https://plugin-host.example.com",
        brokerAmqpUrl: String? = "amqp://guest:guest@broker:5672",
    ): ExternalPluginHost {
        val host = service.register(
            name = "local",
            baseUrl = baseUrl,
            secret = "admin-token",
            gzacCallbackBaseUrl = "https://gzac.example.com",
            eventBrokerAmqpUrl = brokerAmqpUrl,
            eventBrokerExchange = null,
        )
        whenever(hostRepository.findById(host.id)).thenReturn(Optional.of(host))
        return host
    }

    private fun snapshot(host: ExternalPluginHost) = listOf(
        host.name, host.baseUrl, host.secret, host.gzacCallbackBaseUrl,
        host.eventBrokerAmqpUrl, host.eventBrokerExchange, host.consecutiveFailures,
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
