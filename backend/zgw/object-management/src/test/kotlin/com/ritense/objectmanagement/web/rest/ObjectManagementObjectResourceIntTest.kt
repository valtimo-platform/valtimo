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

package com.ritense.objectmanagement.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.objectmanagement.BaseIntegrationTest
import com.ritense.objectmanagement.domain.ObjectManagement
import com.ritense.objectmanagement.service.ObjectManagementService
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.context.WebApplicationContext
import java.util.UUID

@Transactional
internal class ObjectManagementObjectResourceIntTest : BaseIntegrationTest() {

    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var webApplicationContext: WebApplicationContext

    @Autowired
    lateinit var objectManagementService: ObjectManagementService

    @Autowired
    lateinit var pluginService: PluginService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    lateinit var mockApi: MockWebServer
    lateinit var testConfigId: UUID
    lateinit var testConfigTitle: String

    @BeforeEach
    fun setUp() {
        mockMvc = MockMvcBuilders
            .webAppContextSetup(webApplicationContext)
            .build()

        mockApi = MockWebServer()
        mockApi.start()

        val objectUrl = mockApi.url("/objects").toString()
        val objectTypesApiUrl = mockApi.url("/objecttypes").toString()

        val authPlugin = pluginService.createPluginConfiguration(
            title = "Test Auth ${UUID.randomUUID()}",
            properties = objectMapper.readTree("""{"token":"some-secret-token-long"}""") as ObjectNode,
            pluginDefinitionKey = "objecttokenauthentication"
        )

        val objectenPlugin = pluginService.createPluginConfiguration(
            title = "Test Objecten API ${UUID.randomUUID()}",
            properties = objectMapper.readTree(
                """{"url":"$objectUrl","authenticationPluginConfiguration":"${authPlugin.id.id}"}"""
            ) as ObjectNode,
            pluginDefinitionKey = "objectenapi"
        )

        val objecttypenPlugin = pluginService.createPluginConfiguration(
            title = "Test Objecttypen API ${UUID.randomUUID()}",
            properties = objectMapper.readTree(
                """{"url":"$objectTypesApiUrl","authenticationPluginConfiguration":"${authPlugin.id.id}"}"""
            ) as ObjectNode,
            pluginDefinitionKey = "objecttypenapi"
        )

        testConfigTitle = "Test Object Management ${UUID.randomUUID()}"
        val objectManagement = objectManagementService.create(
            ObjectManagement(
                title = testConfigTitle,
                objectenApiPluginConfigurationId = objectenPlugin.id.id,
                objecttypeId = UUID.randomUUID().toString(),
                objecttypenApiPluginConfigurationId = objecttypenPlugin.id.id
            )
        )
        testConfigId = objectManagement.id
    }

