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

package com.ritense.valtimo.web.health

import com.ritense.valtimo.contract.bootstrap.BootstrapState
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.actuate.health.Status

class BootstrapHealthIndicatorTest {

    private val bootstrapState = BootstrapState()
    private val indicator = BootstrapHealthIndicator(bootstrapState)

    @Test
    fun `reports down while bootstrap in progress`() {
        val health = indicator.health()

        assertThat(health.status).isEqualTo(Status.DOWN)
        assertThat(health.details).containsEntry("status", BootstrapState.Status.IN_PROGRESS.name)
    }

    @Test
    fun `reports up after application fully ready`() {
        indicator.onApplicationFullyReady()

        val health = indicator.health()

        assertThat(health.status).isEqualTo(Status.UP)
        assertThat(health.details).containsEntry("status", BootstrapState.Status.COMPLETE.name)
    }

    @Test
    fun `stays down with failure detail when a step failed even after fully ready`() {
        bootstrapState.markFailed("liquibase", IllegalStateException("boom"))

        // A failed step is terminal: completion must not flip it to UP.
        indicator.onApplicationFullyReady()

        val health = indicator.health()

        assertThat(health.status).isEqualTo(Status.DOWN)
        assertThat(health.details).containsEntry("status", BootstrapState.Status.FAILED.name)

        @Suppress("UNCHECKED_CAST")
        val failures = health.details["failures"] as Map<String, String>
        assertThat(failures).containsEntry("liquibase", "boom")
    }
}
