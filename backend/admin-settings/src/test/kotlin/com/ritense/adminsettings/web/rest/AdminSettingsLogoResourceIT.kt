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
import com.ritense.adminsettings.repository.AdminSettingsLogoRepository
import com.ritense.adminsettings.web.rest.dto.CreateAdminSettingsLogoDto
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType.APPLICATION_JSON_VALUE
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.context.WebApplicationContext

class AdminSettingsLogoResourceIT : BaseIntegrationTest() {

    @Autowired
    lateinit var webApplicationContext: WebApplicationContext

    @Autowired
    lateinit var adminSettingsLogoRepository: AdminSettingsLogoRepository

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
        adminSettingsLogoRepository.deleteAll()
    }

    @Test
    fun `should get empty logos when none exist`() {
        mockMvc.perform(
            get("/api/v1/admin-settings/logos")
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.logo").isEmpty)
            .andExpect(jsonPath("$.logoDarkMode").isEmpty)
    }

    @Test
    fun `should upload logo`() {
        val dto = CreateAdminSettingsLogoDto(imageBase64 = VALID_PNG_BASE64)

        mockMvc.perform(
            post("/api/management/v1/admin-settings/logo/{logoType}", "LOGO")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.logoType").value("LOGO"))
            .andExpect(jsonPath("$.imageBase64").isNotEmpty)
    }

    @Test
    fun `should upload dark mode logo`() {
        val dto = CreateAdminSettingsLogoDto(imageBase64 = VALID_PNG_BASE64)

        mockMvc.perform(
            post("/api/management/v1/admin-settings/logo/{logoType}", "LOGO_DARK_MODE")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.logoType").value("LOGO_DARK_MODE"))
            .andExpect(jsonPath("$.imageBase64").isNotEmpty)
    }

    @Test
    fun `should get logos after uploading`() {
        val dto = CreateAdminSettingsLogoDto(imageBase64 = VALID_PNG_BASE64)

        mockMvc.perform(
            post("/api/management/v1/admin-settings/logo/{logoType}", "LOGO")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andExpect(status().isOk)

        mockMvc.perform(
            get("/api/v1/admin-settings/logos")
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.logo.logoType").value("LOGO"))
            .andExpect(jsonPath("$.logo.imageBase64").isNotEmpty)
            .andExpect(jsonPath("$.logoDarkMode").isEmpty)
    }

    @Test
    fun `should get single logo by type`() {
        val dto = CreateAdminSettingsLogoDto(imageBase64 = VALID_PNG_BASE64)

        mockMvc.perform(
            post("/api/management/v1/admin-settings/logo/{logoType}", "LOGO")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andExpect(status().isOk)

        mockMvc.perform(
            get("/api/management/v1/admin-settings/logo/{logoType}", "LOGO")
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.logoType").value("LOGO"))
            .andExpect(jsonPath("$.imageBase64").isNotEmpty)
    }

    @Test
    fun `should return 404 for non-existing logo type`() {
        mockMvc.perform(
            get("/api/management/v1/admin-settings/logo/{logoType}", "LOGO")
        )
            .andDo(print())
            .andExpect(status().isNotFound)
    }

    @Test
    fun `should replace existing logo`() {
        val dto1 = CreateAdminSettingsLogoDto(imageBase64 = VALID_PNG_BASE64)

        mockMvc.perform(
            post("/api/management/v1/admin-settings/logo/{logoType}", "LOGO")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto1))
        )
            .andExpect(status().isOk)

        val dto2 = CreateAdminSettingsLogoDto(imageBase64 = VALID_PNG_BASE64)

        mockMvc.perform(
            post("/api/management/v1/admin-settings/logo/{logoType}", "LOGO")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto2))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.logoType").value("LOGO"))

        assertThat(adminSettingsLogoRepository.findAll()).hasSize(1)
    }

    @Test
    fun `should delete logo`() {
        val dto = CreateAdminSettingsLogoDto(imageBase64 = VALID_PNG_BASE64)

        mockMvc.perform(
            post("/api/management/v1/admin-settings/logo/{logoType}", "LOGO")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andExpect(status().isOk)

        mockMvc.perform(
            delete("/api/management/v1/admin-settings/logo/{logoType}", "LOGO")
        )
            .andDo(print())
            .andExpect(status().isNoContent)

        assertThat(adminSettingsLogoRepository.findAll()).isEmpty()
    }

    @Test
    fun `should delete non-existing logo without error`() {
        mockMvc.perform(
            delete("/api/management/v1/admin-settings/logo/{logoType}", "LOGO")
        )
            .andDo(print())
            .andExpect(status().isNoContent)
    }

    @Test
    fun `should upload both logo types independently`() {
        val dto = CreateAdminSettingsLogoDto(imageBase64 = VALID_PNG_BASE64)

        mockMvc.perform(
            post("/api/management/v1/admin-settings/logo/{logoType}", "LOGO")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andExpect(status().isOk)

        mockMvc.perform(
            post("/api/management/v1/admin-settings/logo/{logoType}", "LOGO_DARK_MODE")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andExpect(status().isOk)

        mockMvc.perform(
            get("/api/v1/admin-settings/logos")
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.logo.logoType").value("LOGO"))
            .andExpect(jsonPath("$.logo.imageBase64").isNotEmpty)
            .andExpect(jsonPath("$.logoDarkMode.logoType").value("LOGO_DARK_MODE"))
            .andExpect(jsonPath("$.logoDarkMode.imageBase64").isNotEmpty)
    }

    @Test
    fun `should delete one logo type without affecting the other`() {
        val dto = CreateAdminSettingsLogoDto(imageBase64 = VALID_PNG_BASE64)

        mockMvc.perform(
            post("/api/management/v1/admin-settings/logo/{logoType}", "LOGO")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andExpect(status().isOk)

        mockMvc.perform(
            post("/api/management/v1/admin-settings/logo/{logoType}", "LOGO_DARK_MODE")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andExpect(status().isOk)

        mockMvc.perform(
            delete("/api/management/v1/admin-settings/logo/{logoType}", "LOGO")
        )
            .andExpect(status().isNoContent)

        mockMvc.perform(
            get("/api/v1/admin-settings/logos")
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.logo").isEmpty)
            .andExpect(jsonPath("$.logoDarkMode.logoType").value("LOGO_DARK_MODE"))
            .andExpect(jsonPath("$.logoDarkMode.imageBase64").isNotEmpty)
    }

    companion object {
        // Minimal valid 1x1 PNG image encoded as base64
        const val VALID_PNG_BASE64 =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC"
    }
}
