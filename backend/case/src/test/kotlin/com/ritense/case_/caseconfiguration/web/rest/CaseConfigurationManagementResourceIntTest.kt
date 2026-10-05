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

package com.ritense.case_.caseconfiguration.web.rest

import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case.web.rest.dto.CaseDefinitionDraftCreateRequest
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.DefaultMockMvcBuilder
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.context.WebApplicationContext

@Transactional
class CaseConfigurationManagementResourceIntTest @Autowired constructor(
    private val webApplicationContext: WebApplicationContext,
    private val caseDefinitionService: CaseDefinitionService,
) : BaseIntegrationTest() {

    private lateinit var mockMvc: MockMvc

    @BeforeEach
    fun setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
            .apply<DefaultMockMvcBuilder>(springSecurity())
            .build()
        runWithoutAuthorization {
            caseDefinitionService.createCaseDefinitionDraft(
                CaseDefinitionDraftCreateRequest(caseDefinitionKey = KEY, caseDefinitionVersion = VERSION, name = "Resource test")
            )
        }
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should manage declarations and environment values as admin`() {
        mockMvc.perform(post(BASE).json("""{"key": "notificationEmail", "defaultValue": "test@example.com"}"""))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.key").value("notificationEmail"))
            .andExpect(jsonPath("$.defaultValue").value("test@example.com"))

        mockMvc.perform(put("$BASE/notificationEmail").json("""{"defaultValue": "other@example.com"}"""))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.defaultValue").value("other@example.com"))

        mockMvc.perform(put("$BASE/notificationEmail/environment-value").json("""{"value": "afdeling@example.com"}"""))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.environmentValue").value("afdeling@example.com"))

        mockMvc.perform(get(BASE))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].key").value("notificationEmail"))
            .andExpect(jsonPath("$[0].defaultValue").value("other@example.com"))
            .andExpect(jsonPath("$[0].environmentValue").value("afdeling@example.com"))

        mockMvc.perform(delete("$BASE/notificationEmail/environment-value"))
            .andExpect(status().isNoContent)
        mockMvc.perform(get(BASE))
            .andExpect(jsonPath("$[0].environmentValue").doesNotExist())

        mockMvc.perform(delete("$BASE/notificationEmail"))
            .andExpect(status().isNoContent)
        mockMvc.perform(get(BASE))
            .andExpect(jsonPath("$").isEmpty)
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should refuse a duplicate key, an invalid key and an undeclared key`() {
        mockMvc.perform(post(BASE).json("""{"key": "notificationEmail"}""")).andExpect(status().isOk)

        mockMvc.perform(post(BASE).json("""{"key": "notificationEmail"}""")).andExpect(status().isConflict)
        mockMvc.perform(post(BASE).json("""{"key": "notification email"}""")).andExpect(status().isBadRequest)
        mockMvc.perform(post(BASE).json("""{"key": " "}""")).andExpect(status().isBadRequest)
        mockMvc.perform(put("$BASE/missing/environment-value").json("""{"value": "x"}""")).andExpect(status().isNotFound)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should forbid every configuration endpoint for non-admins`() {
        mockMvc.perform(get(BASE)).andExpect(status().isForbidden)
        mockMvc.perform(post(BASE).json("""{"key": "notificationEmail"}""")).andExpect(status().isForbidden)
        mockMvc.perform(put("$BASE/notificationEmail").json("""{"defaultValue": "x"}""")).andExpect(status().isForbidden)
        mockMvc.perform(delete("$BASE/notificationEmail")).andExpect(status().isForbidden)
        mockMvc.perform(put("$BASE/notificationEmail/environment-value").json("""{"value": "x"}""")).andExpect(status().isForbidden)
        mockMvc.perform(delete("$BASE/notificationEmail/environment-value")).andExpect(status().isForbidden)
    }

    private fun org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder.json(body: String) =
        contentType(MediaType.APPLICATION_JSON).content(body)

    private companion object {
        const val KEY = "config-resource"
        const val VERSION = "1.0.0"
        const val BASE = "/api/management/v1/case-definition/$KEY/version/$VERSION/configuration"
    }
}
