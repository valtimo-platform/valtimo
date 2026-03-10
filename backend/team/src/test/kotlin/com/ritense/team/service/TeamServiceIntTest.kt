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

package com.ritense.team.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.team.BaseIntegrationTest
import com.ritense.team.domain.Team
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.test.context.support.WithMockUser

class TeamServiceIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var teamService: TeamService


    @Test
    @WithMockUser(username = ADMIN_USER_NAME, authorities = [ADMIN])
    fun `should create team when user has permission`() {
        val team = Team(key = "team1", title = "Team 1")
        val createdTeam = teamService.create(team)

        assertThat(createdTeam.key).isEqualTo("team1")
        assertThat(createdTeam.title).isEqualTo("Team 1")
    }

    @Test
    @WithMockUser(username = NORMAL_USER_NAME, authorities = [USER])
    fun `should fail to update team when user lacks modify permission`() {
        runWithoutAuthorization {
            teamService.create(Team(key = "team2", title = "Team 2"))
        }

        assertThrows<AccessDeniedException> {
            teamService.update("team2", "Updated Title")
        }
    }

    @Test
    @WithMockUser(username = ADMIN_USER_NAME, authorities = [ADMIN])
    fun `should update team when user has modify permission`() {
        teamService.create(Team(key = "team3", title = "Team 3"))

        val updatedTeam = teamService.update("team3", "Updated Title")
        assertThat(updatedTeam.title).isEqualTo("Updated Title")
    }

    @Test
    @WithMockUser(username = ADMIN_USER_NAME, authorities = [ADMIN])
    fun `should delete team when user has delete permission`() {
        teamService.create(Team(key = "team4", title = "Team 4"))

        teamService.delete("team4")
        assertThat(teamService.findById("team4")).isNull()
    }

    @Test
    @WithMockUser(username = ADMIN_USER_NAME, authorities = [ADMIN])
    fun `should add and remove user from team`() {
        teamService.create(Team(key = "team5", title = "Team 5"))

        val username = "user1"
        val teamUser = teamService.addUserToTeam(username, "team5")
        assertThat(teamUser.username).isEqualTo(username)
        assertThat(teamUser.teamKey).isEqualTo("team5")

        val teamUsers = teamService.findAllTeamUsers(teamKey = "team5")
        assertThat(teamUsers).hasSize(1)
        assertThat(teamUsers[0].username).isEqualTo(username)

        teamService.removeUserFromTeam(username, "team5")
        assertThat(teamService.findAllTeamUsers(teamKey = "team5")).isEmpty()
    }

    @Test
    @WithMockUser(username = ADMIN_USER_NAME, authorities = [ADMIN])
    fun `should find all teams with filter`() {
        teamService.create(Team(key = "alpha", title = "Alpha Team"))
        teamService.create(Team(key = "beta", title = "Beta Team"))

        val allTeams = teamService.findAll()
        assertThat(allTeams).isNotEmpty
        assertThat(allTeams).hasAtLeastOneElementOfType(Team::class.java)

        val filteredTeams = teamService.findAll(titleContains = "Alpha")
        assertThat(filteredTeams).hasSize(1)
        assertThat(filteredTeams[0].key).isEqualTo("alpha")
    }
}
