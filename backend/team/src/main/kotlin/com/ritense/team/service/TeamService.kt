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

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.team.domain.Team
import com.ritense.team.domain.TeamUser
import com.ritense.team.domain.TeamUserId
import com.ritense.team.repository.TeamRepository
import com.ritense.team.repository.TeamRepositoryConfigSpecificationHelper
import com.ritense.team.repository.TeamUserRepository
import com.ritense.team.repository.TeamUserRepositoryConfigSpecificationHelper
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.authentication.TeamProvider
import org.springframework.data.jpa.domain.Specification
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@SkipComponentScan
@Transactional
class TeamService(
    private val teamRepository: TeamRepository,
    private val teamUserRepository: TeamUserRepository,
    private val authorizationService: AuthorizationService,
) : TeamProvider {
    @Transactional(readOnly = true)
    fun findAll(titleContains: String? = null): List<Team> {
        val specification = if (titleContains != null) {
            TeamRepositoryConfigSpecificationHelper.byTitleContains(titleContains)
        } else {
            Specification.unrestricted()
        }
        val teams = teamRepository.findAll(specification)
        teams.forEach { team -> team.users.size } // Initialize lazy collection
        return teams
    }

    @Transactional(readOnly = true)
    fun findById(key: String): Team? {
        val team = teamRepository.findById(key).orElse(null)
        team?.users?.size // Initialize lazy collection
        return team
    }

    fun create(team: Team): Team {
        requirePermission(team, TeamActionProvider.CREATE)
        val createdTeam = teamRepository.save(team)
        createdTeam.users.size // Initialize lazy collection
        return createdTeam
    }

    fun update(key: String, title: String): Team {
        val team = teamRepository.findById(key).orElseThrow { IllegalArgumentException("Team not found") }
        requirePermission(team, TeamActionProvider.MODIFY)
        team.title = title
        val updatedTeam = teamRepository.save(team)
        updatedTeam.users.size // Initialize lazy collection
        return updatedTeam
    }

    fun delete(key: String) {
        val team = teamRepository.findById(key).orElseThrow { IllegalArgumentException("Team not found") }
        requirePermission(team, TeamActionProvider.DELETE)
        teamRepository.deleteById(key)
    }

    fun findAllTeamUsers(teamKey: String? = null, username: String? = null): List<TeamUser> {
        var specification = Specification.unrestricted<TeamUser>()
        if (teamKey != null) {
            specification = specification.and(TeamUserRepositoryConfigSpecificationHelper.byTeamKey(teamKey))
        }
        if (username != null) {
            specification = specification.and(TeamUserRepositoryConfigSpecificationHelper.byUsername(username))
        }
        return teamUserRepository.findAll(specification)
    }

    fun addUserToTeam(username: String, teamKey: String): TeamUser {
        val team = teamRepository.findById(teamKey).orElseThrow { IllegalArgumentException("Team not found") }
        requirePermission(team, TeamActionProvider.ASSIGN)
        return teamUserRepository.save(TeamUser(id = TeamUserId(username, teamKey), team = team))
    }

    fun removeUserFromTeam(username: String, teamKey: String) {
        val team = teamRepository.findById(teamKey).orElseThrow { IllegalArgumentException("Team not found") }
        requirePermission(team, TeamActionProvider.ASSIGN)
        val specification = TeamUserRepositoryConfigSpecificationHelper.byTeamKey(teamKey)
            .and(TeamUserRepositoryConfigSpecificationHelper.byUsername(username))
        val teamUsers = teamUserRepository.findAll(specification)
        teamUserRepository.deleteAll(teamUsers)
    }

    override fun findTeamKeysByUsername(username: String): List<String> {
        return findAllTeamUsers(username = username).map { it.teamKey }
    }

    private fun requirePermission(team: Team, action: Action<Team>) {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                Team::class.java,
                action,
                team
            )
        )
    }
}
