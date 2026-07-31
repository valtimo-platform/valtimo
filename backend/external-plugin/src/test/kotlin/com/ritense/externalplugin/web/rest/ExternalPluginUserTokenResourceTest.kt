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

import com.ritense.externalplugin.domain.ExternalPluginGrantedEndpoint
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import com.ritense.externalplugin.service.ExternalPluginUserTokenService
import com.ritense.externalplugin.service.IssuedUserToken
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.server.ResponseStatusException
import java.time.Instant
import java.util.UUID

class ExternalPluginUserTokenResourceTest {

    private lateinit var configurationRepository: ExternalPluginConfigurationRepository
    private lateinit var grantedEndpointRepository: ExternalPluginGrantedEndpointRepository
    private lateinit var userTokenService: ExternalPluginUserTokenService
    private lateinit var resource: ExternalPluginUserTokenResource

    private val configurationId: UUID = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        configurationRepository = mock()
        grantedEndpointRepository = mock()
        userTokenService = mock()
        resource = ExternalPluginUserTokenResource(
            configurationRepository,
            grantedEndpointRepository,
            userTokenService,
        )

        SecurityContextHolder.getContext().authentication = UsernamePasswordAuthenticationToken(
            "john@example.com",
            "n/a",
            listOf(SimpleGrantedAuthority("ROLE_USER")),
        )
    }

    @AfterEach
    fun tearDown() {
        SecurityContextHolder.clearContext()
    }

    @Test
    fun `mints a token and returns the configuration's granted endpoints alongside it`() {
        val expiresAt = Instant.now().plusSeconds(900)
        whenever(configurationRepository.existsById(configurationId)).thenReturn(true)
        whenever(userTokenService.issue(eq("john@example.com"), eq(listOf("ROLE_USER")), eq(configurationId)))
            .thenReturn(IssuedUserToken("token-value", expiresAt))
        whenever(grantedEndpointRepository.findAllByConfigurationId(configurationId)).thenReturn(
            listOf(
                grantedEndpoint("GET", "/api/v1/documents/**"),
                grantedEndpoint("POST", "/api/v1/process/*/start"),
            )
        )

        val response = resource.mintUserToken(configurationId)

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        val body = response.body!!
        assertThat(body.userToken).isEqualTo("token-value")
        assertThat(body.expiresAt).isEqualTo(expiresAt)
        assertThat(body.grantedEndpoints).containsExactly(
            ExternalPluginUserTokenResource.GrantedEndpointDto("GET", "/api/v1/documents/**"),
            ExternalPluginUserTokenResource.GrantedEndpointDto("POST", "/api/v1/process/*/start"),
        )
    }

    @Test
    fun `returns an empty granted-endpoint list for a configuration that grants nothing`() {
        // An empty list must be surfaced as such (not omitted): the frontend precheck treats an
        // empty allowlist as deny-all, mirroring the server-side allowlist filter.
        whenever(configurationRepository.existsById(configurationId)).thenReturn(true)
        whenever(userTokenService.issue(any(), any(), any()))
            .thenReturn(IssuedUserToken("token-value", Instant.now().plusSeconds(900)))
        whenever(grantedEndpointRepository.findAllByConfigurationId(configurationId)).thenReturn(emptyList())

        val response = resource.mintUserToken(configurationId)

        assertThat(response.body!!.grantedEndpoints).isEmpty()
    }

    @Test
    fun `rejects an unknown configuration with 404 and does not mint`() {
        whenever(configurationRepository.existsById(configurationId)).thenReturn(false)

        assertThatThrownBy { resource.mintUserToken(configurationId) }
            .isInstanceOf(ResponseStatusException::class.java)
            .extracting { (it as ResponseStatusException).statusCode }
            .isEqualTo(HttpStatus.NOT_FOUND)
        verify(userTokenService, never()).issue(any(), any(), any())
    }

    @Test
    fun `rejects an unauthenticated caller with 401 and does not mint`() {
        SecurityContextHolder.clearContext()

        assertThatThrownBy { resource.mintUserToken(configurationId) }
            .isInstanceOf(ResponseStatusException::class.java)
            .extracting { (it as ResponseStatusException).statusCode }
            .isEqualTo(HttpStatus.UNAUTHORIZED)
        verify(userTokenService, never()).issue(any(), any(), any())
    }

    private fun grantedEndpoint(method: String, pattern: String) = ExternalPluginGrantedEndpoint(
        id = UUID.randomUUID(),
        configurationId = configurationId,
        httpMethod = method,
        endpointPattern = pattern,
    )
}
