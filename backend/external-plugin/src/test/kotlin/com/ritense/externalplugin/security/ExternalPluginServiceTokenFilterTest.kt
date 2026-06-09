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
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
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

class ExternalPluginServiceTokenFilterTest {

    private val secret = "test-secret-test-secret-test-secret-1234"
    private val keyProvider = ExternalPluginServiceTokenKeyProvider(secret)
    private val authenticator = ExternalPluginServiceTokenAuthenticator()
    private val filter = ExternalPluginServiceTokenFilter(keyProvider, authenticator)

    @AfterEach
    fun tearDown() {
        SecurityContextHolder.clearContext()
    }

    @Test
    fun `passes through and sets no principal when there is no authorization header`() {
        val request = MockHttpServletRequest("GET", "/api/v1/document/1")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(chain.request).isNotNull()
        assertThat(SecurityContextHolder.getContext().authentication).isNull()
    }

    @Test
    fun `passes through when the authorization header is not a bearer token`() {
        val request = MockHttpServletRequest("GET", "/api/v1/document/1")
        request.addHeader("Authorization", "Basic dXNlcjpwYXNz")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(chain.request).isNotNull()
        assertThat(SecurityContextHolder.getContext().authentication).isNull()
    }

    @Test
    fun `passes through a bearer token signed with a different key (e g a keycloak token)`() {
        val otherKey = Keys.hmacShaKeyFor("another-secret-another-secret-1234567".toByteArray())
        val request = MockHttpServletRequest("GET", "/api/v1/document/1")
        request.addHeader("Authorization", "Bearer ${token(key = otherKey)}")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(chain.request).isNotNull()
        assertThat(SecurityContextHolder.getContext().authentication).isNull()
        // The authorization header must be left intact so the downstream OAuth2 filter can handle it.
        assertThat((chain.request as HttpServletRequest).getHeader("Authorization")).isNotNull()
    }

    @Test
    fun `passes through a token signed with our key but carrying the wrong type claim`() {
        val request = MockHttpServletRequest("GET", "/api/v1/document/1")
        request.addHeader("Authorization", "Bearer ${token(type = "some-other-type")}")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(chain.request).isNotNull()
        assertThat(SecurityContextHolder.getContext().authentication).isNull()
    }

    @Test
    fun `authenticates a valid service token and strips the authorization header downstream`() {
        val configId = UUID.randomUUID()
        val request = MockHttpServletRequest("GET", "/api/v1/document/1")
        request.addHeader("Authorization", "Bearer ${token(configId = configId.toString())}")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        val authentication = SecurityContextHolder.getContext().authentication
        assertThat(authentication).isNotNull()
        val principal = authentication!!.principal
        assertThat(principal).isInstanceOf(ExternalPluginServicePrincipal::class.java)
        principal as ExternalPluginServicePrincipal
        assertThat(principal.pluginConfigId).isEqualTo(configId)
        assertThat(principal.pluginId).isEqualTo("case-summary")
        assertThat(principal.pluginVersion).isEqualTo("0.1.0")

        assertThat(chain.request).isNotNull()
        assertThat((chain.request as HttpServletRequest).getHeader("Authorization")).isNull()
    }

    private fun token(
        type: String = ExternalPluginServiceTokenKeyProvider.TOKEN_TYPE,
        configId: String = UUID.randomUUID().toString(),
        key: SecretKey = keyProvider.signingKey,
    ): String =
        Jwts.builder()
            .claim(ExternalPluginServiceTokenKeyProvider.TYPE_CLAIM, type)
            .claim(PLUGIN_CONFIG_ID_CLAIM, configId)
            .claim(PLUGIN_ID_CLAIM, "case-summary")
            .claim(PLUGIN_VERSION_CLAIM, "0.1.0")
            .signWith(key, Jwts.SIG.HS256)
            .compact()
}
