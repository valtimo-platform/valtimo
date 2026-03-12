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
import com.ritense.team.service.TeamService
import com.ritense.team.web.rest.dto.TeamCreateRequestDto
import com.ritense.team.web.rest.dto.TeamListResponseDto
import com.ritense.team.web.rest.dto.TeamResponseDto
import com.ritense.team.web.rest.dto.TeamUpdateRequestDto
import com.ritense.team.web.rest.dto.TeamUserCreateRequestDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.authentication.ManageableUser
import com.ritense.valtimo.contract.authentication.UserManagementService
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
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
    private val teamService: TeamService,
    private val userManagementService: UserManagementService,
) {

    @GetMapping
    fun getAllTeams(
        @RequestParam(required = false) titleContains: String?,
        pageable: Pageable
    ): Page<TeamListResponseDto> {
        return teamService.findAll(titleContains, pageable).map { TeamListResponseDto.from(it) }
    }

    @GetMapping("/{key}")
    fun getTeamById(@PathVariable key: String): TeamResponseDto {
        val team = teamService.findById(key) ?: throw IllegalArgumentException("Team not found")
        return TeamResponseDto.from(team)
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun createTeam(@RequestBody request: TeamCreateRequestDto): TeamResponseDto {
        val team = teamService.create(Team(key = request.key, title = request.title))
        return TeamResponseDto.from(team)
    }

    @PutMapping("/{key}")
    fun updateTeam(@PathVariable key: String, @RequestBody request: TeamUpdateRequestDto): TeamResponseDto {
        require(request.key == key) { "Key in request does not match path variable" }
        val team = teamService.update(key, request.title)
        return TeamResponseDto.from(team)
    }

    @DeleteMapping("/{key}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteTeam(@PathVariable key: String) {
        teamService.delete(key)
    }

    @GetMapping("/{teamKey}/user")
    fun getTeamUsers(
        @PathVariable teamKey: String,
        @RequestParam(required = false) username: String?,
        pageable: Pageable
    ): Page<ManageableUser> {
        return teamService.findAllTeamUsers(teamKey = teamKey, username = username, pageable = pageable)
            .map { teamUser -> userManagementService.findByUsername(teamUser.username) }
    }

    @PostMapping("/{teamKey}/user")
    @ResponseStatus(HttpStatus.CREATED)
    fun addUserToTeam(
        @PathVariable teamKey: String,
        @RequestBody request: TeamUserCreateRequestDto
    ): ManageableUser {
        val teamUser = teamService.addUserToTeam(request.username, teamKey)
        return userManagementService.findByUsername(teamUser.username)
    }

    @DeleteMapping("/{teamKey}/user/{username}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun removeUserFromTeam(
        @PathVariable teamKey: String,
        @PathVariable username: String
    ) {
        teamService.removeUserFromTeam(username, teamKey)
    }

    @GetMapping("/{teamKey}/candidate-user")
    fun getCandidateUsers(@PathVariable teamKey: String): List<ManageableUser> {
        val teamMembers = teamService.findAllTeamUsers(teamKey = teamKey)
        val memberUsernames = teamMembers.content.map { it.username }.toSet()
        return userManagementService.allUsers
            .filter { it.username !in memberUsernames }
    }
}
