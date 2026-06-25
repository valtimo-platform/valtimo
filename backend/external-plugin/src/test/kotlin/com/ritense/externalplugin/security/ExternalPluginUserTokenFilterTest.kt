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

import com.ritense.authorization.AuthorizationContext
import com.ritense.externalplugin.service.ExternalPluginUserTokenService.Companion.PLUGIN_CONFIG_ID_CLAIM
import com.ritense.externalplugin.service.ExternalPluginUserTokenService.Companion.ROLES_CLAIM
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockFilterChain
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder
import java.util.UUID
import javax.crypto.SecretKey

class ExternalPluginUserTokenFilterTest {

    private val secret = "test-secret-test-secret-test-secret-1234"
    private val keyProvider = ExternalPluginUserTokenKeyProvider(secret)
    private val authenticator = ExternalPluginUserTokenAuthenticator()
    private val filter = ExternalPluginUserTokenFilter(keyProvider, authenticator)

    @AfterEach
    fun tearDown() {
        SecurityContextHolder.clearContext()
    }

    @Test
    fun `passes through when there is no authorization header`() {
        val chain = MockFilterChain()
        filter.doFilter(MockHttpServletRequest("GET", "/api/v1/document/1"), MockHttpServletResponse(), chain)

        assertThat(chain.request).isNotNull()
        assertThat(SecurityContextHolder.getContext().authentication).isNull()
    }

    @Test
    fun `passes through a bearer token signed with a different key`() {
        val otherKey = Keys.hmacShaKeyFor("another-secret-another-secret-1234567".toByteArray())
        val request = MockHttpServletRequest("GET", "/api/v1/document/1")
        request.addHeader("Authorization", "Bearer ${token(key = otherKey)}")
        val chain = MockFilterChain()

        filter.doFilter(request, MockHttpServletResponse(), chain)

        assertThat(SecurityContextHolder.getContext().authentication).isNull()
        assertThat((chain.request as HttpServletRequest).getHeader("Authorization")).isNotNull()
    }

    @Test
    fun `passes through a token with the wrong type claim`() {
        val request = MockHttpServletRequest("GET", "/api/v1/document/1")
        request.addHeader("Authorization", "Bearer ${token(type = "external_plugin_service")}")
        val chain = MockFilterChain()

        filter.doFilter(request, MockHttpServletResponse(), chain)

        assertThat(SecurityContextHolder.getContext().authentication).isNull()
    }

    @Test
    fun `authenticates a valid user token, rebuilds the user authorities and strips the header`() {
        val configId = UUID.randomUUID()
        val request = MockHttpServletRequest("GET", "/api/v1/document/1")
        request.addHeader(
            "Authorization",
            "Bearer ${token(configId = configId.toString(), roles = listOf("ROLE_USER", "ROLE_ADMIN"))}",
        )
        val chain = MockFilterChain()

        filter.doFilter(request, MockHttpServletResponse(), chain)

        val authentication = SecurityContextHolder.getContext().authentication
        assertThat(authentication).isNotNull()
        assertThat(authentication!!.name).isEqualTo("john.doe")
        assertThat(authentication.authorities.map { it.authority })
            .containsExactlyInAnyOrder("ROLE_USER", "ROLE_ADMIN")
        val principal = authentication.principal
        assertThat(principal).isInstanceOf(ExternalPluginUserPrincipal::class.java)
        assertThat((principal as ExternalPluginUserPrincipal).pluginConfigId).isEqualTo(configId)

        // The Authorization header must be hidden so BearerTokenAuthenticationFilter does not re-process it.
        assertThat((chain.request as HttpServletRequest).getHeader("Authorization")).isNull()
    }

    @Test
    fun `does not bypass authorization - PBAC stays active during the chain`() {
        val request = MockHttpServletRequest("GET", "/api/v1/document/1")
        request.addHeader("Authorization", "Bearer ${token()}")

        var ignoreAuthorizationDuringChain: Boolean? = null
        val chain = FilterChain { _, _ ->
            ignoreAuthorizationDuringChain = AuthorizationContext.ignoreAuthorization
        }

        filter.doFilter(request, MockHttpServletResponse(), chain)

        // The service-token filter would flip this to true; the user-token filter must NOT.
        assertThat(ignoreAuthorizationDuringChain).isFalse()
    }

    private fun token(
        type: String = ExternalPluginUserTokenKeyProvider.TOKEN_TYPE,
        configId: String = UUID.randomUUID().toString(),
        roles: List<String> = listOf("ROLE_USER"),
        key: SecretKey = keyProvider.signingKey,
    ): String =
        Jwts.builder()
            .subject("john.doe")
            .claim(ExternalPluginUserTokenKeyProvider.TYPE_CLAIM, type)
            .claim(PLUGIN_CONFIG_ID_CLAIM, configId)
            .claim(ROLES_CLAIM, roles)
            .signWith(key, Jwts.SIG.HS256)
            .compact()
}
