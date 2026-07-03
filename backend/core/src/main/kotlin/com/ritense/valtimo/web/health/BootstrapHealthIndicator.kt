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
import com.ritense.valtimo.contract.event.ApplicationFullyReadyEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.actuate.health.Health
import org.springframework.boot.actuate.health.HealthIndicator
import org.springframework.context.event.EventListener

/**
 * Reports `UP` only once the application's startup bootstrap (Liquibase migrations, the Operaton
 * schema migration and all autodeployments) has completed successfully, and `DOWN` while it is
 * still in progress or has failed.
 *
 * Registered (as bean `bootstrap`) in the `readiness` and `startup` health groups so Kubernetes
 * only routes traffic to the pod once bootstrap is done. Completion is signalled by
 * [ApplicationFullyReadyEvent], which is published after all `ApplicationReadyEvent` autodeployment
 * listeners have run.
 */
class BootstrapHealthIndicator(
    private val bootstrapState: BootstrapState
) : HealthIndicator {

    @EventListener(ApplicationFullyReadyEvent::class)
    fun onApplicationFullyReady() {
        bootstrapState.markComplete()
        logger.debug { "Bootstrap marked complete; readiness/startup health groups can now report UP" }
    }

    override fun health(): Health {
        val status = bootstrapState.status
        val builder = if (status == BootstrapState.Status.COMPLETE) Health.up() else Health.down()
        builder.withDetail("status", status.name)
        if (bootstrapState.failures.isNotEmpty()) {
            builder.withDetail("failures", bootstrapState.failures)
        }
        return builder.build()
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
