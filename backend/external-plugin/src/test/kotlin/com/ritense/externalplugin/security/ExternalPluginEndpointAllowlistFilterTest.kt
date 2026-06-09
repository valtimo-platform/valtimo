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

import com.ritense.externalplugin.domain.ExternalPluginGrantedEndpoint
import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.mock.web.MockFilterChain
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import java.util.UUID

class ExternalPluginEndpointAllowlistFilterTest {

    private val grantedEndpointRepository = mock<ExternalPluginGrantedEndpointRepository>()
    private val filter = ExternalPluginEndpointAllowlistFilter(grantedEndpointRepository)

    @AfterEach
    fun tearDown() {
        SecurityContextHolder.clearContext()
    }

    @Test
    fun `passes through when the principal is not an external plugin service principal`() {
        SecurityContextHolder.getContext().authentication =
            UsernamePasswordAuthenticationToken("a-regular-user", "credentials", emptyList())
        val request = request("GET", "/api/v1/document/123")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(chain.request).isNotNull()
        assertThat(response.status).isEqualTo(200)
        verify(grantedEndpointRepository, never()).findAllByConfigurationId(any())
    }

    @Test
    fun `passes through when there is no authentication at all`() {
        val request = request("GET", "/api/v1/document/123")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(chain.request).isNotNull()
        assertThat(response.status).isEqualTo(200)
        verify(grantedEndpointRepository, never()).findAllByConfigurationId(any())
    }

    @Test
    fun `blocks access to external-plugin management endpoints`() {
        val configId = UUID.randomUUID()
        authenticateAsPlugin(configId)
        val request = request("GET", "/api/management/v1/external-plugin/host")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(response.status).isEqualTo(403)
        assertThat(chain.request).isNull()
        verify(grantedEndpointRepository, never()).findAllByConfigurationId(any())
    }

    @Test
    fun `allows a request that matches a granted method and pattern`() {
        val configId = UUID.randomUUID()
        authenticateAsPlugin(configId)
        whenever(grantedEndpointRepository.findAllByConfigurationId(configId))
            .thenReturn(listOf(grantedEndpoint(configId, "GET", "/api/v1/document/*")))
        val request = request("GET", "/api/v1/document/123")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(response.status).isEqualTo(200)
        assertThat(chain.request).isNotNull()
    }

    @Test
    fun `blocks a request whose method is not granted`() {
        val configId = UUID.randomUUID()
        authenticateAsPlugin(configId)
        whenever(grantedEndpointRepository.findAllByConfigurationId(configId))
            .thenReturn(listOf(grantedEndpoint(configId, "GET", "/api/v1/document/*")))
        val request = request("POST", "/api/v1/document/123")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(response.status).isEqualTo(403)
        assertThat(chain.request).isNull()
    }

    @Test
    fun `blocks a request whose path is not granted`() {
        val configId = UUID.randomUUID()
        authenticateAsPlugin(configId)
        whenever(grantedEndpointRepository.findAllByConfigurationId(configId))
            .thenReturn(listOf(grantedEndpoint(configId, "GET", "/api/v1/document/*")))
        val request = request("GET", "/api/v1/case/123")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(response.status).isEqualTo(403)
        assertThat(chain.request).isNull()
    }

    @Test
    fun `denies when the configuration has no granted endpoints`() {
        val configId = UUID.randomUUID()
        authenticateAsPlugin(configId)
        whenever(grantedEndpointRepository.findAllByConfigurationId(configId)).thenReturn(emptyList())
        val request = request("GET", "/api/v1/document/123")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(response.status).isEqualTo(403)
        assertThat(chain.request).isNull()
    }

    private fun request(method: String, path: String) =
        MockHttpServletRequest(method, path).apply { servletPath = path }

    private fun authenticateAsPlugin(configId: UUID) {
        val principal = ExternalPluginServicePrincipal(configId, "case-summary", "0.1.0")
        SecurityContextHolder.getContext().authentication =
            UsernamePasswordAuthenticationToken(principal, "token", emptyList())
    }

    private fun grantedEndpoint(configId: UUID, method: String, pattern: String) =
        ExternalPluginGrantedEndpoint(
            id = UUID.randomUUID(),
            configurationId = configId,
            httpMethod = method,
            endpointPattern = pattern,
        )
}
