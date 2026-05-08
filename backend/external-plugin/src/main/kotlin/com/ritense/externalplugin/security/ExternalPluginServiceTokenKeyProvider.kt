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

class ExternalPluginServiceTokenKeyProvider(secret: String) : SecretKeyProvider {

    init {
        require(secret.isNotBlank()) { "valtimo.external-plugin.service-token-secret must not be blank" }
        require(secret.toByteArray(Charsets.UTF_8).size >= 32) {
            "valtimo.external-plugin.service-token-secret must be at least 32 bytes for HmacSHA256"
        }
    }

    private val key: Key = Keys.hmacShaKeyFor(secret.toByteArray(Charsets.UTF_8))

    override fun supports(algorithm: SignatureAlgorithm, claims: Claims): Boolean =
        algorithm == SignatureAlgorithm.HS256 && TOKEN_TYPE == claims[TYPE_CLAIM]

    override fun getKey(algorithm: SignatureAlgorithm): Key? =
        if (algorithm == SignatureAlgorithm.HS256) key else null

    companion object {
        const val TYPE_CLAIM = "type"
        const val TOKEN_TYPE = "external_plugin_service"
    }
}
