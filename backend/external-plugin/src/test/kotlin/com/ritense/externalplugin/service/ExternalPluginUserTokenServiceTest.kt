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
import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jwts
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Duration
import java.util.UUID

class ExternalPluginUserTokenServiceTest {

    private val secret = "test-secret-test-secret-test-secret-1234"
    private val keyProvider = ExternalPluginUserTokenKeyProvider(secret)

    @Test
    fun `mints a token with the expected claims`() {
        val configId = UUID.randomUUID()
        val service = ExternalPluginUserTokenService(keyProvider)

        val issued = service.issue("john.doe", listOf("ROLE_USER", "ROLE_ADMIN"), configId)
        val claims = parse(issued.token)

        assertThat(claims.subject).isEqualTo("john.doe")
        assertThat(claims[ExternalPluginUserTokenKeyProvider.TYPE_CLAIM])
            .isEqualTo(ExternalPluginUserTokenKeyProvider.TOKEN_TYPE)
        assertThat(claims[ExternalPluginUserTokenService.PLUGIN_CONFIG_ID_CLAIM])
            .isEqualTo(configId.toString())
        @Suppress("UNCHECKED_CAST")
        assertThat(claims[ExternalPluginUserTokenService.ROLES_CLAIM] as List<String>)
            .containsExactly("ROLE_USER", "ROLE_ADMIN")
    }

    @Test
    fun `defaults to a 15 minute lifetime`() {
        val claims = parse(ExternalPluginUserTokenService(keyProvider).issue("u", emptyList(), UUID.randomUUID()).token)

        assertThat(Duration.between(claims.issuedAt.toInstant(), claims.expiration.toInstant()))
            .isEqualTo(Duration.ofMinutes(15))
    }

    @Test
    fun `caps an over-long configured lifetime at 15 minutes`() {
        val service = ExternalPluginUserTokenService(keyProvider, Duration.ofHours(24))

        val claims = parse(service.issue("u", emptyList(), UUID.randomUUID()).token)

        assertThat(Duration.between(claims.issuedAt.toInstant(), claims.expiration.toInstant()))
            .isEqualTo(Duration.ofMinutes(15))
    }

    private fun parse(token: String): Claims =
        Jwts.parser()
            .verifyWith(keyProvider.signingKey)
            .build()
            .parseSignedClaims(token)
            .payload
}