    @AfterEach
    fun tearDown() {
        mockApi.shutdown()
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should return 400 when neither id nor title provided`() {
        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isBadRequest)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should return 400 when both id and title provided`() {
        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("id", UUID.randomUUID().toString())
                .param("title", "SomeTitle")
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isBadRequest)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should get objects by config title`() {
        mockApi.enqueue(mockObjectsResponse())

        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("title", testConfigTitle)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content").isArray)
            .andExpect(jsonPath("$.content[0].uuid").value("095be615-a8ad-4c33-8e9c-c7612fbf6c9f"))
            .andExpect(jsonPath("$.content[0].record.data.name").value("Test Object"))
            .andExpect(jsonPath("$.totalElements").value(1))
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should get objects by config id`() {
        mockApi.enqueue(mockObjectsResponse())

        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("id", testConfigId.toString())
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content").isArray)
            .andExpect(jsonPath("$.content.length()").value(1))
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should support pagination parameters`() {
        mockApi.enqueue(mockObjectsResponse(count = 50))

        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("title", testConfigTitle)
                .param("page", "0")
                .param("size", "10")
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.totalElements").value(50))
            .andExpect(jsonPath("$.size").value(10))
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should support sorting parameter`() {
        mockApi.enqueue(mockObjectsResponse())

        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("title", testConfigTitle)
                .param("sort", "name,desc")
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)

        val request = mockApi.takeRequest()
        assertThat(request.requestUrl?.queryParameter("ordering")).isEqualTo("-name")
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should pass dataAttrs filter to objects API`() {
        mockApi.enqueue(mockObjectsResponse())

        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("title", testConfigTitle)
                .param("dataAttrs", "name__icontains__test")
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)

        val request = mockApi.takeRequest()
        assertThat(request.requestUrl?.queryParameter("data_attrs")).isEqualTo("name__icontains__test")
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should pass multiple dataAttrs filters to objects API`() {
        mockApi.enqueue(mockObjectsResponse())

        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("title", testConfigTitle)
                .param("dataAttrs", "name__icontains__test,status__exact__active")
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)

        val request = mockApi.takeRequest()
        assertThat(request.requestUrl?.queryParameter("data_attrs"))
            .isEqualTo("name__icontains__test,status__exact__active")
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should return 400 when dataAttrs is malformed`() {
        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("title", testConfigTitle)
                .param("dataAttrs", "garbage")
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isBadRequest)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should return 400 when dataAttrs has an unknown comparator`() {
        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("title", testConfigTitle)
                .param("dataAttrs", "name__bogus__x")
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isBadRequest)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should return empty page when config not found by title`() {
        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("title", "NonExistentConfig")
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content").isEmpty)
            .andExpect(jsonPath("$.totalElements").value(0))
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should return empty page when config not found by id`() {
        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("id", UUID.randomUUID().toString())
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content").isEmpty)
            .andExpect(jsonPath("$.totalElements").value(0))
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should return multiple objects in page`() {
        mockApi.enqueue(mockObjectsResponseMultiple())

        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("title", testConfigTitle)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content.length()").value(2))
            .andExpect(jsonPath("$.content[0].uuid").value("095be615-a8ad-4c33-8e9c-c7612fbf6c9f"))
            .andExpect(jsonPath("$.content[1].uuid").value("195be615-a8ad-4c33-8e9c-c7612fbf6c9f"))
            .andExpect(jsonPath("$.totalElements").value(2))
    }

    private fun mockObjectsResponse(count: Int = 1): MockResponse {
        val body = """
            {
              "count": $count,
              "next": null,
              "previous": null,
              "results": [{
                  "url": "http://example.com/objects/1",
                  "uuid": "095be615-a8ad-4c33-8e9c-c7612fbf6c9f",
                  "type": "http://example.com/objecttypes/1",
                  "record": {
                    "index": 1,
                    "typeVersion": 1,
                    "data": {
                      "name": "Test Object",
                      "status": "active"
                    },
                    "startAt": "2024-01-01",
                    "registrationAt": "2024-01-01"
                  }
              }]
            }
        """.trimIndent()
        return MockResponse()
            .addHeader("Content-Type", "application/json")
            .setBody(body)
    }

    private fun mockObjectsResponseMultiple(): MockResponse {
        val body = """
            {
              "count": 2,
              "next": null,
              "previous": null,
              "results": [
                {
                  "url": "http://example.com/objects/1",
                  "uuid": "095be615-a8ad-4c33-8e9c-c7612fbf6c9f",
                  "type": "http://example.com/objecttypes/1",
                  "record": {
                    "index": 1,
                    "typeVersion": 1,
                    "data": {
                      "name": "Test Object 1",
                      "status": "active"
                    },
                    "startAt": "2024-01-01",
                    "registrationAt": "2024-01-01"
                  }
                },
                {
                  "url": "http://example.com/objects/2",
                  "uuid": "195be615-a8ad-4c33-8e9c-c7612fbf6c9f",
                  "type": "http://example.com/objecttypes/1",
                  "record": {
                    "index": 2,
                    "typeVersion": 1,
                    "data": {
                      "name": "Test Object 2",
                      "status": "inactive"
                    },
                    "startAt": "2024-01-02",
                    "registrationAt": "2024-01-02"
                  }
                }
              ]
            }
        """.trimIndent()
        return MockResponse()
            .addHeader("Content-Type", "application/json")
            .setBody(body)
    }
}
