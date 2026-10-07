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

import com.ritense.valtimo.web.sse.service.SseSubscriptionService
import org.assertj.core.api.Assertions.assertThat
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
        "valtimo.sse.reconnect-grace-period=5s",
        "valtimo.sse.connection-timeout=1s",
    ],
)
@Tag("integration")
class SseConnectionTimeoutIntTest {

    @LocalServerPort
    private var port: Int = 0

    @Autowired
    private lateinit var service: SseSubscriptionService

    @Test
    fun `stream ends cleanly on timeout and the client reconnects onto the same subscription`() {
        val client = SseTestClient("http://localhost:$port/api/v1/sse")
        val established = client.nextEvent() ?: throw AssertionError("No established event received")
        val id = UUID.fromString(established.get("subscriptionId").asText())

        assertThat(client.awaitClosed(Duration.ofSeconds(5))).isTrue()
        awaitUntil(description = "detached after timeout") { !service.isConnected(id) }
        assertThat(service.hasSubscription(id)).isTrue()
        client.close()

        val reconnected = SseTestClient("http://localhost:$port/api/v1/sse/$id")
        service.notifySubscribers(TestSseEvent(1))

        assertThat(reconnected.nextEvent()!!.get("seq").asInt()).isEqualTo(1)
        assertThat(service.isConnected(id)).isTrue()
        reconnected.close()
        service.remove(id)
    }
}
