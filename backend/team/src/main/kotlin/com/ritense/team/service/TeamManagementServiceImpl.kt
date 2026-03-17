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
import com.ritense.valtimo.contract.authentication.TeamManagementService
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.domain.Specification
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import com.ritense.valtimo.contract.authentication.Team as TeamInterface

@Service
@SkipComponentScan
@Transactional
class TeamManagementServiceImpl(
    private val teamRepository: TeamRepository,
    private val teamUserRepository: TeamUserRepository,
    private val authorizationService: AuthorizationService,
) : TeamManagementService {

    @Transactional(readOnly = true)
    fun findAll(
        titleContains: String? = null,
        pageable: Pageable = Pageable.unpaged()
    ): Page<Team> {
        var specification: Specification<Team> = authorizationService.getAuthorizationSpecification(
            EntityAuthorizationRequest(
                Team::class.java,
                TeamActionProvider.VIEW_LIST
            )
        )

        if (titleContains != null) {
            specification = specification.and(TeamRepositoryConfigSpecificationHelper.byTitleContains(titleContains))
        }
        val teams = teamRepository.findAll(specification, pageable)
        teams.forEach { team -> team.users.size } // Initialize lazy collection
        return teams
    }

    @Transactional(readOnly = true)
    override fun findByKey(teamKey: String): Team? {
        val team = teamRepository.findById(teamKey).orElse(null)
        team?.users?.size // Initialize lazy collection

        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                Team::class.java,
                TeamActionProvider.VIEW,
                team
            )
        )
        return team
    }

    fun create(team: Team): Team {
        requirePermission(team, TeamActionProvider.CREATE)
        return teamRepository.save(team)
    }

    fun update(key: String, title: String): Team {
        val team = teamRepository.findById(key).orElseThrow { IllegalArgumentException("Team not found") }
        requirePermission(team, TeamActionProvider.MODIFY)
        team.title = title
        return teamRepository.save(team)
    }

    fun delete(key: String) {
        val team = teamRepository.findById(key).orElseThrow { IllegalArgumentException("Team not found") }
        requirePermission(team, TeamActionProvider.DELETE)
        teamRepository.deleteById(key)
    }

    fun findAllTeamUsers(
        teamKey: String? = null,
        username: String? = null,
        pageable: Pageable = Pageable.unpaged()
    ): Page<TeamUser> {
        var specification = Specification.unrestricted<TeamUser>()
        if (teamKey != null) {
            val team = teamRepository.findById(teamKey).orElse(null)

            authorizationService.requirePermission(
                EntityAuthorizationRequest(
                    Team::class.java,
                    TeamActionProvider.VIEW,
                    team
                )
            )
            specification = specification.and(TeamUserRepositoryConfigSpecificationHelper.byTeamKey(teamKey))
        }

        if (username != null) {
            specification = specification.and(TeamUserRepositoryConfigSpecificationHelper.byUsername(username))
        }
        return teamUserRepository.findAll(specification, pageable)
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
        return findAllTeamUsers(username = username).content.map { it.teamKey }
    }

    override fun findAll(pageable: Pageable): Page<TeamInterface> {
        return findAll(titleContains = null, pageable = pageable).map { team -> team as TeamInterface }
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
