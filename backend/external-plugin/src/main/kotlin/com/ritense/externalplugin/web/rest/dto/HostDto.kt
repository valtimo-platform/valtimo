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
)

data class HostResponse(
    val id: UUID,
    val name: String,
    val baseUrl: String,
    val status: ExternalPluginHostStatus,
    val lastHealthCheck: Instant?,
    val gzacCallbackBaseUrl: String?,
    val eventBrokerAmqpUrl: String?,
    val eventBrokerExchange: String?,
    val eventQueueMode: EventQueueMode,
    val eventQueueTtlMs: Long?,
) {
    companion object {
        fun from(host: ExternalPluginHost) = HostResponse(
            id = host.id,
            name = host.name,
            baseUrl = host.baseUrl,
            status = host.status,
            lastHealthCheck = host.lastHealthCheck,
            gzacCallbackBaseUrl = host.gzacCallbackBaseUrl,
            eventBrokerAmqpUrl = host.eventBrokerAmqpUrl,
            eventBrokerExchange = host.eventBrokerExchange,
            eventQueueMode = host.eventQueueMode,
            eventQueueTtlMs = host.eventQueueTtlMs,
        )
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
 */
data class HostDefaultsResponse(
    val gzacCallbackBaseUrl: String,
    val eventBrokerAmqpUrl: String,
    val eventBrokerExchange: String,
    val defaultEventQueueTtlMs: Long,
    val minEventQueueTtlMs: Long,
    val maxEventQueueTtlMs: Long,
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
