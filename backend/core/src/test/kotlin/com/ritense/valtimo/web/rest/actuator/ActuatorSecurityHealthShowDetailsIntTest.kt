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

import com.jayway.jsonpath.JsonPath.read
import com.jayway.jsonpath.PathNotFoundException
import com.ritense.valtimo.web.rest.SecuritySpecificEndpointIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.test.annotation.DirtiesContext
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import java.util.Base64

@Tag("security")
class ActuatorSecurityHealthShowDetailsIntTest {

    @Nested
    @DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
    @TestPropertySource(properties = [
        "management.port=0",
        "management.endpoint.health.show-details=never"
    ])
    inner class Never : SecuritySpecificEndpointIntegrationTest() {

        @Test
        fun `unauthenticated user should have access to health endpoint without details`() {
            val request = MockMvcRequestBuilders.request(HttpMethod.GET, "/actuator/health").init()

            val response = mockMvc.perform(request).andReturn().response
            assertThat(response.status).isEqualTo(HttpStatus.OK.value())
            assertThrows<PathNotFoundException> {
                read<Map<String, Any>>(response.contentAsString, "$.components")
            }
        }

        @Test
        fun `actuator user should have access to health endpoint without details`() {
            val request = MockMvcRequestBuilders.request(HttpMethod.GET, "/actuator/health")
                .init()
                .withBasicTestUser()

            val response = mockMvc.perform(request).andReturn().response
            assertThat(response.status).isEqualTo(HttpStatus.OK.value())
            assertThrows<PathNotFoundException> {
                read<Map<String, Any>>(response.contentAsString, "$.components")
            }
        }

        @Test
        fun `unauthenticated user should have access to actuator discovery endpoint`() {
            val request = MockMvcRequestBuilders.request(HttpMethod.GET, "/actuator").init()
            assertHttpStatus(request, HttpStatus.OK)
        }
    }

    @Nested
    @DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
    @TestPropertySource(properties = [
        "management.port=0",
        "management.endpoint.health.show-details=always"
    ])
    inner class Always : SecuritySpecificEndpointIntegrationTest() {

        @Test
        fun `unauthenticated user can read health endpoint, components stripped despite show-details=ALWAYS`() {
            val request = MockMvcRequestBuilders.request(HttpMethod.GET, "/actuator/health").init()

            val response = mockMvc.perform(request).andReturn().response
            assertThat(response.status).isEqualTo(HttpStatus.OK.value())
            // Wrapper forces no-details for non-actuator callers regardless of show-details=ALWAYS.
            assertThrows<PathNotFoundException> {
                read<Map<String, Any>>(response.contentAsString, "$.components")
            }
        }

        @Test
        fun `actuator user should have access to health endpoint with details`() {
            val request = MockMvcRequestBuilders.request(HttpMethod.GET, "/actuator/health")
                .init()
                .withBasicTestUser()

            val response = mockMvc.perform(request).andReturn().response
            assertThat(response.status).isEqualTo(HttpStatus.OK.value())

            val pingStatus = read<Any>(response.contentAsString, "$.components.ping.status")
            assertThat(pingStatus).isEqualTo("UP")
        }

        @Test
        fun `unauthenticated user can read actuator discovery endpoint`() {
            val request = MockMvcRequestBuilders.request(HttpMethod.GET, "/actuator").init()
            assertHttpStatus(request, HttpStatus.OK)
        }
    }

