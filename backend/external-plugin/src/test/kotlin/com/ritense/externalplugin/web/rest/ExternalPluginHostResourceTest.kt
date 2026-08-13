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

package com.ritense.externalplugin.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.compatibility.GzacCompatibilityChecker
import com.ritense.externalplugin.compatibility.PluginPackageInspector
import com.ritense.externalplugin.domain.EventQueueMode
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostKind
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.service.EndpointDescriptionService
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginDefinitionService
import com.ritense.externalplugin.service.ExternalPluginDiscoveryService
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.ritense.externalplugin.web.rest.dto.HostCreateRequest
import com.ritense.externalplugin.web.rest.dto.HostEventQueueUpdateRequest
import com.ritense.plugin.web.rest.dto.PluginUsageDto
import com.ritense.plugin.web.rest.dto.PluginUsageParentType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.inOrder
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import org.springframework.mock.env.MockEnvironment
import java.util.UUID

/**
 * Host-facing endpoints of the management resource. The security-critical part is the broker
 * credential flow (plan §6): `host-defaults` must hand the browser a **redacted** AMQP URL, and when
 * that redacted value is echoed back on registration the real credentials must be substituted
 * server-side so a round-tripped placeholder never ends up stored.
 */
class ExternalPluginHostResourceTest {

    private lateinit var hostService: ExternalPluginHostService
    private lateinit var discoveryService: ExternalPluginDiscoveryService
    private lateinit var environment: MockEnvironment
    private lateinit var resource: ExternalPluginManagementResource

