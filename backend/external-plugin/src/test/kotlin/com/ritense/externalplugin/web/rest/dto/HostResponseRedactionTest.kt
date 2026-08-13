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

package com.ritense.externalplugin.web.rest.dto

import com.ritense.externalplugin.domain.EventQueueMode
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostKind
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.util.UUID

/**
 * Broker credentials must never reach the browser (plan §6): every API response carrying a host row
 * replaces the AMQP userinfo with `***`, while the full URL stays server-side for the config push.
 */
class HostResponseRedactionTest {

    @Test
    fun `redacts the userinfo of an amqp url`() {
        assertThat(HostResponse.redactAmqpUserInfo("amqp://guest:guest@localhost:5672"))
            .isEqualTo("amqp://***@localhost:5672")
    }

    @Test
    fun `redacts the userinfo of an amqps url`() {
        assertThat(HostResponse.redactAmqpUserInfo("amqps://user:s3cr3t@broker.example.com:5671"))
            .isEqualTo("amqps://***@broker.example.com:5671")
    }

    @Test
    fun `keeps a vhost path while redacting the credentials`() {
        assertThat(HostResponse.redactAmqpUserInfo("amqp://user:pw@broker:5672/valtimo"))
            .isEqualTo("amqp://***@broker:5672/valtimo")
    }

    @Test
    fun `leaves a url without userinfo untouched`() {
        assertThat(HostResponse.redactAmqpUserInfo("amqp://localhost:5672"))
            .isEqualTo("amqp://localhost:5672")
    }

    @Test
    fun `passes null and blank through unchanged`() {
        assertThat(HostResponse.redactAmqpUserInfo(null)).isNull()
        assertThat(HostResponse.redactAmqpUserInfo("")).isEmpty()
        assertThat(HostResponse.redactAmqpUserInfo("   ")).isEqualTo("   ")
    }

    @Test
    fun `only rewrites the amqp schemes it knows`() {
        // A non-AMQP URL is not a broker URL; leaving it alone keeps the rewrite narrowly scoped.
        assertThat(HostResponse.redactAmqpUserInfo("https://user:pw@example.com"))
            .isEqualTo("https://user:pw@example.com")
    }

    /**
     * KNOWN LIMITATION, pinned deliberately: the userinfo pattern stops at the first `@`, so a
     * password containing `@` leaves its tail visible. RabbitMQ requires such a password to be
     * percent-encoded in a URL (`%40`), which redacts cleanly — see the case below. If the pattern is
     * ever widened to be greedy, this expectation should flip rather than silently change behaviour.
     */
    @Test
    fun `an unencoded at-sign in the password leaves a fragment visible`() {
        assertThat(HostResponse.redactAmqpUserInfo("amqp://user:pw@word@broker:5672"))
            .isEqualTo("amqp://***@word@broker:5672")
    }

    @Test
    fun `a percent-encoded at-sign in the password redacts completely`() {
        assertThat(HostResponse.redactAmqpUserInfo("amqp://user:pw%40word@broker:5672"))
            .isEqualTo("amqp://***@broker:5672")
    }

    @Test
    fun `from() redacts the stored broker url and copies every other field`() {
        val hostId = UUID.randomUUID()
        val host = ExternalPluginHost(
            id = hostId,
            name = "local host",
            baseUrl = "https://plugin-host:8090",
            secret = "encrypted-secret",
            status = ExternalPluginHostStatus.CONNECTED,
            kind = ExternalPluginHostKind.APP,
            gzacCallbackBaseUrl = "http://gzac:8080",
            eventBrokerAmqpUrl = "amqp://guest:guest@rabbit:5672",
            eventBrokerExchange = "valtimo-events",
            eventQueueMode = EventQueueMode.DURABLE,
            eventQueueTtlMs = 259_200_000,
        )

        val response = HostResponse.from(host)

        assertThat(response.eventBrokerAmqpUrl).isEqualTo("amqp://***@rabbit:5672")
        assertThat(response.eventBrokerAmqpUrl).doesNotContain("guest")
        assertThat(response.id).isEqualTo(hostId)
        assertThat(response.name).isEqualTo("local host")
        assertThat(response.baseUrl).isEqualTo("https://plugin-host:8090")
        assertThat(response.kind).isEqualTo(ExternalPluginHostKind.APP)
        assertThat(response.status).isEqualTo(ExternalPluginHostStatus.CONNECTED)
        assertThat(response.gzacCallbackBaseUrl).isEqualTo("http://gzac:8080")
        assertThat(response.eventBrokerExchange).isEqualTo("valtimo-events")
        assertThat(response.eventQueueMode).isEqualTo(EventQueueMode.DURABLE)
        assertThat(response.eventQueueTtlMs).isEqualTo(259_200_000)
    }

    @Test
    fun `from() never exposes the host secret`() {
        val host = ExternalPluginHost(
            id = UUID.randomUUID(),
            name = "h",
            baseUrl = "https://plugin-host:8090",
            secret = "encrypted-admin-token",
            status = ExternalPluginHostStatus.CONNECTED,
        )

        // The HMAC key must not have a field on the response at all — assert on the whole shape.
        assertThat(HostResponse.from(host).toString()).doesNotContain("encrypted-admin-token")
    }
}
