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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.BaseIntegrationTest
import com.ritense.externalplugin.domain.EventQueueMode
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginGrantedEndpoint
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostKind
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.externalplugin.service.ExternalPluginServiceTokenService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Sends a *real* service token through the *full* security filter chain — the coverage the filter
 * unit tests and the mock-user reachability tests ([ExternalPluginEndpointAccessIntTest]) cannot
 * express, because the decisive interaction only exists in the assembled chain: the allowlist
 * filter decides first, and Spring Security's `AuthorizationFilter` applies the coarse per-URL
 * rules (`.authenticated()` / `hasAuthority(...)`) at the very end.
 *
 * The regression this guards: the service-token authentication used to carry no authorities, so
 * every `hasAuthority`-gated endpoint — the entire management API — answered 403 even when the
 * administrator had explicitly granted it, contradicting the module's "reach is the allowlist"
 * design. The counterpart guarantees matter just as much: with ADMIN+USER authorities on the
 * token, the denylist is the only thing between a grant and the sensitive surfaces, so this test
 * also pins that the denylist holds in the full chain.
 *
 * Like [ExternalPluginEndpointAccessIntTest], reachability asserts "not 401/403" (a reachable
 * handler may legitimately answer 200/400/404); denials assert exactly 403.
 */
@AutoConfigureMockMvc
@Transactional
class ExternalPluginServiceTokenAccessIntTest @Autowired constructor(
    private val mockMvc: MockMvc,
    private val hostRepository: ExternalPluginHostRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val grantedEndpointRepository: ExternalPluginGrantedEndpointRepository,
    private val serviceTokenService: ExternalPluginServiceTokenService,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    private lateinit var definition: ExternalPluginDefinition
    private lateinit var configuration: ExternalPluginConfiguration
    private lateinit var token: String

    @BeforeEach
    fun seed() {
        val host = hostRepository.saveAndFlush(
            ExternalPluginHost(
                id = UUID.randomUUID(),
                name = "host-${UUID.randomUUID()}",
                baseUrl = "https://plugin-host:8090",
                secret = "encrypted-secret",
                status = ExternalPluginHostStatus.CONNECTED,
                kind = ExternalPluginHostKind.PLUGIN_HOST,
                gzacCallbackBaseUrl = "http://gzac:8080",
                eventBrokerAmqpUrl = "amqp://guest:guest@rabbit:5672",
                eventBrokerExchange = "valtimo-events",
                eventQueueMode = EventQueueMode.DURABLE,
                eventQueueTtlMs = 259_200_000,
            )
        )
        definition = definitionRepository.saveAndFlush(
            ExternalPluginDefinition(
                id = UUID.randomUUID(),
                pluginId = "case-summary-${UUID.randomUUID()}",
                version = "0.1.0",
                name = "Case Summary",
                description = "Shows a summary",
                provider = "Ritense",
                minGzacVersion = "12.0.0",
                maxGzacVersion = "12.1.0",
                manifestJson = objectMapper.createObjectNode().put("pluginId", "case-summary"),
                hostId = host.id,
                baseUrl = "${host.baseUrl}/plugins/case-summary",
                status = ExternalPluginDefinitionStatus.AVAILABLE,
                contentHash = "sha256:accepted",
                pendingContentHash = null,
            )
        )
        configuration = configurationRepository.saveAndFlush(
            ExternalPluginConfiguration(
                id = UUID.randomUUID(),
                definitionId = definition.id,
                title = "My configuration",
                properties = objectMapper.createObjectNode(),
                tokenGeneration = 0,
            )
        )
        token = serviceTokenService.issue(configuration, definition)
    }

    private fun grant(method: String, pattern: String) {
        grantedEndpointRepository.saveAndFlush(
            ExternalPluginGrantedEndpoint(
                id = UUID.randomUUID(),
                configurationId = configuration.id,
                httpMethod = method,
                endpointPattern = pattern,
            )
        )
    }

    private fun perform(method: HttpMethod, path: String): Int =
        mockMvc.perform(
            MockMvcRequestBuilders.request(method, path)
                .header("Authorization", "Bearer $token")
                .contentType("application/json")
                .content("{}")
                .accept("*/*")
        ).andReturn().response.status

    @Test
    fun `a granted hasAuthority-gated management endpoint is reachable with a service token`() {
        // GET /api/management/v1/document-definition is gated hasAuthority(ADMIN)
        // (DocumentDefinitionHttpSecurityConfigurer) — the shape of endpoint the bug made
        // unreachable despite a grant.
        grant("GET", "/api/management/v1/document-definition")

        val status = perform(HttpMethod.GET, "/api/management/v1/document-definition")

        assertThat(status)
            .withFailMessage(
                "granted ADMIN-gated endpoint was denied with $status — are the service-token " +
                    "authorities missing?"
            )
            .isNotIn(HttpStatus.UNAUTHORIZED.value(), HttpStatus.FORBIDDEN.value())
    }

    @Test
    fun `a granted authenticated-only endpoint is reachable with a service token`() {
        // GET /api/v1/case-definition is gated .authenticated() (CaseHttpSecurityConfigurer) —
        // the shape that already worked before the fix and must keep working.
        grant("GET", "/api/v1/case-definition")

        val status = perform(HttpMethod.GET, "/api/v1/case-definition")

        assertThat(status).isNotIn(HttpStatus.UNAUTHORIZED.value(), HttpStatus.FORBIDDEN.value())
    }

    @Test
    fun `an endpoint outside the granted set stays forbidden`() {
        grant("GET", "/api/management/v1/document-definition")

        assertThat(perform(HttpMethod.GET, "/api/v1/case-definition"))
            .isEqualTo(HttpStatus.FORBIDDEN.value())
    }

    @Test
    fun `a denylisted management endpoint stays forbidden even when granted`() {
        // With ADMIN on the token, the allowlist filter's denylist is the only guard left for
        // external-plugin management — this pins that it holds in the assembled chain.
        grant("GET", "/api/management/v1/external-plugin/host")

        assertThat(perform(HttpMethod.GET, "/api/management/v1/external-plugin/host"))
            .isEqualTo(HttpStatus.FORBIDDEN.value())
    }

    @Test
    fun `a user-account mutation stays forbidden even when granted`() {
        // POST /api/v1/users is gated hasAuthority(ADMIN); without the method-specific denylist
        // entry the token's ADMIN authority would let a grant reach it.
        grant("POST", "/api/v1/users")

        assertThat(perform(HttpMethod.POST, "/api/v1/users"))
            .isEqualTo(HttpStatus.FORBIDDEN.value())
    }

    @Test
    fun `a revoked token is rejected on a granted endpoint`() {
        grant("GET", "/api/v1/case-definition")
        configuration.tokenGeneration = configuration.tokenGeneration + 1
        configurationRepository.saveAndFlush(configuration)

        assertThat(perform(HttpMethod.GET, "/api/v1/case-definition"))
            .isIn(HttpStatus.UNAUTHORIZED.value(), HttpStatus.FORBIDDEN.value())
    }
}
