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
import com.ritense.valtimo.contract.authentication.TeamDeletedEvent
import com.ritense.valtimo.contract.authentication.TeamManagementService
import com.ritense.valtimo.contract.authentication.TeamUpdatedEvent
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.domain.Specification
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import com.ritense.valtimo.contract.authentication.Team as TeamInterface

@Service
@SkipComponentScan
@Transactional
class TeamManagementServiceImpl(
    private val teamRepository: TeamRepository,
    private val teamUserRepository: TeamUserRepository,
    private val authorizationService: AuthorizationService,
    private val eventPublisher: ApplicationEventPublisher,
) : TeamManagementService {

    @Transactional(readOnly = true)
    override fun findAll(
        titleContains: String?,
        pageable: Pageable
    ): Page<TeamInterface> {
        var specification: Specification<Team> = authorizationService.getAuthorizationSpecification(
            EntityAuthorizationRequest(
                Team::class.java,
                TeamActionProvider.VIEW_LIST
            )
        )

        specification = specification.and(TeamRepositoryConfigSpecificationHelper.byAdHocCaseDocumentIdIsNull())

        if (titleContains != null) {
            specification = specification.and(TeamRepositoryConfigSpecificationHelper.byTitleContains(titleContains))
        }
        specification = specification.and(TeamRepositoryConfigSpecificationHelper.fetchUsers())
        val teams = teamRepository.findAll(specification, pageable)
        return teams.map { it as TeamInterface }
    }

    @Transactional(readOnly = true)
    override fun findByKey(teamKey: String): Team? {
        val team = teamRepository.findByKeyWithUsers(teamKey).orElse(null) ?: return null

        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                Team::class.java,
                TeamActionProvider.VIEW,
                team
            )
        )
        return team
    }

    override fun create(team: TeamInterface): TeamInterface {
        val teamEntity = Team(team.key, team.title)
        requirePermission(teamEntity, TeamActionProvider.CREATE)
        return teamRepository.save(teamEntity)
    }

    override fun update(key: String, title: String): TeamInterface {
        val team = teamRepository.findById(key).orElseThrow { error("Team not found") }
        requirePermission(team, TeamActionProvider.MODIFY)
        team.title = title
        val savedTeam = teamRepository.save(team)
        eventPublisher.publishEvent(TeamUpdatedEvent(key, title))
        return savedTeam
    }

    override fun delete(key: String) {
        val team = teamRepository.findById(key).orElseThrow { error("Team not found") }
        requirePermission(team, TeamActionProvider.DELETE)
        teamRepository.deleteById(key)
        eventPublisher.publishEvent(TeamDeletedEvent(key))
    }

    override fun findAllTeamUsernames(
        teamKey: String?,
        username: String?,
        pageable: Pageable
    ): Page<String> {
        var specification = Specification.unrestricted<TeamUser>()
        if (teamKey != null) {
            val team = teamRepository.findById(teamKey).orElse(null)

            requirePermission(team, TeamActionProvider.VIEW)
            specification = specification.and(TeamUserRepositoryConfigSpecificationHelper.byTeamKey(teamKey))
        }

        if (username != null) {
            specification = specification.and(TeamUserRepositoryConfigSpecificationHelper.byUsername(username))
        }
        return teamUserRepository.findAll(specification, pageable).map { it.username }
    }

    override fun addUserToTeam(username: String, teamKey: String): String {
        val team = teamRepository.findById(teamKey).orElseThrow { error("Team not found") }
        requirePermission(team, TeamActionProvider.ASSIGN)
        teamUserRepository.save(TeamUser(id = TeamUserId(username, teamKey), team = team))
        return username
    }

    override fun removeUserFromTeam(username: String, teamKey: String) {
        val team = teamRepository.findById(teamKey).orElseThrow { error("Team not found") }
        requirePermission(team, TeamActionProvider.ASSIGN)
        val specification = TeamUserRepositoryConfigSpecificationHelper.byTeamKey(teamKey)
            .and(TeamUserRepositoryConfigSpecificationHelper.byUsername(username))
        val teamUsers = teamUserRepository.findAll(specification)
        teamUserRepository.deleteAll(teamUsers)
    }

    override fun findTeamKeysByUsername(username: String): List<String> {
        val specification = TeamUserRepositoryConfigSpecificationHelper.byUsername(username)
        return teamUserRepository.findAll(specification).map { it.teamKey }
    }

    override fun findAll(pageable: Pageable): Page<TeamInterface> {
        return findAll(titleContains = null, pageable = pageable)
    }

    override fun createAdHocTeam(adHocCaseDocumentId: UUID, title: String?): TeamInterface {
        val generatedKey = "adhoc-${UUID.randomUUID()}"
        val generatedTitle = title ?: "Ad hoc team"
        val team = Team(
            key = generatedKey,
            title = generatedTitle,
            adHocCaseDocumentId = adHocCaseDocumentId
        )
        requirePermission(team, TeamActionProvider.CREATE)
        return teamRepository.save(team)
    }

    @Transactional(readOnly = true)
    override fun findAllByAdHocCaseDocumentId(
        adHocCaseDocumentId: UUID,
        titleContains: String?,
        pageable: Pageable
    ): Page<TeamInterface> {
        var specification: Specification<Team> = authorizationService.getAuthorizationSpecification(
            EntityAuthorizationRequest(
                Team::class.java,
                TeamActionProvider.VIEW_LIST
            )
        )

        specification = specification.and(TeamRepositoryConfigSpecificationHelper.byAdHocCaseDocumentId(adHocCaseDocumentId))

        if (titleContains != null) {
            specification = specification.and(TeamRepositoryConfigSpecificationHelper.byTitleContains(titleContains))
        }
        specification = specification.and(TeamRepositoryConfigSpecificationHelper.fetchUsers())
        return teamRepository.findAll(specification, pageable).map { it as TeamInterface }
    }

    override fun deleteAllByAdHocCaseDocumentId(adHocCaseDocumentId: UUID) {
        teamRepository.deleteByAdHocCaseDocumentId(adHocCaseDocumentId)
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
