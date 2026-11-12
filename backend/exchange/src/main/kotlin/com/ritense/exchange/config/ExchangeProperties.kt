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

package com.ritense.exchange.config

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.util.unit.DataSize
import java.net.URI
import java.time.Duration

@ConfigurationProperties(prefix = "valtimo.exchange")
data class ExchangeProperties(
    val url: String? = null,
    val connectTimeout: Duration = Duration.ofSeconds(5),
    val readTimeout: Duration = Duration.ofSeconds(30),
    val maxArtifactSize: DataSize = DataSize.ofMegabytes(50),
) {
    val baseUrl: String? = resolveBaseUrl(url)

    val enabled: Boolean
        get() = baseUrl != null

    companion object {
        private val logger = KotlinLogging.logger {}

        private fun resolveBaseUrl(url: String?): String? {
            if (url.isNullOrBlank()) return null
            val normalized = url.trim().trimEnd('/')
            val valid = runCatching { URI(normalized) }
                .getOrNull()
                ?.let { it.scheme?.lowercase() in setOf("http", "https") && !it.host.isNullOrBlank() }
                ?: false
            if (!valid) {
                logger.error { "valtimo.exchange.url must be an http(s) URL; the Exchange integration is disabled" }
                return null
            }
            return normalized
        }
    }
}
