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
    val url: String? = DEFAULT_URL,
    val connectTimeout: Duration = Duration.ofSeconds(5),
    val readTimeout: Duration = Duration.ofSeconds(30),
    val maxArtifactSize: DataSize = DataSize.ofMegabytes(50),
    val assetOrigins: List<String> = listOf(DEFAULT_ASSET_ORIGIN),
) {
    val baseUrl: String? = resolveBaseUrl(url)

    val resolvedAssetOrigins: List<String> = assetOrigins.mapNotNull { resolveAssetSource(it) }.distinct()

    val enabled: Boolean
        get() = baseUrl != null

    companion object {
        const val DEFAULT_URL = "https://exchange.gzac.nl"
        const val DEFAULT_ASSET_ORIGIN = "https://s3.de.io.cloud.ovh.net/ritense-external-extra-prod-exchange"

        private val logger = KotlinLogging.logger {}

        // Origin plus path with trailing slash: a CSP path without it matches one URL only
        private fun resolveAssetSource(value: String): String? {
            if (value.isBlank()) return null
            val uri = runCatching { URI(value.trim()) }.getOrNull()
            val scheme = uri?.scheme?.lowercase()
            val host = uri?.host
            val path = uri?.rawPath.orEmpty()
            val invalid = uri == null || scheme !in setOf("http", "https") || host.isNullOrBlank() ||
                path.any { it in ";," }
            if (invalid) {
                logger.error { "Ignoring invalid valtimo.exchange.asset-origins entry: $value" }
                return null
            }
            val port = if (uri.port == -1) "" else ":${uri.port}"
            return "$scheme://${host.lowercase()}$port${path.trimEnd('/')}/"
        }

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
