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

package com.ritense.externalplugin.web.rest

import com.ritense.externalplugin.security.ExternalPluginServicePrincipal
import com.ritense.externalplugin.security.ExternalPluginUserPrincipal
import com.ritense.externalplugin.security.ExternalPluginUserTokenKeyProvider
import com.ritense.externalplugin.service.ExternalPluginUserTokenService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.server.ResponseStatusException
import java.time.temporal.ChronoUnit
import java.util.UUID

class ExternalPluginUserTokenIntrospectionResourceTest {

    private val keyProvider = ExternalPluginUserTokenKeyProvider("introspection-test-secret")
    private val userTokenService = ExternalPluginUserTokenService(keyProvider)
    private val resource = ExternalPluginUserTokenIntrospectionResource(keyProvider)

    private val configurationId: UUID = UUID.randomUUID()

    @AfterEach
    fun tearDown() {
        SecurityContextHolder.clearContext()
    }

    @Test
    fun `returns the token's subject, configuration id and expiry for a user-token principal`() {
        val issued = userTokenService.issue("john@example.com", listOf("ROLE_USER"), configurationId, 0)
        val principal = ExternalPluginUserPrincipal("john@example.com", listOf("ROLE_USER"), configurationId)
        // Mirrors ExternalPluginUserTokenAuthenticator: the raw JWT rides along as credentials.
        SecurityContextHolder.getContext().authentication =
            UsernamePasswordAuthenticationToken(principal, issued.token, principal.authorities)

        val response = resource.introspect()

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        val body = response.body!!
        assertThat(body.subject).isEqualTo("john@example.com")
        assertThat(body.configurationId).isEqualTo(configurationId)
        // JWT `exp` has second precision — compare after truncating the issued instant.
        assertThat(body.expiresAt).isEqualTo(issued.expiresAt.truncatedTo(ChronoUnit.SECONDS))
    }

    @Test
    fun `rejects a regular authenticated user with 403`() {
        SecurityContextHolder.getContext().authentication = UsernamePasswordAuthenticationToken(
            "jane@example.com",
            "n/a",
            listOf(SimpleGrantedAuthority("ROLE_USER")),
        )

        assertThatThrownBy { resource.introspect() }
            .isInstanceOf(ResponseStatusException::class.java)
            .extracting { (it as ResponseStatusException).statusCode }
            .isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `rejects a plugin service-token principal with 403`() {
        val principal = ExternalPluginServicePrincipal(configurationId, "case-summary", "0.1.0")
        SecurityContextHolder.getContext().authentication =
            UsernamePasswordAuthenticationToken(principal, "service-token", emptyList())

        assertThatThrownBy { resource.introspect() }
            .isInstanceOf(ResponseStatusException::class.java)
            .extracting { (it as ResponseStatusException).statusCode }
            .isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `rejects an unauthenticated caller with 403`() {
        SecurityContextHolder.clearContext()

        assertThatThrownBy { resource.introspect() }
            .isInstanceOf(ResponseStatusException::class.java)
            .extracting { (it as ResponseStatusException).statusCode }
            .isEqualTo(HttpStatus.FORBIDDEN)
    }
}
