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

package com.ritense.exchange.web

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okio.Buffer
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpHeaders
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity
import org.springframework.test.context.ContextConfiguration
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.context.junit.jupiter.SpringExtension
import org.springframework.test.context.web.WebAppConfiguration
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.DefaultMockMvcBuilder
import org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup
import org.springframework.web.context.WebApplicationContext
import java.util.UUID

@ExtendWith(SpringExtension::class)
@WebAppConfiguration
@ContextConfiguration(classes = [ExchangeTestConfig::class])
class ExchangeResourceTest {

    @Autowired
    private lateinit var context: WebApplicationContext

    private lateinit var mockMvc: MockMvc

    private val publicationId = UUID.randomUUID()
    private val artifactId = UUID.randomUUID()
    private val artifactPath = "/api/management/v1/exchange/publications/$publicationId/artifacts/$artifactId"

    @BeforeEach
    fun setUp() {
        mockMvc = webAppContextSetup(context).apply<DefaultMockMvcBuilder>(springSecurity()).build()
    }

    private fun publicationJson(status: String = "PUBLISHED", manifestType: String = "CASE_DEFINITION") =
        """
        {"id":"$publicationId","name":"Plan","status":"$status","publicationType":"CaseDefinition",
         "artifacts":[{"id":"$artifactId","versionTag":"1.0.0","title":"Plan 1.0.0",
         "manifestType":"$manifestType","valtimoVersion":"13.60.0","fileName":"plan.zip",
         "dependencies":[{"dependencyType":"BUILDING_BLOCK","key":"bb","title":"Block","versionTag":"1.0.0"}]}]}
        """.trimIndent()

    private fun enqueuePublication(json: String = publicationJson()) {
        server.enqueue(MockResponse().setHeader("Content-Type", "application/json").setBody(json))
    }

    @Test
    fun `anonymous is unauthorized`() {
        mockMvc.perform(get(artifactPath)).andExpect(status().isUnauthorized)
        mockMvc.perform(get("/api/v1/exchange/configuration")).andExpect(status().isUnauthorized)
    }

    @Test
    @WithMockUser(authorities = ["ROLE_USER"])
    fun `non admin is forbidden on management endpoints`() {
        mockMvc.perform(get(artifactPath)).andExpect(status().isForbidden)
        mockMvc.perform(get("$artifactPath/content")).andExpect(status().isForbidden)
    }

    @Test
    @WithMockUser(authorities = ["ROLE_USER"])
    fun `any authenticated user can read the configuration`() {
        mockMvc.perform(get("/api/v1/exchange/configuration"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.enabled").value(true))
            .andExpect(jsonPath("$.url").value(server.url("/").toString().trimEnd('/')))
    }

    @Test
    @WithMockUser(authorities = ["ROLE_ADMIN"])
    fun `admin gets artifact details`() {
        enqueuePublication()

        mockMvc.perform(get(artifactPath))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.publicationName").value("Plan"))
            .andExpect(jsonPath("$.type").value("CASE_DEFINITION"))
            .andExpect(jsonPath("$.compatibility").value("NEWER"))
            .andExpect(jsonPath("$.runningValtimoVersion").value("13.53.0"))
            .andExpect(jsonPath("$.dependencies[0].type").value("BUILDING_BLOCK"))
    }

    @Test
    @WithMockUser(authorities = ["ROLE_ADMIN"])
    fun `admin downloads the artifact content`() {
        enqueuePublication()
        server.enqueue(MockResponse().setBody(Buffer().write(byteArrayOf(1, 2, 3))))

        mockMvc.perform(get("$artifactPath/content"))
            .andExpect(status().isOk)
            .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"plan.zip\""))
            .andExpect(content().bytes(byteArrayOf(1, 2, 3)))
    }

    @Test
    @WithMockUser(authorities = ["ROLE_ADMIN"])
    fun `draft publication is not found`() {
        enqueuePublication(publicationJson(status = "DRAFT"))

        mockMvc.perform(get(artifactPath))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.message").exists())
    }

    @Test
    @WithMockUser(authorities = ["ROLE_ADMIN"])
    fun `plugin artifact is unprocessable`() {
        enqueuePublication(publicationJson(manifestType = "PLUGIN"))

        mockMvc.perform(get(artifactPath)).andExpect(status().isUnprocessableEntity)
    }

    @Test
    @WithMockUser(authorities = ["ROLE_ADMIN"])
    fun `unreachable exchange is a bad gateway`() {
        server.enqueue(MockResponse().setResponseCode(503))

        mockMvc.perform(get(artifactPath)).andExpect(status().isBadGateway)
    }

    @Test
    @WithMockUser(authorities = ["ROLE_ADMIN"])
    fun `oversize artifact is rejected`() {
        enqueuePublication()
        server.enqueue(MockResponse().setBody(Buffer().write(ByteArray(2048))))

        mockMvc.perform(get("$artifactPath/content")).andExpect(status().isPayloadTooLarge)
    }

    @Test
    @WithMockUser(authorities = ["ROLE_ADMIN"])
    fun `non uuid path ids are a bad request`() {
        mockMvc.perform(get("/api/management/v1/exchange/publications/not-a-uuid/artifacts/$artifactId"))
            .andExpect(status().isBadRequest)
    }

    companion object {
        private val server = MockWebServer().apply { start() }

        @JvmStatic
        @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            registry.add("valtimo.exchange.url") { server.url("/").toString() }
            registry.add("valtimo.exchange.max-artifact-size") { "1KB" }
        }

        @JvmStatic
        @AfterAll
        fun tearDown() {
            server.shutdown()
        }
    }
}
