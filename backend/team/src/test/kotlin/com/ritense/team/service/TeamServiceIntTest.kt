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

class TeamManagementServiceImplIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var teamManagementService: TeamManagementServiceImpl


    @Test
    @WithMockUser(username = ADMIN_USER_NAME, authorities = [ADMIN])
    fun `should create team when user has permission`() {
        val team = Team(key = "team1", title = "Team 1")
        val createdTeam = teamManagementService.create(team)

        assertThat(createdTeam.key).isEqualTo("team1")
        assertThat(createdTeam.title).isEqualTo("Team 1")
    }

    @Test
    @WithMockUser(username = NORMAL_USER_NAME, authorities = [USER])
    fun `should fail to update team when user lacks modify permission`() {
        runWithoutAuthorization {
            teamManagementService.create(Team(key = "team2", title = "Team 2"))
        }

        assertThrows<AccessDeniedException> {
            teamManagementService.update("team2", "Updated Title")
        }
    }

    @Test
    @WithMockUser(username = ADMIN_USER_NAME, authorities = [ADMIN])
    fun `should update team when user has modify permission`() {
        teamManagementService.create(Team(key = "team3", title = "Team 3"))

        val updatedTeam = teamManagementService.update("team3", "Updated Title")
        assertThat(updatedTeam.title).isEqualTo("Updated Title")
    }

    @Test
    @WithMockUser(username = ADMIN_USER_NAME, authorities = [ADMIN])
    fun `should delete team when user has delete permission`() {
        teamManagementService.create(Team(key = "team4", title = "Team 4"))

        teamManagementService.delete("team4")
        assertThat(teamManagementService.findByKey("team4")).isNull()
    }

    @Test
    @WithMockUser(username = ADMIN_USER_NAME, authorities = [ADMIN])
    fun `should add and remove user from team`() {
        teamManagementService.create(Team(key = "team5", title = "Team 5"))

        val username = "user1"
        val teamUser = teamManagementService.addUserToTeam(username, "team5")
        assertThat(teamUser.username).isEqualTo(username)
        assertThat(teamUser.teamKey).isEqualTo("team5")

        val teamUsers = teamManagementService.findAllTeamUsers(teamKey = "team5")
        assertThat(teamUsers.content).hasSize(1)
        assertThat(teamUsers.content[0].username).isEqualTo(username)

        teamManagementService.removeUserFromTeam(username, "team5")
        assertThat(teamManagementService.findAllTeamUsers(teamKey = "team5").content).isEmpty()
    }

    @Test
    @WithMockUser(username = ADMIN_USER_NAME, authorities = [ADMIN])
    fun `should find all teams with filter`() {
        teamManagementService.create(Team(key = "alpha", title = "Alpha Team"))
        teamManagementService.create(Team(key = "beta", title = "Beta Team"))

        val allTeams = teamManagementService.findAll()
        assertThat(allTeams.content).isNotEmpty
        assertThat(allTeams.content).hasAtLeastOneElementOfType(Team::class.java)

        val filteredTeams = teamManagementService.findAll(titleContains = "Alpha")
        assertThat(filteredTeams.content).hasSize(1)
        assertThat(filteredTeams.content[0].key).isEqualTo("alpha")
    }
}
