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
import com.ritense.authorization.AuthorizationContext
import com.ritense.team.BaseIntegrationTest
import com.ritense.team.domain.Team
import com.ritense.team.service.TeamService
import com.ritense.team.web.rest.dto.TeamCreateRequestDto
import com.ritense.team.web.rest.dto.TeamUpdateRequestDto
import com.ritense.team.web.rest.dto.TeamUserCreateRequestDto
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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.context.WebApplicationContext

class TeamResourceIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var teamService: TeamService

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
    fun `should create and get team via REST`() {
        val createRequest = TeamCreateRequestDto(key = "rest-team", title = "Rest Team")

        mockMvc.perform(
            post("/api/v1/team")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createRequest))
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.key").value("rest-team"))
            .andExpect(jsonPath("$.title").value("Rest Team"))

        mockMvc.perform(get("/api/v1/team/rest-team"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.key").value("rest-team"))

        mockMvc.perform(get("/api/v1/team"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[?(@.key == 'rest-team')]").exists())
    }

    @Test
    @WithMockUser(username = "admin", authorities = [ADMIN])
    fun `should update and delete team via REST`() {
        AuthorizationContext.runWithoutAuthorization {
            teamService.create(Team(key = "team-to-update", title = "Old Title"))
        }

        val updateRequest = TeamUpdateRequestDto(key = "team-to-update", title = "New Title")

        mockMvc.perform(
            put("/api/v1/team/team-to-update")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateRequest))
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.title").value("New Title"))

        mockMvc.perform(delete("/api/v1/team/team-to-update"))
            .andExpect(status().isNoContent)
    }

    @Test
    @WithMockUser(username = "admin", authorities = [ADMIN])
    fun `should manage team users via REST`() {
        teamService.create(Team(key = "team-users", title = "Team with Users"))

        val username = "user1"
        val userRequest = TeamUserCreateRequestDto(username = username)

        mockMvc.perform(
            post("/api/v1/team/team-users/user")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(userRequest))
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$").value(username))

        mockMvc.perform(get("/api/v1/team/team-users/user"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$", hasSize<Any>(1)))
            .andExpect(jsonPath("$[0]").value(username))

        mockMvc.perform(delete("/api/v1/team/team-users/user/$username"))
            .andExpect(status().isNoContent)

        mockMvc.perform(get("/api/v1/team/team-users/user"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$", hasSize<Any>(0)))
    }
}
