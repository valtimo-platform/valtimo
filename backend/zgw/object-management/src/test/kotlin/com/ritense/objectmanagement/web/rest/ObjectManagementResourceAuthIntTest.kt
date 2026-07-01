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
import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.PermissionRepository
import com.ritense.authorization.role.Role
import com.ritense.authorization.role.RoleRepository
import com.ritense.objectmanagement.BaseIntegrationTest
import com.ritense.objectmanagement.authorization.ObjectManagementActionProvider
import com.ritense.objectmanagement.domain.ObjectManagement
import com.ritense.objectmanagement.service.ObjectManagementService
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.context.TestPropertySource
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
@TestPropertySource(properties = ["valtimo.object-management.authorization.enabled=true"])
internal class ObjectManagementResourceAuthIntTest : BaseIntegrationTest() {

    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var webApplicationContext: WebApplicationContext

    @Autowired
    lateinit var objectManagementService: ObjectManagementService

    @Autowired
    lateinit var pluginService: PluginService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var permissionRepository: PermissionRepository

    @Autowired
    lateinit var roleRepository: RoleRepository

    lateinit var mockApi: MockWebServer
    lateinit var testConfigId: UUID
    lateinit var testConfigTitle: String
    lateinit var userRole: Role

    @BeforeEach
    fun setUp() {
        mockMvc = MockMvcBuilders
            .webAppContextSetup(webApplicationContext)
            .build()

        mockApi = MockWebServer()
        mockApi.start()

        val objectUrl = mockApi.url("/objects").toString()
        val objectTypesApiUrl = mockApi.url("/objecttypes").toString()

        userRole = roleRepository.findByKey(USER) ?: roleRepository.save(Role(key = USER))

        runWithoutAuthorization {
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
    }

    @AfterEach
    fun tearDown() {
        mockApi.shutdown()
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `getAll should return empty list when user has no VIEW_LIST permission`() {
        mockMvc.perform(
            get("/api/v1/object/management/configuration")
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$").isEmpty)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `getAll should return configs when user has VIEW_LIST permission`() {
        grantPermission(ObjectManagementActionProvider.VIEW_LIST)

        mockMvc.perform(
            get("/api/v1/object/management/configuration")
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[?(@.id == '${testConfigId}')]").exists())
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `getById should return 403 when user has no VIEW permission`() {
        mockMvc.perform(
            get("/api/v1/object/management/configuration/{id}", testConfigId)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isForbidden)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `getById should return config when user has VIEW permission`() {
        grantPermission(ObjectManagementActionProvider.VIEW)

        mockMvc.perform(
            get("/api/v1/object/management/configuration/{id}", testConfigId)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(testConfigId.toString()))
            .andExpect(jsonPath("$.title").value(testConfigTitle))
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `getObjects should return 403 when user has no VIEW_LIST permission`() {
        mockMvc.perform(
            get("/api/v1/object/management/configuration/{id}/object", testConfigId)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isForbidden)
    }

    private fun grantPermission(vararg actions: Action<ObjectManagement>) {
        val permission = Permission(
            UUID.randomUUID(),
            ObjectManagement::class.java,
            actions.toMutableList(),
            ConditionContainer(emptyList()),
            userRole
        )
        permissionRepository.saveAndFlush(permission)
    }

    private fun mockObjectsResponse(): MockResponse {
        val body = """
            {
              "count": 1,
              "next": null,
              "previous": null,
              "results": [{
                  "url": "http://example.com/objects/1",
                  "uuid": "095be615-a8ad-4c33-8e9c-c7612fbf6c9f",
                  "type": "http://example.com/objecttypes/1",
                  "record": {
                    "index": 1,
                    "typeVersion": 1,
                    "data": {"name": "Test Object"},
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
}
