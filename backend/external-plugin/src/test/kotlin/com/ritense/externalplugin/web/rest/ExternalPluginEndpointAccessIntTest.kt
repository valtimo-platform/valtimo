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

import com.ritense.externalplugin.BaseIntegrationTest
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import java.util.UUID

/**
 * The *positive* half of the security configuration, which
 * [ExternalPluginSecuritySmokeIntegrationTest] cannot express: an endpoint with no matcher at all is
 * denied by default, so a route the platform is supposed to expose to ordinary users silently 403s
 * for everyone. Both such bugs in this feature (the case-tab content endpoint and the non-management
 * user-token mint) were found by clicking through a browser rather than by a test.
 *
 * Assertions are deliberately about *reachability*, not about handler outcomes: an authorised request
 * for a random UUID may legitimately answer 404/400, so the check is "not 401/403". Denied requests
 * are asserted to be exactly 403.
 */
@AutoConfigureMockMvc
class ExternalPluginEndpointAccessIntTest @Autowired constructor(
    private val mockMvc: MockMvc,
) : BaseIntegrationTest() {

    private val someId: UUID = UUID.randomUUID()

    private fun respond(method: HttpMethod, path: String): MockHttpServletResponse =
        mockMvc.perform(
            MockMvcRequestBuilders.request(method, path)
                .contentType("application/json")
                .content("{}")
                .accept("*/*")
        ).andReturn().response

    private fun perform(method: HttpMethod, path: String): Int = respond(method, path).status

    private fun assertReachable(method: HttpMethod, path: String) {
        val status = perform(method, path)
        assertThat(status)
            .withFailMessage("$method $path was denied with $status — is a security matcher missing?")
            .isNotIn(HttpStatus.UNAUTHORIZED.value(), HttpStatus.FORBIDDEN.value())
    }

    private fun assertForbidden(method: HttpMethod, path: String) {
        assertThat(perform(method, path))
            .withFailMessage("$method $path should be ADMIN-only")
            .isEqualTo(HttpStatus.FORBIDDEN.value())
    }

    // ---------------------------------------------------------------- management endpoints, ADMIN

    @ParameterizedTest(name = "ADMIN may reach {0} {1}")
    @CsvSource(
        "GET,/api/management/v1/external-plugin/host",
        "GET,/api/management/v1/external-plugin/host-defaults",
        "GET,/api/management/v1/external-plugin/definition",
        "GET,/api/management/v1/external-plugin/configuration",
    )
    @WithMockUser(authorities = [ADMIN])
    fun `an admin reaches the management collection endpoints`(method: HttpMethod, path: String) {
        assertReachable(method, path)
    }

    @Test
    @WithMockUser(authorities = [ADMIN])
    fun `an admin reaches the per-resource management endpoints`() {
        assertReachable(HttpMethod.GET, "/api/management/v1/external-plugin/host/$someId/usages")
        assertReachable(HttpMethod.GET, "/api/management/v1/external-plugin/definition/$someId")
        assertReachable(HttpMethod.GET, "/api/management/v1/external-plugin/configuration/$someId")
        assertReachable(HttpMethod.GET, "/api/management/v1/external-plugin/configuration/$someId/usages")
        assertReachable(HttpMethod.GET, "/api/management/v1/external-plugin/configuration/$someId/logs")
        assertReachable(HttpMethod.POST, "/api/management/v1/external-plugin/endpoint-descriptions")
    }

    // ---------------------------------------------------------------- management endpoints, USER

    @ParameterizedTest(name = "a plain user is refused {0} {1}")
    @CsvSource(
        "GET,/api/management/v1/external-plugin/host",
        "POST,/api/management/v1/external-plugin/host",
        "GET,/api/management/v1/external-plugin/host-defaults",
        "GET,/api/management/v1/external-plugin/definition",
        "GET,/api/management/v1/external-plugin/configuration",
        "POST,/api/management/v1/external-plugin/configuration",
        "POST,/api/management/v1/external-plugin/endpoint-descriptions",
    )
    @WithMockUser(authorities = [USER])
    fun `a plain user cannot reach the management api`(method: HttpMethod, path: String) {
        assertForbidden(method, path)
    }

    @Test
    @WithMockUser(authorities = [USER])
    fun `a plain user cannot reach the per-resource management endpoints`() {
        assertForbidden(HttpMethod.GET, "/api/management/v1/external-plugin/host/$someId/usages")
        assertForbidden(HttpMethod.DELETE, "/api/management/v1/external-plugin/host/$someId")
        assertForbidden(HttpMethod.PATCH, "/api/management/v1/external-plugin/host/$someId/event-queue")
        assertForbidden(HttpMethod.GET, "/api/management/v1/external-plugin/definition/$someId")
        assertForbidden(HttpMethod.POST, "/api/management/v1/external-plugin/definition/$someId/accept-content")
        assertForbidden(HttpMethod.GET, "/api/management/v1/external-plugin/configuration/$someId")
        assertForbidden(HttpMethod.PUT, "/api/management/v1/external-plugin/configuration/$someId")
        assertForbidden(HttpMethod.DELETE, "/api/management/v1/external-plugin/configuration/$someId")
        assertForbidden(HttpMethod.GET, "/api/management/v1/external-plugin/configuration/$someId/logs")
        assertForbidden(HttpMethod.POST, "/api/management/v1/external-plugin/configuration/$someId/revoke-tokens")
    }

    // ---------------------------------------------------------------- non-management endpoints, USER

    @Test
    @WithMockUser(authorities = [USER])
    fun `any authenticated user may mint a downscoped user token — the result is bounded by PBAC and the allowlist`() {
        assertReachable(
            HttpMethod.POST,
            "/api/v1/external-plugin/configuration/$someId/user-token",
        )
    }

    @Test
    @WithMockUser(authorities = [USER])
    fun `any authenticated user may read the host origins the frontend CSP needs`() {
        assertReachable(HttpMethod.GET, "/api/v1/external-plugin/host-origins")
    }

    @Test
    @WithMockUser(authorities = [USER])
    fun `any authenticated user may list the menu pages the builder renders`() {
        assertReachable(HttpMethod.GET, "/api/v1/external-plugin/menu-pages")
    }

    @Test
    @WithMockUser(authorities = [USER])
    fun `the task-form submission endpoint is reachable for an authenticated user`() {
        // The COMPLETE permission on the task is enforced inside the submission service, not here.
        assertReachable(
            HttpMethod.POST,
            "/api/v1/process-link/$someId/external-plugin-task-form/submission",
        )
    }

    @Test
    @WithMockUser(authorities = [USER])
    fun `the introspection endpoint is reachable but rejects a non-user-token principal`() {
        val response = respond(HttpMethod.GET, "/api/v1/external-plugin/user-token/introspect")

        assertThat(response.status).isEqualTo(HttpStatus.FORBIDDEN.value())
        // The status alone cannot carry this test: a 403 from the filter chain and a 403 from the
        // resource are identical. Only the resource emits its own reason, so asserting on it is what
        // makes the test fail if the security matcher for this path is ever dropped.
        assertThat(response.errorMessage.orEmpty() + response.contentAsString)
            .withFailMessage(
                "Expected the resource's own rejection, but got a bare 403 " +
                    "(errorMessage=${response.errorMessage}, body=${response.contentAsString}) " +
                    "— is the security matcher for this path missing?"
            )
            .contains("only available for external plugin user tokens")
    }

    // ---------------------------------------------------------------- unauthenticated

    @ParameterizedTest(name = "an anonymous caller is refused {0} {1}")
    @CsvSource(
        "GET,/api/management/v1/external-plugin/host",
        "GET,/api/v1/external-plugin/host-origins",
        "GET,/api/v1/external-plugin/menu-pages",
    )
    fun `an anonymous caller is refused everywhere`(method: HttpMethod, path: String) {
        assertThat(perform(method, path))
            .isIn(HttpStatus.UNAUTHORIZED.value(), HttpStatus.FORBIDDEN.value())
    }
}