    @Nested
    @DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
    @TestPropertySource(properties = [
        "management.port=0",
        "management.endpoint.health.show-details=when-authorized",
        "management.endpoint.health.roles[0]=ROLE_OTHER"
    ])
    inner class WhenAuthorizedOtherRole : SecuritySpecificEndpointIntegrationTest() {

        @Test
        fun `unauthenticated user can read health endpoint without components when details are gated to non-actuator role`() {
            val request = MockMvcRequestBuilders.request(HttpMethod.GET, "/actuator/health").init()

            val response = mockMvc.perform(request).andReturn().response
            assertThat(response.status).isEqualTo(HttpStatus.OK.value())
            assertThrows<PathNotFoundException> {
                read<Map<String, Any>>(response.contentAsString, "$.components")
            }
        }

        @Test
        fun `actuator user should have access to health endpoint without details when details are gated to non-actuator role`() {
            val request = MockMvcRequestBuilders.request(HttpMethod.GET, "/actuator/health")
                .init()
                .withBasicTestUser()

            val response = mockMvc.perform(request).andReturn().response
            assertThat(response.status).isEqualTo(HttpStatus.OK.value())
            assertThrows<PathNotFoundException> {
                read<Map<String, Any>>(response.contentAsString, "$.components")
            }
        }

        @Test
        fun `unauthenticated user can read actuator discovery endpoint`() {
            val request = MockMvcRequestBuilders.request(HttpMethod.GET, "/actuator").init()
            assertHttpStatus(request, HttpStatus.OK)
        }
    }

    @Nested
    @DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
    @TestPropertySource(properties = [
        "management.port=0",
        "management.endpoint.health.show-details=never",
        "management.endpoint.health.group.leaky.show-details=always",
        "management.endpoint.health.group.leaky.include=ping"
    ])
    inner class GroupOverride : SecuritySpecificEndpointIntegrationTest() {

        @Test
        fun `unauthenticated user can read health group but never sees components despite group override`() {
            val request = MockMvcRequestBuilders.request(HttpMethod.GET, "/actuator/health/leaky").init()

            val response = mockMvc.perform(request).andReturn().response
            assertThat(response.status).isEqualTo(HttpStatus.OK.value())
            // Group config says show-details=ALWAYS; the ActuatorRoleHealthEndpointGroups wrapper
            // strips components for non-actuator callers regardless.
            assertThrows<PathNotFoundException> {
                read<Map<String, Any>>(response.contentAsString, "$.components")
            }
        }

        @Test
        fun `unauthenticated user can read top-level health without components`() {
            val request = MockMvcRequestBuilders.request(HttpMethod.GET, "/actuator/health").init()

            val response = mockMvc.perform(request).andReturn().response
            assertThat(response.status).isEqualTo(HttpStatus.OK.value())
            assertThrows<PathNotFoundException> {
                read<Map<String, Any>>(response.contentAsString, "$.components")
            }
        }

        @Test
        fun `actuator user should have access to health group with details`() {
            val request = MockMvcRequestBuilders.request(HttpMethod.GET, "/actuator/health/leaky")
                .init()
                .withBasicTestUser()

            val response = mockMvc.perform(request).andReturn().response
            assertThat(response.status).isEqualTo(HttpStatus.OK.value())

            val pingStatus = read<Any>(response.contentAsString, "$.components.ping.status")
            assertThat(pingStatus).isEqualTo("UP")
        }

        @Test
        fun `actuator user should have access to top-level health without details`() {
            val request = MockMvcRequestBuilders.request(HttpMethod.GET, "/actuator/health")
                .init()
                .withBasicTestUser()

            val response = mockMvc.perform(request).andReturn().response
            assertThat(response.status).isEqualTo(HttpStatus.OK.value())
            assertThrows<PathNotFoundException> {
                read<Map<String, Any>>(response.contentAsString, "$.components")
            }
        }
    }
}

private fun MockHttpServletRequestBuilder.init() =
    this.accept(MediaType.APPLICATION_JSON)
        .with { r: MockHttpServletRequest ->
            r.remoteAddr = "8.8.8.8"
            r
        }

private fun MockHttpServletRequestBuilder.withBasicTestUser(): MockHttpServletRequestBuilder {
    val credentials = Base64.getEncoder().encodeToString("test:test".toByteArray())
    return this.header("Authorization", "Basic $credentials")
}