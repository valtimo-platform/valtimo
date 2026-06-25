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

import com.ritense.valtimo.contract.security.jwt.provider.SecretKeyProvider
import io.jsonwebtoken.Claims
import io.jsonwebtoken.SignatureAlgorithm
import io.jsonwebtoken.security.Keys
import java.security.Key
import java.security.MessageDigest
import javax.crypto.SecretKey

/**
 * JWT signing key for external-plugin **user** tokens. Derived from `valtimo.plugin.encryption-secret`
 * via SHA-256, exactly like [ExternalPluginServiceTokenKeyProvider] — the `type` claim is what tells
 * the two token kinds apart, not the key.
 *
 * Unlike the service token, a user token is **not** a system credential: it carries the logged-in
 * user's login and roles so GZAC runs normal PBAC against them. Endpoint reach is further intersected
 * with the plugin configuration's granted-endpoint allowlist (see [ExternalPluginEndpointAllowlistFilter]).
 */
class ExternalPluginUserTokenKeyProvider(secret: String) : SecretKeyProvider {

    init {
        require(secret.isNotBlank()) { "valtimo.plugin.encryption-secret must not be blank" }
    }

    val signingKey: SecretKey = Keys.hmacShaKeyFor(
        MessageDigest.getInstance("SHA-256").digest(secret.toByteArray(Charsets.UTF_8))
    )

    @Suppress("DEPRECATION")
    override fun supports(algorithm: SignatureAlgorithm, claims: Claims): Boolean =
        algorithm == SignatureAlgorithm.HS256 && TOKEN_TYPE == claims[TYPE_CLAIM]

    @Suppress("DEPRECATION")
    override fun getKey(algorithm: SignatureAlgorithm): Key? =
        if (algorithm == SignatureAlgorithm.HS256) signingKey else null

    companion object {
        const val TYPE_CLAIM = "type"
        const val TOKEN_TYPE = "external_plugin_user"
    }
}
