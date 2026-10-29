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
 * Base for the external-plugin JWT signing key providers. The key is derived from
 * `valtimo.plugin.encryption-secret` via `SHA-256(secret + "|" + domain)`:
 *
 * - The hash makes the same configuration work regardless of the secret's raw length (AES-128 uses
 *   16 bytes; HMAC-SHA256 needs 32) and prevents recovering the AES key from an exfiltrated token.
 * - The domain suffix gives each token kind (`service`, `user`) its **own** key, so a token of one
 *   kind can never validate against the other kind's parser — the `type` claim is a routing hint,
 *   not the security boundary.
 */
abstract class ExternalPluginTokenKeyProvider(
    secret: String,
    domain: String,
) : SecretKeyProvider {

    init {
        require(secret.isNotBlank()) { "valtimo.plugin.encryption-secret must not be blank" }
    }

    val signingKey: SecretKey = Keys.hmacShaKeyFor(
        MessageDigest.getInstance("SHA-256").digest("$secret|$domain".toByteArray(Charsets.UTF_8))
    )

    /** The value of the `type` claim this provider's tokens carry. */
    protected abstract val tokenType: String

    @Suppress("DEPRECATION")
    override fun supports(algorithm: SignatureAlgorithm, claims: Claims): Boolean =
        algorithm == SignatureAlgorithm.HS256 && tokenType == claims[TYPE_CLAIM]

    @Suppress("DEPRECATION")
    override fun getKey(algorithm: SignatureAlgorithm): Key? =
        if (algorithm == SignatureAlgorithm.HS256) signingKey else null

    companion object {
        const val TYPE_CLAIM = "type"
    }
}
