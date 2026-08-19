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
import java.time.Instant
import java.util.UUID

data class HostCreateRequest(
    val name: String,
    val baseUrl: String,
    val secret: String,
    val gzacCallbackBaseUrl: String,
    val eventBrokerAmqpUrl: String?,
    val eventBrokerExchange: String?,
    val eventQueueMode: EventQueueMode = EventQueueMode.LIVE,
    val eventQueueTtlMs: Long? = null,
    val kind: ExternalPluginHostKind = ExternalPluginHostKind.PLUGIN_HOST,
    /**
     * Browser origins allowed to embed this host's plugin screens. Defaults to empty so an older
     * client that does not send the field still registers — the host then frames nothing until an
     * admin fills the origins in.
     */
    val frontendOrigins: List<String> = emptyList(),
)

data class HostResponse(
    val id: UUID,
    val name: String,
    val baseUrl: String,
    val kind: ExternalPluginHostKind,
    val status: ExternalPluginHostStatus,
    val lastHealthCheck: Instant?,
    val gzacCallbackBaseUrl: String?,
    /** Redacted — the userinfo is replaced with `***`; broker credentials never leave the server. */
    val eventBrokerAmqpUrl: String?,
    val eventBrokerExchange: String?,
    val eventQueueMode: EventQueueMode,
    val eventQueueTtlMs: Long?,
    /** Browser origins allowed to embed this host's plugin screens; empty when none registered. */
    val frontendOrigins: List<String>,
) {
    companion object {
        /** Marker replacing the `user:password` userinfo of an AMQP URL in API responses. */
        const val AMQP_USERINFO_REDACTION = "***"

        fun from(host: ExternalPluginHost) = HostResponse(
            id = host.id,
            name = host.name,
            baseUrl = host.baseUrl,
            kind = host.kind,
            status = host.status,
            lastHealthCheck = host.lastHealthCheck,
            gzacCallbackBaseUrl = host.gzacCallbackBaseUrl,
            eventBrokerAmqpUrl = redactAmqpUserInfo(host.eventBrokerAmqpUrl),
            eventBrokerExchange = host.eventBrokerExchange,
            eventQueueMode = host.eventQueueMode,
            eventQueueTtlMs = host.eventQueueTtlMs,
            frontendOrigins = host.frontendOriginList,
        )

        /**
         * Replaces the userinfo (`user:password@`) of an AMQP(S) URL with `***@` so credentials are
         * never echoed to the browser. URLs without userinfo pass through unchanged; the full URL
         * stays server-side on the host row.
         */
        fun redactAmqpUserInfo(url: String?): String? {
            if (url.isNullOrBlank()) return url
            return url.replace(Regex("^(amqps?://)[^@/]+@"), "$1$AMQP_USERINFO_REDACTION@")
        }
    }
}

/**
 * Suggested defaults for the add-host form. Surfaced via `GET /host-defaults`.
 *
 * - `gzacCallbackBaseUrl`: URL the admin reached GZAC at, derived from the current request.
 * - `eventBrokerAmqpUrl`: built from `spring.rabbitmq.*` — GZAC's own broker view.
 * - `eventBrokerExchange`: the exchange GZAC publishes to (from `valtimo.outbox.publisher.rabbitmq.exchange`).
 * - `defaultEventQueueTtlMs` / `minEventQueueTtlMs` / `maxEventQueueTtlMs`: the queue inactivity
 *   TTL bounds the backend will accept when a host opts into DURABLE mode. Pre-fills and validates
 *   the TTL input in the add-host UI.
 * - `frontendOrigins`: the configured CORS allowed-origins, which in a split frontend/backend
 *   deployment are exactly the browser origins that will frame plugin screens. Empty when CORS is
 *   unconfigured or declares only wildcards — the modal then falls back to the admin's own
 *   `window.location.origin`, which is by definition the page the plugin will be embedded in.
 */
data class HostDefaultsResponse(
    val gzacCallbackBaseUrl: String,
    val eventBrokerAmqpUrl: String,
    val eventBrokerExchange: String,
    val defaultEventQueueTtlMs: Long,
    val minEventQueueTtlMs: Long,
    val maxEventQueueTtlMs: Long,
    val frontendOrigins: List<String>,
)

/**
 * Narrow update payload: flips the per-host event-queue mode and adjusts the TTL on an existing
 * host without touching any other field. baseUrl/secret/broker remain immutable because the
 * security check that pins broker credentials to a confidential baseUrl runs at registration time.
 */
data class HostEventQueueUpdateRequest(
    val eventQueueMode: EventQueueMode,
    val eventQueueTtlMs: Long?,
)

/**
 * Narrow update payload for the browser origins allowed to embed this host's plugin screens. Same
 * shape of change as [HostEventQueueUpdateRequest]: one runtime-editable field, everything
 * security-sensitive stays immutable. An empty list means nothing may frame this host's plugins.
 */
data class HostFrontendOriginsUpdateRequest(
    val frontendOrigins: List<String>,
)
