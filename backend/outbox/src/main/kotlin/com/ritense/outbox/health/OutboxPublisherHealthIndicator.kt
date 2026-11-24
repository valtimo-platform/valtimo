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
import org.springframework.boot.health.contributor.AbstractHealthIndicator
import org.springframework.boot.health.contributor.Health

/**
 * Exposes the outbox publisher circuit breaker state via the /actuator/health endpoint.
 *
 * Always reports UP so the outbox status does not affect the overall application health.
 * The circuit breaker state is included as informational details.
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
        builder.up()
            .withDetail("circuitBreakerState", circuitBreaker.state.name)
            .withDetail("failureRate", "${metrics.failureRate}%")
            .withDetail("slidingWindow", mapOf(
                "successful" to metrics.numberOfSuccessfulCalls,
                "failed" to metrics.numberOfFailedCalls,
                "rejected" to metrics.numberOfNotPermittedCalls
            ))
    }
}
