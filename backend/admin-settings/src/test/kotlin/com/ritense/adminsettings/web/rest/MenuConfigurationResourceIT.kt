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

package com.ritense.adminsettings.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.adminsettings.BaseIntegrationTest
import com.ritense.adminsettings.repository.MenuConfigurationRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType.APPLICATION_JSON_VALUE
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.context.WebApplicationContext

class MenuConfigurationResourceIT : BaseIntegrationTest() {

    @Autowired
    lateinit var webApplicationContext: WebApplicationContext

    @Autowired
    lateinit var menuConfigurationRepository: MenuConfigurationRepository

    @Autowired
    lateinit var objectMapper: ObjectMapper

    lateinit var mockMvc: MockMvc

    @BeforeEach
    fun beforeEach() {
        mockMvc = MockMvcBuilders
            .webAppContextSetup(webApplicationContext)
            .build()
    }

    @AfterEach
    fun afterEach() {
        menuConfigurationRepository.deleteAll()
    }

    @Test
    fun `should get empty configuration when none exists`() {
        mockMvc.perform(
            get("/api/v1/admin-settings/menu-configuration")
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.configuration").isMap)
            .andExpect(jsonPath("$.configuration").isEmpty)
    }

    @Test
    fun `should update and round-trip the menu configuration`() {
        val body = """{"configuration":{"version":1,"items":[{"kind":"catalog","itemId":"dashboard"}]}}"""

        mockMvc.perform(
            put("/api/management/v1/admin-settings/menu-configuration")
                .contentType(APPLICATION_JSON_VALUE)
                .content(body)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.configuration.version").value(1))
            .andExpect(jsonPath("$.configuration.items[0].itemId").value("dashboard"))

        mockMvc.perform(
            get("/api/v1/admin-settings/menu-configuration")
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.configuration.version").value(1))
            .andExpect(jsonPath("$.configuration.items[0].kind").value("catalog"))
            .andExpect(jsonPath("$.configuration.items[0].itemId").value("dashboard"))
    }

    @Test
    fun `should replace the configuration on update`() {
        mockMvc.perform(
            put("/api/management/v1/admin-settings/menu-configuration")
                .contentType(APPLICATION_JSON_VALUE)
                .content("""{"configuration":{"version":1,"items":[{"kind":"catalog","itemId":"cases"}]}}""")
        )
            .andExpect(status().isOk)

        mockMvc.perform(
            put("/api/management/v1/admin-settings/menu-configuration")
                .contentType(APPLICATION_JSON_VALUE)
                .content("""{"configuration":{"version":2,"items":[]}}""")
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.configuration.version").value(2))
            .andExpect(jsonPath("$.configuration.items").isEmpty)
    }
}
