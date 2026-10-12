/*
 *  Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 *  Licensed under EUPL, Version 1.2 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" basis,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package com.ritense.valtimo.web.sse

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.valtimo.web.sse.service.SseSubscriptionService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import java.time.Duration
import java.util.UUID

@SpringBootTest(
    classes = [SseTestConfiguration::class],
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "valtimo.sse.heartbeat-interval=200ms",
        "valtimo.sse.reconnect-grace-period=1s",
        "valtimo.sse.connection-timeout=60s",
        "valtimo.sse.max-queued-events=5",
    ],
)
@Tag("integration")
class SseResourceIntTest {

    @LocalServerPort
    private var port: Int = 0

    @Autowired
    private lateinit var service: SseSubscriptionService

    private val clients = mutableListOf<SseTestClient>()
    private val subscriptionIds = mutableListOf<UUID>()

    /** Sender is single-threaded FIFO: once a marker arrives, nothing from an earlier test is still in flight. */
    @BeforeEach
    fun drainSender() {
        val probe = connect()
        established(probe)
        service.notifySubscribers(TestSseEvent(-1))
        awaitUntil(description = "sender idle") { probe.nextEvent(Duration.ofSeconds(1))?.seq() == -1 }
        probe.close()
    }

    @AfterEach
    fun tearDown() {
        clients.forEach { runCatching { it.close() } }
        subscriptionIds.forEach { service.remove(it) }
    }

    @Test
    fun `new client gets an event stream, its subscription id and every broadcast in order`() {
        val client = connect()

        assertThat(client.status).isEqualTo(200)
        assertThat(client.contentType).startsWith("text/event-stream")
        val id = established(client)
        assertThat(service.isConnected(id)).isTrue()

        (1..3).forEach { service.notifySubscribers(TestSseEvent(it)) }

        assertThat((1..3).map { client.nextEvent()!!.seq() }).containsExactly(1, 2, 3)
    }

    @Test
    fun `unknown subscription id results in a fresh subscription`() {
        val unknown = UUID.randomUUID()

        val client = connect(unknown)

        assertThat(established(client)).isNotEqualTo(unknown)
        assertThat(service.hasSubscription(unknown)).isFalse()
    }

    @Test
    fun `heartbeats reach a connected client`() {
        val client = connect()
        established(client)

        awaitUntil(description = "3 heartbeats") { client.heartbeats.get() >= 3 }
    }

    @Test
    fun `client that vanishes does not block others and is evicted after the grace period`() {
        val gone = connect()
        val goneId = established(gone)
        val alive = connect()
        val aliveId = established(alive)

        gone.close()
        (1..20).forEach { service.notifySubscribers(TestSseEvent(it)) }

        assertThat((1..20).map { alive.nextEvent()!!.seq() }).isEqualTo((1..20).toList())
        awaitUntil(description = "gone client detected") { !service.isConnected(goneId) }
        awaitUntil(description = "gone subscription evicted") { !service.hasSubscription(goneId) }
        assertThat(service.isConnected(aliveId)).isTrue()
        assertThat(service.hasSubscription(aliveId)).isTrue()
    }

    @Test
    fun `client reconnecting within the grace period gets the bounded backlog in order and keeps its subscription`() {
        val client = connect()
        val id = established(client)
        client.close()
        awaitUntil(description = "disconnect detected") { !service.isConnected(id) }

        (1..8).forEach { service.notifySubscribers(TestSseEvent(it)) }
        awaitUntil(description = "backlog bounded") { service.queuedEventCount(id) == 5 }

        val reconnected = connect(id)

        assertThat((1..5).map { reconnected.nextEvent()!!.seq() }).containsExactly(4, 5, 6, 7, 8)
        assertThat(service.queuedEventCount(id)).isZero()
        assertThat(service.isConnected(id)).isTrue()

        service.notifySubscribers(TestSseEvent(9))
        assertThat(reconnected.nextEvent()!!.seq()).isEqualTo(9)
    }

    @Test
    fun `many vanished clients leave no trace after the grace period`() {
        val ids = (1..25).map { connect().let { c -> established(c).also { c.close() } } }

        (1..50).forEach { service.notifySubscribers(TestSseEvent(it)) }

        awaitUntil(Duration.ofSeconds(20), "all evicted") { ids.none { service.hasSubscription(it) } }
        assertThat(service.stats().queuedEvents).isZero()
    }

    private fun url(id: UUID? = null) = "http://localhost:$port/api/v1/sse" + (id?.let { "/$it" } ?: "")

    private fun connect(id: UUID? = null): SseTestClient = SseTestClient(url(id)).also { clients += it }

    private fun established(client: SseTestClient): UUID {
        val event = client.nextEvent() ?: throw AssertionError("No established event received")
        assertThat(event.get("eventType")?.asText()).withFailMessage("Unexpected first event: %s", event).isEqualTo("ESTABLISHED_CONNECTION")
        return UUID.fromString(event.get("subscriptionId").asText()).also { subscriptionIds += it }
    }

    private fun JsonNode.seq(): Int = get("seq").asInt()
}
