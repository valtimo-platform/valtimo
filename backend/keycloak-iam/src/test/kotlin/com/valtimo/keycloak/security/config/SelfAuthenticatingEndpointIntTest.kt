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

import com.ritense.valtimo.contract.security.config.HttpSecurityConfigurer
import com.ritense.valtimo.contract.security.config.SelfAuthenticatingEndpoints
import com.valtimo.keycloak.BaseIntegrationTest
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.core.annotation.Order
import org.springframework.http.HttpHeaders.AUTHORIZATION
import org.springframework.http.HttpMethod.POST
import org.springframework.http.ResponseEntity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher
import org.springframework.security.web.util.matcher.RequestMatcher
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@AutoConfigureMockMvc
@Import(SelfAuthenticatingEndpointIntTest.TestEndpointConfiguration::class)
internal class SelfAuthenticatingEndpointIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Test
    fun `should reach a self-authenticating endpoint carrying a bearer token that is not a keycloak JWT`() {
        mockMvc.perform(post(SELF_AUTHENTICATING_PATH).header(AUTHORIZATION, "Bearer mysecret"))
            .andExpect(status().isNoContent)
    }

    @Test
    fun `should still reject a bearer token that is not a keycloak JWT on any other endpoint`() {
        mockMvc.perform(post(OTHER_PATH).header(AUTHORIZATION, "Bearer mysecret"))
            .andExpect(status().isUnauthorized)
    }

    @TestConfiguration
    class TestEndpointConfiguration {

        @Bean
        @Order(260)
        fun testEndpointHttpSecurityConfigurer() = TestEndpointHttpSecurityConfigurer()

        @Bean
        fun testEndpointResource() = TestEndpointResource()
    }

    class TestEndpointHttpSecurityConfigurer : HttpSecurityConfigurer, SelfAuthenticatingEndpoints {

        override fun configure(http: HttpSecurity) {
            http.authorizeHttpRequests { requests ->
                requests.requestMatchers(SELF_AUTHENTICATING_MATCHER, OTHER_MATCHER).permitAll()
            }
        }

        override fun getSelfAuthenticatingEndpoints(): List<RequestMatcher> = listOf(SELF_AUTHENTICATING_MATCHER)
    }

    @RestController
    @RequestMapping("/api/v1/test/self-authenticating-endpoint")
    class TestEndpointResource {

        @PostMapping("/callback")
        fun callback(): ResponseEntity<Void> = ResponseEntity.noContent().build()

        @PostMapping("/other")
        fun other(): ResponseEntity<Void> = ResponseEntity.noContent().build()
    }

    companion object {
        private const val SELF_AUTHENTICATING_PATH = "/api/v1/test/self-authenticating-endpoint/callback"
        private const val OTHER_PATH = "/api/v1/test/self-authenticating-endpoint/other"
        private val SELF_AUTHENTICATING_MATCHER = antMatcher(POST, SELF_AUTHENTICATING_PATH)
        private val OTHER_MATCHER = antMatcher(POST, OTHER_PATH)
    }
}
