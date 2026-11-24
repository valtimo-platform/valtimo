/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.notificatiesapi.health

import com.ritense.notificatiesapi.config.NotificatiesApiProcessingProperties
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus
import com.ritense.notificatiesapi.repository.NotificatiesApiInboundEventRepository
import org.springframework.boot.health.contributor.AbstractHealthIndicator
import org.springframework.boot.health.contributor.Health
import org.springframework.boot.health.contributor.Status

class NotificatiesApiInboundEventHealthIndicator(
    private val inboundEventRepository: NotificatiesApiInboundEventRepository,
    private val processingProperties: NotificatiesApiProcessingProperties
) : AbstractHealthIndicator() {

    override fun doHealthCheck(builder: Health.Builder) {
        val threshold = processingProperties.failedCountHealthThreshold
        if (threshold <= 0) {
            builder.up()
            return
        }

        val failedCount = inboundEventRepository.countByStatus(NotificatiesApiInboundEventStatus.FAILED)
        if (failedCount > threshold) {
            builder.status(Status("RESTRICTED"))
                .withDetail("failedCount", failedCount)
                .withDetail("threshold", threshold)
        } else {
            builder.up().withDetail("failedCount", failedCount)
        }
    }
}
