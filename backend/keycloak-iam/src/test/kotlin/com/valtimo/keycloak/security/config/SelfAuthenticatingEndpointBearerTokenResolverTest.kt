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

package com.valtimo.keycloak.security.config

import com.ritense.valtimo.contract.security.config.SelfAuthenticatingEndpoints
import org.junit.jupiter.api.Test
import org.springframework.http.HttpHeaders.AUTHORIZATION
import org.springframework.http.HttpMethod.POST
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher
import org.springframework.security.web.util.matcher.RequestMatcher
import kotlin.test.assertEquals
import kotlin.test.assertNull

internal class SelfAuthenticatingEndpointBearerTokenResolverTest {

    @Test
    fun `should not resolve a token on a self-authenticating endpoint`() {
        val resolver = SelfAuthenticatingEndpointBearerTokenResolver(listOf(callbackEndpoint()))

        assertNull(resolver.resolve(request(POST.name(), "/api/v1/notificatiesapi/callback")))
    }

    @Test
    fun `should resolve a token on any other endpoint`() {
        val resolver = SelfAuthenticatingEndpointBearerTokenResolver(listOf(callbackEndpoint()))

        assertEquals("mysecret", resolver.resolve(request(POST.name(), "/api/v1/other")))
    }

    @Test
    fun `should resolve a token on a self-authenticating endpoint requested with another method`() {
        val resolver = SelfAuthenticatingEndpointBearerTokenResolver(listOf(callbackEndpoint()))

        assertEquals("mysecret", resolver.resolve(request("GET", "/api/v1/notificatiesapi/callback")))
    }

    @Test
    fun `should resolve a token when no endpoint authenticates itself`() {
        val resolver = SelfAuthenticatingEndpointBearerTokenResolver(emptyList())

        assertEquals("mysecret", resolver.resolve(request(POST.name(), "/api/v1/notificatiesapi/callback")))
    }

    private fun callbackEndpoint() = object : SelfAuthenticatingEndpoints {
        override fun getSelfAuthenticatingEndpoints(): List<RequestMatcher> =
            listOf(antMatcher(POST, "/api/v1/notificatiesapi/callback"))
    }

    private fun request(method: String, servletPath: String) = MockHttpServletRequest(method, servletPath).apply {
        this.servletPath = servletPath
        addHeader(AUTHORIZATION, "Bearer mysecret")
    }
}
