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

package com.ritense.valtimo.web.rest.actuator

import com.ritense.valtimo.web.rest.SecuritySpecificEndpointIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf
import org.springframework.test.annotation.DirtiesContext
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import java.util.Base64
import java.util.stream.Stream

@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestPropertySource(properties = [
    "management.port=0",
    "management.endpoints.web.exposure.include=*",
    "management.endpoints.access.default=unrestricted",
    "management.endpoint.shutdown.enabled=true",
    "management.endpoint.env.post.enabled=true"
])
class ActuatorSecurityWriteBlockedIntTest : SecuritySpecificEndpointIntegrationTest() {

    @Test
    fun `actuator user can read loggers (positive baseline)`() {
        val request = MockMvcRequestBuilders.request(HttpMethod.GET, "/actuator/loggers")
            .init()
            .withBasicTestUser()

        val response = mockMvc.perform(request).andReturn().response
        assertThat(response.status).isEqualTo(HttpStatus.OK.value())
    }

    @Test
    fun `actuator user can write loggers (positive baseline)`() {
        val request = MockMvcRequestBuilders.request(HttpMethod.POST, "/actuator/loggers/com.ritense.valtimo")
            .init()
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}")
            .withBasicTestUser()

        val response = mockMvc.perform(request).andReturn().response
        assertThat(response.status).isEqualTo(HttpStatus.NO_CONTENT.value())
    }

    @ParameterizedTest(name = "{0} {1}")
    @MethodSource("nonLoggersWriteOperations")
    fun `actuator user cannot mutate non-loggers actuator endpoints even when access is unrestricted`(
        method: HttpMethod,
        path: String
    ) {
        val request = MockMvcRequestBuilders.request(method, path)
            .init()
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}")
            .withBasicTestUser()

        val response = mockMvc.perform(request).andReturn().response
        val status = HttpStatus.valueOf(response.status)
        assertThat(status.is2xxSuccessful)
            .describedAs("$method $path returned ${response.status}; expected non-2xx")
            .isFalse
    }

    @ParameterizedTest(name = "{0} {1}")
    @MethodSource("nonLoggersWriteOperationsAtRegisteredEndpoints")
    fun `denyAll blocks non-loggers mutations even when CSRF is satisfied`(
        method: HttpMethod,
        path: String
    ) {
        val request = MockMvcRequestBuilders.request(method, path)
            .init()
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}")
            .with(csrf())
            .withBasicTestUser()

        assertHttpStatus(request, HttpStatus.FORBIDDEN)
    }

    fun MockHttpServletRequestBuilder.init() =
        this.accept(MediaType.APPLICATION_JSON)
            .with { r: MockHttpServletRequest ->
                r.remoteAddr = "8.8.8.8"
                r
            }

    fun MockHttpServletRequestBuilder.withBasicTestUser(): MockHttpServletRequestBuilder {
        val credentials = Base64.getEncoder().encodeToString("test:test".toByteArray())
        return this.header("Authorization", "Basic $credentials")
    }

    companion object {
        @JvmStatic
        fun nonLoggersWriteOperations(): Stream<Arguments> = Stream.of(
            Arguments.of(HttpMethod.POST, "/actuator/env"),
            Arguments.of(HttpMethod.POST, "/actuator/env/some.property"),
            Arguments.of(HttpMethod.POST, "/actuator/shutdown"),
            Arguments.of(HttpMethod.DELETE, "/actuator/caches"),
            Arguments.of(HttpMethod.DELETE, "/actuator/caches/anyCache"),
            Arguments.of(HttpMethod.DELETE, "/actuator/sessions/abc123"),
            Arguments.of(HttpMethod.POST, "/actuator/loggers"),
            Arguments.of(HttpMethod.POST, "/actuator/configprops"),
            Arguments.of(HttpMethod.POST, "/actuator/info"),
            Arguments.of(HttpMethod.POST, "/actuator/mappings"),
            Arguments.of(HttpMethod.POST, "/actuator/health"),
            Arguments.of(HttpMethod.PUT, "/actuator/loggers/com.ritense.valtimo"),
            Arguments.of(HttpMethod.DELETE, "/actuator/loggers/com.ritense.valtimo")
        )

        // Subset of write operations that target endpoints we know are registered in the test app.
        // Used to assert exact 403 from the security chain's denyAll, distinct from MVC's 405 or
        // fall-through 401/404 for unregistered endpoints.
        @JvmStatic
        fun nonLoggersWriteOperationsAtRegisteredEndpoints(): Stream<Arguments> = Stream.of(
            Arguments.of(HttpMethod.POST, "/actuator/env"),
            Arguments.of(HttpMethod.POST, "/actuator/env/some.property"),
            Arguments.of(HttpMethod.POST, "/actuator/shutdown"),
            Arguments.of(HttpMethod.POST, "/actuator/configprops"),
            Arguments.of(HttpMethod.POST, "/actuator/info"),
            Arguments.of(HttpMethod.POST, "/actuator/mappings"),
            Arguments.of(HttpMethod.POST, "/actuator/health"),
            Arguments.of(HttpMethod.DELETE, "/actuator/env"),
            Arguments.of(HttpMethod.DELETE, "/actuator/configprops"),
            Arguments.of(HttpMethod.DELETE, "/actuator/info"),
            Arguments.of(HttpMethod.DELETE, "/actuator/mappings"),
            Arguments.of(HttpMethod.PUT, "/actuator/env"),
            Arguments.of(HttpMethod.PUT, "/actuator/configprops"),
            Arguments.of(HttpMethod.PATCH, "/actuator/env"),
            Arguments.of(HttpMethod.PUT, "/actuator/loggers/com.ritense.valtimo"),
            Arguments.of(HttpMethod.DELETE, "/actuator/loggers/com.ritense.valtimo"),
            Arguments.of(HttpMethod.PATCH, "/actuator/loggers/com.ritense.valtimo")
        )
    }
}
