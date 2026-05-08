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

package com.ritense.externalplugin.security

import com.ritense.externalplugin.service.ExternalPluginServiceTokenService.Companion.PLUGIN_CONFIG_ID_CLAIM
import com.ritense.externalplugin.service.ExternalPluginServiceTokenService.Companion.PLUGIN_ID_CLAIM
import com.ritense.externalplugin.service.ExternalPluginServiceTokenService.Companion.PLUGIN_VERSION_CLAIM
import com.ritense.valtimo.contract.security.jwt.TokenAuthenticator
import io.jsonwebtoken.Claims
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.Authentication
import java.util.UUID

class ExternalPluginServiceTokenAuthenticator : TokenAuthenticator {

    override fun supports(claims: Claims): Boolean =
        claims[ExternalPluginServiceTokenKeyProvider.TYPE_CLAIM] ==
            ExternalPluginServiceTokenKeyProvider.TOKEN_TYPE

    override fun authenticate(jwt: String, claims: Claims): Authentication {
        val configId = claims.get(PLUGIN_CONFIG_ID_CLAIM, String::class.java)
            ?: error("$PLUGIN_CONFIG_ID_CLAIM claim missing on external plugin service token")
        val pluginId = claims.get(PLUGIN_ID_CLAIM, String::class.java)
            ?: error("$PLUGIN_ID_CLAIM claim missing on external plugin service token")
        val pluginVersion = claims.get(PLUGIN_VERSION_CLAIM, String::class.java)
            ?: error("$PLUGIN_VERSION_CLAIM claim missing on external plugin service token")

        val principal = ExternalPluginServicePrincipal(
            pluginConfigId = UUID.fromString(configId),
            pluginId = pluginId,
            pluginVersion = pluginVersion,
        )
        return UsernamePasswordAuthenticationToken(principal, jwt, emptyList())
    }
}
