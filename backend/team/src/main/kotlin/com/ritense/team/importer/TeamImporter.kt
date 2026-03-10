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

package com.ritense.team.importer

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes
import com.ritense.team.domain.Team
import com.ritense.team.service.TeamService
import com.ritense.team.web.rest.dto.TeamResponseDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
@SkipComponentScan
@Transactional
class TeamImporter(
    private val objectMapper: ObjectMapper,
    private val teamService: TeamService
) : Importer {

    override fun type(): String = ValtimoImportTypes.TEAM

    override fun dependsOn(): Set<String> = emptySet()

    override fun supports(fileName: String): Boolean = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val fileContent = request.content.toString(Charsets.UTF_8)
        val teamDtos = objectMapper.readValue<List<TeamResponseDto>>(fileContent)

        teamDtos.forEach { teamDto ->
            val existingTeam = teamService.findById(teamDto.key)
            if (existingTeam != null) {
                teamService.update(teamDto.key, teamDto.title)
            } else {
                teamService.create(Team(teamDto.key, teamDto.title))
            }
            teamDto.users.forEach { username ->
                teamService.addUserToTeam(username, teamDto.key)
            }
        }
    }

    override fun partOfCaseDefinition(): Boolean = false

    companion object {
        private val FILENAME_REGEX = """config/global/team/(?:.*/)?(.+)\.team\.json""".toRegex()
    }
}
