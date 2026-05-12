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
import com.ritense.adminsettings.repository.FeatureToggleOverridesRepository
import com.ritense.adminsettings.web.rest.dto.UpdateFeatureToggleDto
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType.APPLICATION_JSON_VALUE
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.context.WebApplicationContext

class FeatureToggleOverridesResourceIT : BaseIntegrationTest() {

    @Autowired
    lateinit var webApplicationContext: WebApplicationContext

    @Autowired
    lateinit var featureToggleOverridesRepository: FeatureToggleOverridesRepository

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
        featureToggleOverridesRepository.deleteAll()
    }

    @Test
    fun `should get empty overrides when none exist`() {
        mockMvc.perform(
            get("/api/v1/admin-settings/feature-toggles")
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.overrides").isMap)
            .andExpect(jsonPath("$.overrides").isEmpty)
    }

    @Test
    fun `should update feature toggle`() {
        val dto = UpdateFeatureToggleDto(key = "enableDashboard", enabled = true)

        mockMvc.perform(
            put("/api/management/v1/admin-settings/feature-toggles")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.overrides.enableDashboard").value(true))
    }

    @Test
    fun `should update multiple feature toggles`() {
        val dto1 = UpdateFeatureToggleDto(key = "enableDashboard", enabled = true)
        val dto2 = UpdateFeatureToggleDto(key = "compactModeOnByDefault", enabled = false)

        mockMvc.perform(
            put("/api/management/v1/admin-settings/feature-toggles")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto1))
        )
            .andExpect(status().isOk)

        mockMvc.perform(
            put("/api/management/v1/admin-settings/feature-toggles")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto2))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.overrides.enableDashboard").value(true))
            .andExpect(jsonPath("$.overrides.compactModeOnByDefault").value(false))
    }

    @Test
    fun `should overwrite existing toggle value`() {
        val dto = UpdateFeatureToggleDto(key = "enableDashboard", enabled = true)

        mockMvc.perform(
            put("/api/management/v1/admin-settings/feature-toggles")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andExpect(status().isOk)

        val updatedDto = UpdateFeatureToggleDto(key = "enableDashboard", enabled = false)

        mockMvc.perform(
            put("/api/management/v1/admin-settings/feature-toggles")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(updatedDto))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.overrides.enableDashboard").value(false))
    }

    @Test
    fun `should get overrides after updating`() {
        val dto = UpdateFeatureToggleDto(key = "enableDashboard", enabled = true)

        mockMvc.perform(
            put("/api/management/v1/admin-settings/feature-toggles")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andExpect(status().isOk)

        mockMvc.perform(
            get("/api/v1/admin-settings/feature-toggles")
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.overrides.enableDashboard").value(true))
    }

    @Test
    fun `should remove feature toggle`() {
        val dto = UpdateFeatureToggleDto(key = "enableDashboard", enabled = true)

        mockMvc.perform(
            put("/api/management/v1/admin-settings/feature-toggles")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andExpect(status().isOk)

        mockMvc.perform(
            delete("/api/management/v1/admin-settings/feature-toggles/{key}", "enableDashboard")
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.overrides.enableDashboard").doesNotExist())
            .andExpect(jsonPath("$.overrides").isEmpty)
    }

    @Test
    fun `should remove non-existing toggle without error`() {
        mockMvc.perform(
            delete("/api/management/v1/admin-settings/feature-toggles/{key}", "nonExistingKey")
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.overrides").isEmpty)
    }

    @Test
    fun `should remove one toggle and keep others`() {
        val dto1 = UpdateFeatureToggleDto(key = "enableDashboard", enabled = true)
        val dto2 = UpdateFeatureToggleDto(key = "compactModeOnByDefault", enabled = false)

        mockMvc.perform(
            put("/api/management/v1/admin-settings/feature-toggles")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto1))
        )
            .andExpect(status().isOk)

        mockMvc.perform(
            put("/api/management/v1/admin-settings/feature-toggles")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto2))
        )
            .andExpect(status().isOk)

        mockMvc.perform(
            delete("/api/management/v1/admin-settings/feature-toggles/{key}", "enableDashboard")
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.overrides.enableDashboard").doesNotExist())
            .andExpect(jsonPath("$.overrides.compactModeOnByDefault").value(false))
    }
}
