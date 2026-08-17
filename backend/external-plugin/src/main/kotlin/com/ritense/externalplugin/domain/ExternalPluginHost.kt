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

package com.ritense.externalplugin.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "external_plugin_host")
class ExternalPluginHost(

    @Id
    @Column(name = "id")
    val id: UUID,

    @Column(name = "name", nullable = false)
    var name: String,

    @Column(name = "base_url", nullable = false)
    var baseUrl: String,

    @Column(name = "secret", nullable = false)
    var secret: String,

    @Column(name = "status", nullable = false)
    @Enumerated(EnumType.STRING)
    var status: ExternalPluginHostStatus,

    @Column(name = "last_health_check")
    var lastHealthCheck: Instant? = null,

    @Column(name = "consecutive_failures", nullable = false)
    var consecutiveFailures: Int = 0,

    /**
     * Whether this row is a multi-plugin [PLUGIN_HOST][ExternalPluginHostKind.PLUGIN_HOST] (plugins
     * uploaded as `.wasm`) or an [APP][ExternalPluginHostKind.APP] (a remote service added by URL
     * that serves its own single plugin and accepts no uploads). Defaults to `PLUGIN_HOST` for
     * pre-existing rows.
     */
    @Column(name = "kind", nullable = false)
    @Enumerated(EnumType.STRING)
    var kind: ExternalPluginHostKind = ExternalPluginHostKind.PLUGIN_HOST,

    /**
     * URL the plugin host uses to call back into GZAC. Pre-filled in the add-host UI from the URL
     * the admin reaches GZAC at and editable per host. Null only on legacy rows; pushes fall back
     * to `http://localhost:{server.port}` in that case.
     */
    @Column(name = "gzac_callback_base_url")
    var gzacCallbackBaseUrl: String? = null,

    /**
     * AMQP URL the plugin host uses to consume this instance's event stream. Pre-filled in the
     * add-host UI from `spring.rabbitmq.*` and editable per host. Null disables event delivery
     * for this host (actions still work).
     */
    @Column(name = "event_broker_amqp_url")
    var eventBrokerAmqpUrl: String? = null,

    /**
     * Exchange the plugin host binds to. Null falls back to `valtimo.outbox.publisher.rabbitmq.exchange`
     * at push time — the exchange GZAC itself publishes to.
     */
    @Column(name = "event_broker_exchange")
    var eventBrokerExchange: String? = null,

    /**
     * Per-host event-queue declaration mode. LIVE keeps today's autoDelete semantics; DURABLE
     * survives host restarts. Pushed alongside the broker connection on every configuration push,
     * so the plugin-host can switch its `assertQueue` arguments without any out-of-band coordination.
     */
    @Column(name = "event_queue_mode", nullable = false)
    @Enumerated(EnumType.STRING)
    var eventQueueMode: EventQueueMode = EventQueueMode.LIVE,

    /**
     * Queue inactivity TTL in milliseconds, used only when [eventQueueMode] is DURABLE. Maps to
     * RabbitMQ's `x-expires` queue argument. Required to be `null` when mode is LIVE.
     */
    @Column(name = "event_queue_ttl_ms")
    var eventQueueTtlMs: Long? = null,

    /**
     * Browser origins (`scheme://host[:port]`, comma-separated) allowed to embed this host's plugin
     * screens. Pushed to the plugin host, which serves them as the `frame-ancestors` CSP directive
     * on every bundle response. Deliberately not derived from [gzacCallbackBaseUrl]: that is a
     * server-to-server URL and is routinely a different address than the one the admin's browser
     * uses. Null (legacy rows, or a host registered before the field existed) means nothing may
     * frame this host's plugins until an admin fills it in — fail closed.
     */
    @Column(name = "frontend_origins", length = 2000)
    var frontendOrigins: String? = null,
) {

    /** [frontendOrigins] as a list, with blanks dropped. Empty when nothing is registered. */
    val frontendOriginList: List<String>
        get() = frontendOrigins
            ?.split(',')
            ?.map { it.trim() }
            ?.filter { it.isNotEmpty() }
            ?: emptyList()
}
