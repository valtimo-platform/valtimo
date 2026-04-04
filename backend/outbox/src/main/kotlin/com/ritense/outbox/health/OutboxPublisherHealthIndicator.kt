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

package com.ritense.outbox.health

import io.github.resilience4j.circuitbreaker.CircuitBreaker
import org.springframework.boot.actuate.health.AbstractHealthIndicator
import org.springframework.boot.actuate.health.Health

/**
 * Exposes the outbox publisher circuit breaker state via the /actuator/health endpoint.
 *
 * Reports DOWN when the circuit breaker is OPEN (publisher is failing),
 * UP when CLOSED or HALF_OPEN (normal operation or recovery testing).
 *
 * Only active when spring-boot-starter-actuator is on the classpath.
 */
class OutboxPublisherHealthIndicator(
    private val circuitBreaker: CircuitBreaker?
) : AbstractHealthIndicator() {

    override fun doHealthCheck(builder: Health.Builder) {
        if (circuitBreaker == null) {
            builder.up()
                .withDetail("circuitBreaker", "disabled")
            return
        }

        val metrics = circuitBreaker.metrics
        val details = mapOf(
            "circuitBreakerState" to circuitBreaker.state.name,
            // failureRate is -1.0 until minimumNumberOfCalls is reached
            "failureRate" to "${metrics.failureRate}%",
            "slidingWindow" to mapOf(
                "successful" to metrics.numberOfSuccessfulCalls,
                "failed" to metrics.numberOfFailedCalls,
                "rejected" to metrics.numberOfNotPermittedCalls
            )
        )

        when (circuitBreaker.state) {
            CircuitBreaker.State.CLOSED -> builder.up().withDetails(details)
            CircuitBreaker.State.HALF_OPEN -> builder.up().withDetails(details)
            CircuitBreaker.State.OPEN -> builder.down().withDetails(details)
            else -> builder.unknown().withDetails(details)
        }
    }
}
