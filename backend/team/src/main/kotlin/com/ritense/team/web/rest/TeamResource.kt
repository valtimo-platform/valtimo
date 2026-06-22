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

import com.ritense.team.domain.Team
import com.ritense.valtimo.contract.authentication.TeamManagementService
import com.ritense.team.web.rest.dto.TeamCreateRequestDto
import com.ritense.team.web.rest.dto.TeamListResponseDto
import com.ritense.team.web.rest.dto.TeamResponseDto
import com.ritense.team.web.rest.dto.TeamUpdateRequestDto
import com.ritense.team.web.rest.dto.TeamUserCreateRequestDto
import com.ritense.team.web.rest.dto.TeamUserResponseDto
import jakarta.validation.Valid
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.authentication.ManageableUser
import com.ritense.valtimo.contract.authentication.UserManagementService
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.web.SortDefault
import org.springframework.data.web.SortDefault.SortDefaults
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api/v1/team")
class TeamResource(
    private val teamManagementService: TeamManagementService,
    private val userManagementService: UserManagementService,
) {

    @GetMapping
    fun getAllTeams(
        @RequestParam(required = false) titleContains: String?,
        @SortDefaults(SortDefault(sort = ["title"])) pageable: Pageable,
    ): Page<TeamListResponseDto> {
        return teamManagementService.findAll(titleContains, pageable).map { TeamListResponseDto.from(it) }
    }

    @GetMapping("/{key}")
    fun getTeamById(@PathVariable key: String): TeamResponseDto {
        val team = teamManagementService.findByKey(key) ?: error("Team not found")
        return TeamResponseDto.from(team)
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun createTeam(@Valid @RequestBody request: TeamCreateRequestDto): TeamResponseDto {
        val team = teamManagementService.create(Team(key = request.key, title = request.title))
        return TeamResponseDto.from(team)
    }

    @PutMapping("/{key}")
    fun updateTeam(@PathVariable key: String, @Valid @RequestBody request: TeamUpdateRequestDto): TeamResponseDto {
        val team = teamManagementService.update(key, request.title)
        return TeamResponseDto.from(team)
    }

    @DeleteMapping("/{key}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteTeam(@PathVariable key: String) {
        teamManagementService.delete(key)
    }

    @GetMapping("/{teamKey}/user")
    fun getTeamUsers(
        @PathVariable teamKey: String,
        @RequestParam(required = false) username: String?,
        @SortDefaults(SortDefault(sort = ["id.username"])) pageable: Pageable
    ): Page<TeamUserResponseDto> {
        return teamManagementService.findAllTeamUsernames(teamKey = teamKey, username = username, pageable = pageable)
            .map { uname -> TeamUserResponseDto.from(userManagementService.findByUsername(uname)) }
    }

    @PostMapping("/{teamKey}/user")
    @ResponseStatus(HttpStatus.CREATED)
    fun addUserToTeam(
        @PathVariable teamKey: String,
        @Valid @RequestBody request: TeamUserCreateRequestDto
    ): TeamUserResponseDto {
        val username = teamManagementService.addUserToTeam(request.username, teamKey)
        return TeamUserResponseDto.from(userManagementService.findByUsername(username))
    }

    @DeleteMapping("/{teamKey}/user/{username}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun removeUserFromTeam(
        @PathVariable teamKey: String,
        @PathVariable username: String
    ) {
        teamManagementService.removeUserFromTeam(username, teamKey)
    }

    @GetMapping("/{teamKey}/candidate-user")
    fun getCandidateUsers(@PathVariable teamKey: String): List<ManageableUser> {
        val memberUsernames = teamManagementService.findAllTeamUsernames(teamKey = teamKey).content.toSet()
        return userManagementService.allUsers
            .filter { it.username !in memberUsernames }
    }
}
