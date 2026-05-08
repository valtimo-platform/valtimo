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
import com.ritense.adminsettings.repository.AccentColorsRepository
import com.ritense.adminsettings.web.rest.dto.AccentColorsDto
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

class AccentColorsResourceIT : BaseIntegrationTest() {

    @Autowired
    lateinit var webApplicationContext: WebApplicationContext

    @Autowired
    lateinit var accentColorsRepository: AccentColorsRepository

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
        accentColorsRepository.deleteAll()
    }

    @Test
    fun `should get empty colors when none exist`() {
        mockMvc.perform(
            get("/api/v1/admin-settings/accent-colors")
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.colors").isMap)
            .andExpect(jsonPath("$.colors").isEmpty)
    }

    @Test
    fun `should update accent colors`() {
        val dto = AccentColorsDto(
            colors = mapOf(
                "--vcds-color-100" to "#002547",
                "--vcds-color-90" to "#002c54"
            )
        )

        mockMvc.perform(
            put("/api/management/v1/admin-settings/accent-colors")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.colors.--vcds-color-100").value("#002547"))
            .andExpect(jsonPath("$.colors.--vcds-color-90").value("#002c54"))
    }

    @Test
    fun `should get colors after updating`() {
        val dto = AccentColorsDto(
            colors = mapOf(
                "--vcds-color-100" to "#002547",
                "--vcds-color-50" to "#61aedf"
            )
        )

        mockMvc.perform(
            put("/api/management/v1/admin-settings/accent-colors")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andExpect(status().isOk)

        mockMvc.perform(
            get("/api/v1/admin-settings/accent-colors")
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.colors.--vcds-color-100").value("#002547"))
            .andExpect(jsonPath("$.colors.--vcds-color-50").value("#61aedf"))
    }

    @Test
    fun `should overwrite existing colors`() {
        val dto = AccentColorsDto(
            colors = mapOf(
                "--vcds-color-100" to "#002547",
                "--vcds-color-90" to "#002c54"
            )
        )

        mockMvc.perform(
            put("/api/management/v1/admin-settings/accent-colors")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andExpect(status().isOk)

        val updatedDto = AccentColorsDto(
            colors = mapOf(
                "--vcds-color-100" to "#ffffff",
                "--vcds-color-90" to "#eeeeee",
                "--vcds-color-80" to "#dddddd"
            )
        )

        mockMvc.perform(
            put("/api/management/v1/admin-settings/accent-colors")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(updatedDto))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.colors.--vcds-color-100").value("#ffffff"))
            .andExpect(jsonPath("$.colors.--vcds-color-90").value("#eeeeee"))
            .andExpect(jsonPath("$.colors.--vcds-color-80").value("#dddddd"))
    }

    @Test
    fun `should replace all colors on update`() {
        val dto = AccentColorsDto(
            colors = mapOf(
                "--vcds-color-100" to "#002547",
                "--vcds-color-90" to "#002c54"
            )
        )

        mockMvc.perform(
            put("/api/management/v1/admin-settings/accent-colors")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andExpect(status().isOk)

        val newDto = AccentColorsDto(
            colors = mapOf(
                "--vcds-color-50" to "#61aedf"
            )
        )

        mockMvc.perform(
            put("/api/management/v1/admin-settings/accent-colors")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(newDto))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.colors.--vcds-color-50").value("#61aedf"))
            .andExpect(jsonPath("$.colors.--vcds-color-100").doesNotExist())
            .andExpect(jsonPath("$.colors.--vcds-color-90").doesNotExist())
    }

    @Test
    fun `should update with empty colors map`() {
        val dto = AccentColorsDto(
            colors = mapOf(
                "--vcds-color-100" to "#002547"
            )
        )

        mockMvc.perform(
            put("/api/management/v1/admin-settings/accent-colors")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(dto))
        )
            .andExpect(status().isOk)

        val emptyDto = AccentColorsDto(colors = emptyMap())

        mockMvc.perform(
            put("/api/management/v1/admin-settings/accent-colors")
                .contentType(APPLICATION_JSON_VALUE)
                .content(objectMapper.writeValueAsString(emptyDto))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.colors").isMap)
            .andExpect(jsonPath("$.colors").isEmpty)
    }
}
