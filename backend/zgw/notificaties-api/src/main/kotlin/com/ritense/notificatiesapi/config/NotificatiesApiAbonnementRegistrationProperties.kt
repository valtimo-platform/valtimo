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

package com.ritense.notificatiesapi.config

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

/**
 * Retry policy for the abonnement registration that runs after the application has fully started.
 *
 * The backoff is convergent: it stops as soon as registration succeeds. [maxDuration] is only a
 * backstop so that a genuinely misconfigured `callbackUrl` does not retry forever. The default
 * matches the startup probe budget of the GZAC Helm chart (90 failures x 10s).
 */
@ConfigurationProperties(prefix = "valtimo.zgw.abonnement-registration")
class NotificatiesApiAbonnementRegistrationProperties {
    var initialBackoff: Duration = Duration.ofSeconds(2)
    var maxBackoff: Duration = Duration.ofSeconds(30)
    var maxDuration: Duration = Duration.ofMinutes(15)
}
