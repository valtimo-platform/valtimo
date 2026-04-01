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
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.actuate.health.Health
import org.springframework.boot.actuate.health.Status
import java.time.Duration

class OutboxPublisherHealthIndicatorTest {

    @Test
    fun `should report UP when circuit breaker is null`() {
        val indicator = OutboxPublisherHealthIndicator(null)
        val health = indicator.health()

        assertThat(health.status).isEqualTo(Status.UP)
        assertThat(health.details["circuitBreaker"]).isEqualTo("disabled")
    }

    @Test
    fun `should report UP when circuit breaker is CLOSED`() {
        val circuitBreaker = createCircuitBreaker()
        val indicator = OutboxPublisherHealthIndicator(circuitBreaker)
        val health = indicator.health()

        assertThat(health.status).isEqualTo(Status.UP)
        assertThat(health.details["circuitBreakerState"]).isEqualTo("CLOSED")
    }

    @Test
    fun `should report DOWN when circuit breaker is OPEN`() {
        val circuitBreaker = createCircuitBreaker()
        circuitBreaker.transitionToOpenState()
        val indicator = OutboxPublisherHealthIndicator(circuitBreaker)
        val health = indicator.health()

        assertThat(health.status).isEqualTo(Status.DOWN)
        assertThat(health.details["circuitBreakerState"]).isEqualTo("OPEN")
    }

    @Test
    fun `should report UP when circuit breaker is HALF_OPEN`() {
        val circuitBreaker = createCircuitBreaker()
        circuitBreaker.transitionToOpenState()
        circuitBreaker.transitionToHalfOpenState()
        val indicator = OutboxPublisherHealthIndicator(circuitBreaker)
        val health = indicator.health()

        assertThat(health.status).isEqualTo(Status.UP)
        assertThat(health.details["circuitBreakerState"]).isEqualTo("HALF_OPEN")
    }

    @Test
    fun `should include metrics in health details`() {
        val circuitBreaker = createCircuitBreaker()
        // Record some calls
        circuitBreaker.onSuccess(0, java.util.concurrent.TimeUnit.NANOSECONDS)
        circuitBreaker.onError(0, java.util.concurrent.TimeUnit.NANOSECONDS, RuntimeException("fail"))

        val indicator = OutboxPublisherHealthIndicator(circuitBreaker)
        val health = indicator.health()

        assertThat(health.details).containsKeys(
            "circuitBreakerState",
            "failureRate",
            "slidingWindow"
        )
        @Suppress("UNCHECKED_CAST")
        val slidingWindow = health.details["slidingWindow"] as Map<String, Any>
        assertThat(slidingWindow["successful"]).isEqualTo(1)
        assertThat(slidingWindow["failed"]).isEqualTo(1)
        assertThat(slidingWindow["rejected"]).isEqualTo(0L)
    }

    private fun createCircuitBreaker(): CircuitBreaker {
        val config = CircuitBreakerConfig.custom()
            .failureRateThreshold(50f)
            .minimumNumberOfCalls(5)
            .slidingWindowSize(10)
            .waitDurationInOpenState(Duration.ofSeconds(60))
            .permittedNumberOfCallsInHalfOpenState(1)
            .build()
        return CircuitBreaker.of("test", config)
    }
}
