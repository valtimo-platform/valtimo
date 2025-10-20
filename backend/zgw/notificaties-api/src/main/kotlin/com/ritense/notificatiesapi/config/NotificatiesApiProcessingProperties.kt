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

package com.ritense.notificatiesapi.config

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

@ConfigurationProperties(prefix = "valtimo.notificaties-api.processing")
class NotificatiesApiProcessingProperties {
    var enabled: Boolean = true
    var pollInterval: Duration = Duration.ofMinutes(1)
    var batchSize: Int = 5
    var initialRetries: Int = 3
    var retryDelay: Duration = Duration.ofMinutes(5)
    var retryBackoffMultiplier: Double = 2.0
    var retentionPeriod: Duration = Duration.ofDays(30)
    var receivedWarningThreshold: Duration = Duration.ofHours(2)
    var failedCountHealthThreshold: Long = 0
}
