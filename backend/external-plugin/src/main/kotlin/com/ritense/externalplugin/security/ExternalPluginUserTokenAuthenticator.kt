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

import com.ritense.externalplugin.service.ExternalPluginUserTokenService.Companion.PLUGIN_CONFIG_ID_CLAIM
import com.ritense.externalplugin.service.ExternalPluginUserTokenService.Companion.ROLES_CLAIM
import com.ritense.valtimo.contract.security.jwt.TokenAuthenticator
import io.jsonwebtoken.Claims
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.Authentication
import org.springframework.security.core.authority.SimpleGrantedAuthority
import java.util.UUID

/**
 * Rebuilds a *real user* [Authentication] from an external-plugin user token. The authorities are the
 * roles frozen into the token, so `SecurityUtils.getCurrentUserRoles()` (and therefore PBAC) sees the
 * user's actual roles — no Keycloak round-trip required for the (≤15 min) lifetime of the token.
 */
class ExternalPluginUserTokenAuthenticator : TokenAuthenticator {

    override fun supports(claims: Claims): Boolean =
        claims[ExternalPluginUserTokenKeyProvider.TYPE_CLAIM] ==
            ExternalPluginUserTokenKeyProvider.TOKEN_TYPE

    override fun authenticate(jwt: String, claims: Claims): Authentication {
        val username = claims.subject
            ?: error("subject claim missing on external plugin user token")
        val configId = claims.get(PLUGIN_CONFIG_ID_CLAIM, String::class.java)
            ?: error("$PLUGIN_CONFIG_ID_CLAIM claim missing on external plugin user token")

        @Suppress("UNCHECKED_CAST")
        val roles = (claims[ROLES_CLAIM] as? List<String>) ?: emptyList()

        val principal = ExternalPluginUserPrincipal(
            userLogin = username,
            roles = roles,
            pluginConfigId = UUID.fromString(configId),
        )
        val authorities = roles.map { SimpleGrantedAuthority(it) }
        return UsernamePasswordAuthenticationToken(principal, jwt, authorities)
    }
}
