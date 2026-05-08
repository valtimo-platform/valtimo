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

import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.security.ExternalPluginServiceTokenKeyProvider
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.SignatureAlgorithm
import org.springframework.stereotype.Service
import java.time.Duration
import java.time.Instant
import java.util.Date

/**
 * Issues short-lived JWTs that authenticate the plugin host (or a URL plugin) when calling back
 * into GZAC on behalf of a specific external plugin configuration.
 *
 * The token carries no roles. Endpoint access is gated by [com.ritense.externalplugin.security.ExternalPluginEndpointAllowlistFilter].
 */
@Service
@SkipComponentScan
class ExternalPluginServiceTokenService(
    private val keyProvider: ExternalPluginServiceTokenKeyProvider,
    private val tokenTtl: Duration = Duration.ofHours(24),
) {

    fun issue(configuration: ExternalPluginConfiguration, definition: ExternalPluginDefinition): String {
        val now = Instant.now()
        val key = keyProvider.getKey(SignatureAlgorithm.HS256)
            ?: error("Service token signing key unavailable")

        return Jwts.builder()
            .setSubject("external-plugin:${definition.pluginId}:${configuration.id}")
            .claim(ExternalPluginServiceTokenKeyProvider.TYPE_CLAIM, ExternalPluginServiceTokenKeyProvider.TOKEN_TYPE)
            .claim(PLUGIN_CONFIG_ID_CLAIM, configuration.id.toString())
            .claim(PLUGIN_ID_CLAIM, definition.pluginId)
            .claim(PLUGIN_VERSION_CLAIM, definition.version)
            .setIssuer(ISSUER)
            .setIssuedAt(Date.from(now))
            .setExpiration(Date.from(now.plus(tokenTtl)))
            .signWith(key, SignatureAlgorithm.HS256)
            .compact()
    }

    companion object {
        const val PLUGIN_CONFIG_ID_CLAIM = "plugin_config_id"
        const val PLUGIN_ID_CLAIM = "plugin_id"
        const val PLUGIN_VERSION_CLAIM = "plugin_version"
        const val ISSUER = "valtimo-gzac"
    }
}
