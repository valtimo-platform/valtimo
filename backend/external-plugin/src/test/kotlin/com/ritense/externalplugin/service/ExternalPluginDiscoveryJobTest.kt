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

package com.ritense.externalplugin.service

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.springframework.scheduling.annotation.Scheduled
import java.lang.reflect.Modifier

/**
 * The polling job's *lock* is the multi-replica guarantee: without ShedLock every replica
 * would health-check the same hosts, upsert the same definitions and re-push the same configurations
 * on every tick. None of that fails visibly — it just multiplies host load and races token pushes —
 * so the annotations are pinned here.
 *
 * ShedLock proxies the bean with CGLIB, which silently does nothing if the class or method is final:
 * Kotlin classes are final by default and this bean is registered via `@Bean` (so the kotlin-spring
 * all-open plugin does not open it), hence the explicit `open` modifiers this test guards.
 */
class ExternalPluginDiscoveryJobTest {

    private val pollMethod = ExternalPluginDiscoveryJob::class.java.getDeclaredMethod("poll")

    @Test
    fun `poll delegates the whole cycle to the discovery service`() {
        val discoveryService = mock<ExternalPluginDiscoveryService>()

        ExternalPluginDiscoveryJob(discoveryService).poll()

        verify(discoveryService).discoverAll()
    }

    @Test
    fun `the job class and its poll method stay open so ShedLock's CGLIB proxy can intercept`() {
        assertThat(Modifier.isFinal(ExternalPluginDiscoveryJob::class.java.modifiers))
            .withFailMessage("ExternalPluginDiscoveryJob must be open — a final class cannot be CGLIB-proxied")
            .isFalse()
        assertThat(Modifier.isFinal(pollMethod.modifiers))
            .withFailMessage("poll() must be open or ShedLock silently stops locking")
            .isFalse()
    }

    @Test
    fun `poll is scheduled on the configurable polling rate with a 60s default`() {
        val scheduled = pollMethod.getAnnotation(Scheduled::class.java)

        assertThat(scheduled).isNotNull()
        // The default must stay comfortably below the service-token TTL (10m) — the poll *is* the
        // token refresh mechanism.
        assertThat(scheduled.fixedRateString)
            .isEqualTo("\${valtimo.external-plugin.polling.rate:PT60S}")
    }

    @Test
    fun `poll is guarded by a named ShedLock with the documented lock window`() {
        val lock = pollMethod.getAnnotation(SchedulerLock::class.java)

        assertThat(lock).isNotNull()
        assertThat(lock.name).isEqualTo("ExternalPluginDiscoveryJob_poll")
        // lockAtLeastFor keeps a fast cycle from letting a second replica pick up the same tick;
        // lockAtMostFor caps a crashed holder so polling resumes without operator intervention.
        assertThat(lock.lockAtLeastFor).isEqualTo("PT10S")
        assertThat(lock.lockAtMostFor).isEqualTo("PT10M")
    }
}