    private val hostId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        hostService = mock()
        discoveryService = mock()
        environment = MockEnvironment()
        resource = ExternalPluginManagementResource(
            hostService = hostService,
            definitionService = mock<ExternalPluginDefinitionService>(),
            configurationService = mock<ExternalPluginConfigurationService>(),
            hostClient = mock<ExternalPluginHostClient>(),
            endpointDescriptionService = mock<EndpointDescriptionService>(),
            discoveryService = discoveryService,
            environment = environment,
            compatibilityChecker = GzacCompatibilityChecker { null },
            pluginPackageInspector = PluginPackageInspector(ObjectMapper()),
            objectMapper = ObjectMapper(),
        )
    }

    private fun host(
        id: UUID = hostId,
        kind: ExternalPluginHostKind = ExternalPluginHostKind.PLUGIN_HOST,
        brokerUrl: String? = "amqp://guest:guest@rabbit:5672",
        mode: EventQueueMode = EventQueueMode.LIVE,
        ttlMs: Long? = null,
    ) = ExternalPluginHost(
        id = id,
        name = "host-$id",
        baseUrl = "https://plugin-host:8090",
        secret = "encrypted",
        status = ExternalPluginHostStatus.CONNECTED,
        kind = kind,
        gzacCallbackBaseUrl = "http://gzac:8080",
        eventBrokerAmqpUrl = brokerUrl,
        eventBrokerExchange = "valtimo-events",
        eventQueueMode = mode,
        eventQueueTtlMs = ttlMs,
    )

    private fun createRequest(
        brokerUrl: String? = "amqp://guest:guest@rabbit:5672",
        kind: ExternalPluginHostKind = ExternalPluginHostKind.PLUGIN_HOST,
    ) = HostCreateRequest(
        name = "new host",
        baseUrl = "https://plugin-host:8090",
        secret = "admin-token",
        gzacCallbackBaseUrl = "http://gzac:8080",
        eventBrokerAmqpUrl = brokerUrl,
        eventBrokerExchange = "valtimo-events",
        kind = kind,
    )

    // ---------------------------------------------------------------- host-defaults

    @Test
    fun `hostDefaults derives the callback url from the backend's own port, not the admin's browser url`() {
        environment.setProperty("server.port", "9090")

        val body = resource.hostDefaults().body!!

        assertThat(body.gzacCallbackBaseUrl).isEqualTo("http://localhost:9090")
    }

    @Test
    fun `hostDefaults falls back to port 8080 when server port is unset`() {
        assertThat(resource.hostDefaults().body!!.gzacCallbackBaseUrl).isEqualTo("http://localhost:8080")
    }

    @Test
    fun `hostDefaults redacts the broker credentials it derives from spring rabbitmq properties`() {
        environment.setProperty("spring.rabbitmq.host", "rabbit")
        environment.setProperty("spring.rabbitmq.port", "5673")
        environment.setProperty("spring.rabbitmq.username", "valtimo")
        environment.setProperty("spring.rabbitmq.password", "s3cr3t")

        val body = resource.hostDefaults().body!!

        assertThat(body.eventBrokerAmqpUrl).isEqualTo("amqp://***@rabbit:5673")
        assertThat(body.eventBrokerAmqpUrl).doesNotContain("s3cr3t")
        assertThat(body.eventBrokerAmqpUrl).doesNotContain("valtimo:")
    }

    @Test
    fun `hostDefaults appends a non-default vhost to the broker url`() {
        environment.setProperty("spring.rabbitmq.virtual-host", "valtimo-vhost")

        assertThat(resource.hostDefaults().body!!.eventBrokerAmqpUrl)
            .isEqualTo("amqp://***@localhost:5672/valtimo-vhost")
    }

    @Test
    fun `hostDefaults uses the outbox publisher exchange GZAC itself publishes to`() {
        environment.setProperty("valtimo.outbox.publisher.rabbitmq.exchange", "custom-events")

        assertThat(resource.hostDefaults().body!!.eventBrokerExchange).isEqualTo("custom-events")
    }

    @Test
    fun `hostDefaults falls back to the valtimo-events exchange`() {
        assertThat(resource.hostDefaults().body!!.eventBrokerExchange).isEqualTo("valtimo-events")
    }

    @Test
    fun `hostDefaults exposes the TTL bounds the durable-mode input validates against`() {
        val body = resource.hostDefaults().body!!

        assertThat(body.defaultEventQueueTtlMs).isEqualTo(ExternalPluginHostService.DEFAULT_EVENT_QUEUE_TTL_MS)
        assertThat(body.minEventQueueTtlMs).isEqualTo(ExternalPluginHostService.MIN_EVENT_QUEUE_TTL_MS)
        assertThat(body.maxEventQueueTtlMs).isEqualTo(ExternalPluginHostService.MAX_EVENT_QUEUE_TTL_MS)
    }

    // ---------------------------------------------------------------- listHosts

    @Test
    fun `listHosts redacts every stored broker url`() {
        whenever(hostService.list()).thenReturn(
            listOf(
                host(id = UUID.randomUUID(), brokerUrl = "amqp://guest:guest@rabbit:5672"),
                host(id = UUID.randomUUID(), brokerUrl = "amqps://u:p@broker.example.com:5671/vh"),
                host(id = UUID.randomUUID(), brokerUrl = null),
            )
        )

        val body = resource.listHosts().body!!

        assertThat(body.map { it.eventBrokerAmqpUrl }).containsExactly(
            "amqp://***@rabbit:5672",
            "amqps://***@broker.example.com:5671/vh",
            null,
        )
        assertThat(body.toString()).doesNotContain("guest:guest")
    }

    // ---------------------------------------------------------------- createHost

    @Test
    fun `createHost substitutes the real credentials when the redacted default is echoed back`() {
        environment.setProperty("spring.rabbitmq.username", "valtimo")
        environment.setProperty("spring.rabbitmq.password", "s3cr3t")
        environment.setProperty("spring.rabbitmq.host", "rabbit")
        whenever(hostService.register(any(), any(), any(), any(), anyOrNull(), anyOrNull(), any(), anyOrNull(), any()))
            .thenReturn(host())

        // What the UI posts back after pre-filling the form from `host-defaults`.
        resource.createHost(createRequest(brokerUrl = "amqp://***@rabbit:5672"))

        val brokerUrl = argumentCaptor<String>()
        verify(hostService).register(
            any(), any(), any(), any(), brokerUrl.capture(), anyOrNull(), any(), anyOrNull(), any()
        )
        assertThat(brokerUrl.firstValue).isEqualTo("amqp://valtimo:s3cr3t@rabbit:5672")
    }

    @Test
    fun `createHost stores a genuinely edited broker url verbatim`() {
        whenever(hostService.register(any(), any(), any(), any(), anyOrNull(), anyOrNull(), any(), anyOrNull(), any()))
            .thenReturn(host())

        resource.createHost(createRequest(brokerUrl = "amqp://other:pw@other-broker:5672"))

        val brokerUrl = argumentCaptor<String>()
        verify(hostService).register(
            any(), any(), any(), any(), brokerUrl.capture(), anyOrNull(), any(), anyOrNull(), any()
        )
        assertThat(brokerUrl.firstValue).isEqualTo("amqp://other:pw@other-broker:5672")
    }

    @Test
    fun `createHost passes a blank broker url through as-is so the service can null it`() {
        whenever(hostService.register(any(), any(), any(), any(), anyOrNull(), anyOrNull(), any(), anyOrNull(), any()))
            .thenReturn(host(brokerUrl = null))

        resource.createHost(createRequest(brokerUrl = ""))

        val brokerUrl = argumentCaptor<String>()
        verify(hostService).register(
            any(), any(), any(), any(), brokerUrl.capture(), anyOrNull(), any(), anyOrNull(), any()
        )
        assertThat(brokerUrl.firstValue).isEmpty()
    }

    @Test
    fun `createHost returns 201 with a redacted response body`() {
        whenever(hostService.register(any(), any(), any(), any(), anyOrNull(), anyOrNull(), any(), anyOrNull(), any()))
            .thenReturn(host())

        val response = resource.createHost(createRequest())

        assertThat(response.statusCode).isEqualTo(HttpStatus.CREATED)
        assertThat(response.body!!.eventBrokerAmqpUrl).isEqualTo("amqp://***@rabbit:5672")
    }

    @Test
    fun `createHost triggers an immediate discovery so the new host's plugins are configurable at once`() {
        whenever(hostService.register(any(), any(), any(), any(), anyOrNull(), anyOrNull(), any(), anyOrNull(), any()))
            .thenReturn(host(kind = ExternalPluginHostKind.APP))

        resource.createHost(createRequest(kind = ExternalPluginHostKind.APP))

        verify(discoveryService).discoverHost(hostId)
    }

    @Test
    fun `createHost survives a failing discovery — registration is what must succeed`() {
        whenever(hostService.register(any(), any(), any(), any(), anyOrNull(), anyOrNull(), any(), anyOrNull(), any()))
            .thenReturn(host())
        whenever(discoveryService.discoverHost(any())).thenThrow(RuntimeException("host unreachable"))

        val response = resource.createHost(createRequest())

        assertThat(response.statusCode).isEqualTo(HttpStatus.CREATED)
    }

    @Test
    fun `createHost forwards the host kind`() {
        whenever(hostService.register(any(), any(), any(), any(), anyOrNull(), anyOrNull(), any(), anyOrNull(), any()))
            .thenReturn(host(kind = ExternalPluginHostKind.APP))

        resource.createHost(createRequest(kind = ExternalPluginHostKind.APP))

        verify(hostService).register(
            eq("new host"),
            eq("https://plugin-host:8090"),
            eq("admin-token"),
            eq("http://gzac:8080"),
            anyOrNull(),
            eq("valtimo-events"),
            eq(EventQueueMode.LIVE),
            anyOrNull(),
            eq(ExternalPluginHostKind.APP),
        )
    }

    // ---------------------------------------------------------------- event-queue PATCH

    @Test
    fun `updateHostEventQueue swaps the mode and re-discovers so the queue changes without waiting for the poll`() {
        whenever(hostService.updateEventQueue(eq(hostId), any(), anyOrNull()))
            .thenReturn(host(mode = EventQueueMode.DURABLE, ttlMs = 259_200_000))

        val response = resource.updateHostEventQueue(
            hostId,
            HostEventQueueUpdateRequest(EventQueueMode.DURABLE, 259_200_000),
        )

        assertThat(response.body!!.eventQueueMode).isEqualTo(EventQueueMode.DURABLE)
        assertThat(response.body!!.eventQueueTtlMs).isEqualTo(259_200_000)
        // The re-discovery has to come *after* the row is updated, or the host re-reads the old mode.
        inOrder(hostService, discoveryService) {
            verify(hostService).updateEventQueue(hostId, EventQueueMode.DURABLE, 259_200_000)
            verify(discoveryService).discoverAll()
        }
    }

    @Test
    fun `updateHostEventQueue redacts the broker url in its response too`() {
        whenever(hostService.updateEventQueue(eq(hostId), any(), anyOrNull())).thenReturn(host())

        val response = resource.updateHostEventQueue(
            hostId,
            HostEventQueueUpdateRequest(EventQueueMode.LIVE, null),
        )

        assertThat(response.body!!.eventBrokerAmqpUrl).isEqualTo("amqp://***@rabbit:5672")
    }

    @Test
    fun `updateHostEventQueue survives a failing re-discovery`() {
        whenever(hostService.updateEventQueue(eq(hostId), any(), anyOrNull())).thenReturn(host())
        whenever(discoveryService.discoverAll()).thenThrow(RuntimeException("unreachable"))

        val response = resource.updateHostEventQueue(
            hostId,
            HostEventQueueUpdateRequest(EventQueueMode.LIVE, null),
        )

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
    }

    // ---------------------------------------------------------------- usages & delete

    @Test
    fun `listHostUsages returns the resolver's rows`() {
        val usage = PluginUsageDto(
            configurationId = UUID.randomUUID(),
            configurationTitle = "My config",
            parentType = PluginUsageParentType.CASE,
            parentKey = "my-case",
            parentVersionTag = "1.0.0",
        )
        whenever(hostService.findUsages(hostId)).thenReturn(listOf(usage))

        assertThat(resource.listHostUsages(hostId).body).containsExactly(usage)
    }

    @Test
    fun `listHostUsages is read-only — it never deletes`() {
        whenever(hostService.findUsages(hostId)).thenReturn(emptyList())

        resource.listHostUsages(hostId)

        verify(hostService, never()).delete(any())
    }

    @Test
    fun `deleteHost delegates to the guarded service delete and answers 204`() {
        val response = resource.deleteHost(hostId)

        assertThat(response.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        verify(hostService).delete(hostId)
    }
}
