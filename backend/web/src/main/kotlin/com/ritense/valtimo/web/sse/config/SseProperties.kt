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

package com.ritense.valtimo.web.sse.config

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

@ConfigurationProperties(prefix = "valtimo.sse")
class SseProperties {

    /** Max lifetime of one SSE connection. Stream ends cleanly, browser reconnects with its subscription id. */
    var connectionTimeout: Duration = Duration.ofMinutes(30)

    /** Interval of keep-alive comments. Detects gone clients, keeps proxies from closing idle streams. Zero disables. */
    var heartbeatInterval: Duration = Duration.ofSeconds(30)

    /** How long a disconnected subscription (and its queued events) is kept for a reconnect. */
    var reconnectGracePeriod: Duration = Duration.ofMinutes(2)

    /** Max events buffered per disconnected subscription. Oldest dropped first. */
    var maxQueuedEvents: Int = 100

    /** Max notifications waiting for the sender thread. Beyond this, notifications are dropped. */
    var maxPendingNotifications: Int = 10_000
}
