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

import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.service.ExternalPluginHostService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import java.util.UUID

/**
 * The `host-origins` endpoint backs the frontend's CSP bootstrap for *every* authenticated user
 * (audit-C2), so its payload must be strictly origins: no credentials, paths, or duplicate noise
 * may survive, and unparseable rows must be dropped rather than break the whole response.
 */
class ExternalPluginHostOriginsResourceTest {

    private lateinit var hostService: ExternalPluginHostService
    private lateinit var resource: ExternalPluginHostOriginsResource

    @BeforeEach
    fun setUp() {
        hostService = mock()
        resource = ExternalPluginHostOriginsResource(hostService)
    }

    @Test
    fun `returns the distinct sorted origins of all registered hosts`() {
        whenever(hostService.list()).thenReturn(
            listOf(
                host("https://plugins.example.com"),
                host("http://localhost:3010"),
                // Same origin as the first host, different path — must collapse to one origin.
                host("https://plugins.example.com/other-root"),
            )
        )

        val response = resource.getHostOrigins()

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.body).containsExactly(
            "http://localhost:3010",
            "https://plugins.example.com",
        )
    }

    @Test
    fun `strips paths, ports kept explicit, and never leaks credentials`() {
        whenever(hostService.list()).thenReturn(
            listOf(host("https://user:secret@plugins.example.com:8443/plugin-root/api"))
        )

        val response = resource.getHostOrigins()

        assertThat(response.body).containsExactly("https://plugins.example.com:8443")
    }

    @Test
    fun `drops unparseable base URLs instead of failing the response`() {
        whenever(hostService.list()).thenReturn(
            listOf(
                host("not a url at all"),
                host("https://valid.example.com"),
            )
        )

        val response = resource.getHostOrigins()

        assertThat(response.body).containsExactly("https://valid.example.com")
    }

    @Test
    fun `returns an empty list when no hosts are registered`() {
        whenever(hostService.list()).thenReturn(emptyList())

        val response = resource.getHostOrigins()

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.body).isEmpty()
    }

    private fun host(baseUrl: String) = ExternalPluginHost(
        id = UUID.randomUUID(),
        name = "host",
        baseUrl = baseUrl,
        secret = "encrypted-secret",
        status = ExternalPluginHostStatus.CONNECTED,
    )
}
