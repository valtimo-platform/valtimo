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

package com.ritense.team.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.team.BaseIntegrationTest
import com.ritense.team.service.TeamManagementServiceImpl
import com.ritense.team.web.rest.dto.AdHocTeamCreateRequestDto
import org.hamcrest.Matchers.hasSize
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.context.WebApplicationContext
import java.util.UUID

class AdHocTeamResourceIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var teamManagementService: TeamManagementServiceImpl

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var webApplicationContext: WebApplicationContext

    lateinit var mockMvc: MockMvc

    @BeforeEach
    override fun beforeEach() {
        super.beforeEach()
        mockMvc = MockMvcBuilders
            .webAppContextSetup(this.webApplicationContext)
            .build()
    }

    @Test
    @WithMockUser(username = "admin", authorities = [ADMIN])
    fun `should create ad hoc team with generated title via REST`() {
        val caseId = UUID.randomUUID()

        mockMvc.perform(
            post("/api/v1/case/$caseId/team")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}")
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.key").isNotEmpty)
            .andExpect(jsonPath("$.title").value("Ad hoc team"))
            .andExpect(jsonPath("$.adHocCaseDocumentId").value(caseId.toString()))
    }

    @Test
    @WithMockUser(username = "admin", authorities = [ADMIN])
    fun `should create ad hoc team with custom title via REST`() {
        val caseId = UUID.randomUUID()
        val request = AdHocTeamCreateRequestDto(title = "My Custom Team")

        mockMvc.perform(
            post("/api/v1/case/$caseId/team")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request))
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.title").value("My Custom Team"))
    }

    @Test
    @WithMockUser(username = "admin", authorities = [ADMIN])
    fun `should list ad hoc teams for a case via REST`() {
        val caseId = UUID.randomUUID()
        val otherCaseId = UUID.randomUUID()

        runWithoutAuthorization {
            teamManagementService.createAdHocTeam(caseId, "Team A")
            teamManagementService.createAdHocTeam(caseId, "Team B")
            teamManagementService.createAdHocTeam(otherCaseId, "Team C")
        }

        mockMvc.perform(get("/api/v1/case/$caseId/team"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content", hasSize<Any>(2)))
    }

    @Test
    @WithMockUser(username = "admin", authorities = [ADMIN])
    fun `should delete ad hoc team via REST`() {
        val caseId = UUID.randomUUID()

        val team = runWithoutAuthorization {
            teamManagementService.createAdHocTeam(caseId, "To Delete")
        }

        mockMvc.perform(delete("/api/v1/case/$caseId/team/${team.key}"))
            .andExpect(status().isNoContent)

        mockMvc.perform(get("/api/v1/case/$caseId/team"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content", hasSize<Any>(0)))
    }

    @Test
    @WithMockUser(username = "admin", authorities = [ADMIN])
    fun `should not list ad hoc teams in regular team endpoint`() {
        val caseId = UUID.randomUUID()

        runWithoutAuthorization {
            teamManagementService.createAdHocTeam(caseId, "Hidden Ad Hoc")
        }

        mockMvc.perform(get("/api/v1/team"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content[?(@.title == 'Hidden Ad Hoc')]").doesNotExist())
    }
}
