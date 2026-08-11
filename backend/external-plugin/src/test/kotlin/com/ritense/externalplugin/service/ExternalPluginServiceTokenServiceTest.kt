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
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.security.ExternalPluginServiceTokenKeyProvider
import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jwts
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Duration
import java.util.UUID

class ExternalPluginServiceTokenServiceTest {

    private val secret = "test-secret-test-secret-test-secret-1234"
    private val keyProvider = ExternalPluginServiceTokenKeyProvider(secret)

    @Test
    fun `defaults to a 10 minute token lifetime`() {
        // Deliberately short: the discovery poll re-pushes a fresh token every ~60s, so a longer
        // default would only extend how long a leaked token stays usable.
        val claims = issue(ExternalPluginServiceTokenService(keyProvider))

        assertThat(Duration.between(claims.issuedAt.toInstant(), claims.expiration.toInstant()))
            .isEqualTo(Duration.ofMinutes(10))
    }

    @Test
    fun `honours the configured token lifetime`() {
        val ttl = Duration.ofMinutes(15)

        val claims = issue(ExternalPluginServiceTokenService(keyProvider, ttl))

        assertThat(Duration.between(claims.issuedAt.toInstant(), claims.expiration.toInstant()))
            .isEqualTo(ttl)
    }

    @Test
    fun `stamps the configuration's current token generation into the token`() {
        val claims = issue(
            ExternalPluginServiceTokenService(keyProvider),
            configuration = configuration(tokenGeneration = 5),
        )

        val generation = claims[ExternalPluginServiceTokenService.TOKEN_GENERATION_CLAIM] as Number
        assertThat(generation.toLong()).isEqualTo(5L)
    }

    private fun issue(
        service: ExternalPluginServiceTokenService,
        configuration: ExternalPluginConfiguration = configuration(),
    ): Claims =
        Jwts.parser()
            .verifyWith(keyProvider.signingKey)
            .build()
            .parseSignedClaims(service.issue(configuration, definition()))
            .payload

    private fun configuration(tokenGeneration: Long = 0) = ExternalPluginConfiguration(
        id = UUID.randomUUID(),
        definitionId = UUID.randomUUID(),
        title = "test",
        tokenGeneration = tokenGeneration,
    )

    private fun definition() = ExternalPluginDefinition(
        id = UUID.randomUUID(),
        pluginId = "case-summary",
        version = "0.1.0",
        hostId = UUID.randomUUID(),
        baseUrl = "http://localhost:8090",
        status = ExternalPluginDefinitionStatus.AVAILABLE,
    )
}
