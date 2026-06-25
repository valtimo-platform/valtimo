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

import com.ritense.externalplugin.security.ExternalPluginUserTokenKeyProvider
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.jsonwebtoken.Jwts
import org.springframework.stereotype.Service
import java.time.Duration
import java.time.Instant
import java.util.Date
import java.util.UUID

/**
 * Issues short-lived JWTs that let an external plugin's iframe read Valtimo data **on behalf of the
 * logged-in user**, through the Angular parent-proxy. The token freezes the user's login + roles for
 * at most [maxTtl] so GZAC can evaluate PBAC without a Keycloak round-trip on every proxied call.
 *
 * Crucially — unlike [ExternalPluginServiceTokenService] — the resulting authentication is a *real
 * user* (not a system principal) and the recognising filter does **not** run without authorization:
 * PBAC stays fully active. Reach is then intersected with the configuration's granted-endpoint
 * allowlist.
 */
@Service
@SkipComponentScan
class ExternalPluginUserTokenService(
    private val keyProvider: ExternalPluginUserTokenKeyProvider,
    tokenTtl: Duration = DEFAULT_TTL,
) {

    /** Hard cap: a downscoped user token is never longer-lived than [MAX_TTL]. */
    private val ttl: Duration = if (tokenTtl > MAX_TTL) MAX_TTL else tokenTtl

    fun issue(userLogin: String, roles: List<String>, configurationId: UUID): IssuedUserToken {
        require(userLogin.isNotBlank()) { "userLogin must not be blank" }
        val now = Instant.now()
        val expiresAt = now.plus(ttl)

        val token = Jwts.builder()
            .subject(userLogin)
            .claim(ExternalPluginUserTokenKeyProvider.TYPE_CLAIM, ExternalPluginUserTokenKeyProvider.TOKEN_TYPE)
            .claim(ROLES_CLAIM, roles)
            .claim(PLUGIN_CONFIG_ID_CLAIM, configurationId.toString())
            .issuer(ISSUER)
            .issuedAt(Date.from(now))
            .expiration(Date.from(expiresAt))
            .signWith(keyProvider.signingKey, Jwts.SIG.HS256)
            .compact()

        return IssuedUserToken(token, expiresAt)
    }

    companion object {
        const val ROLES_CLAIM = "roles"
        const val PLUGIN_CONFIG_ID_CLAIM = "plugin_config_id"
        const val ISSUER = "valtimo-gzac"

        val DEFAULT_TTL: Duration = Duration.ofMinutes(15)
        val MAX_TTL: Duration = Duration.ofMinutes(15)
    }
}

data class IssuedUserToken(
    val token: String,
    val expiresAt: Instant,
)
