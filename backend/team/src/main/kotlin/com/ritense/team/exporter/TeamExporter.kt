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

package com.ritense.team.exporter

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportPrettyPrinter
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.team.service.TeamService
import com.ritense.team.web.rest.dto.TeamResponseDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
@SkipComponentScan
@Transactional(readOnly = true)
class TeamExporter(
    private val objectMapper: ObjectMapper,
    private val teamService: TeamService,
) : Exporter<TeamExportRequest> {

    override fun supports(): Class<TeamExportRequest> = TeamExportRequest::class.java

    override fun export(request: TeamExportRequest): ExportResult {
        val teams = if (request.teamKey != null) {
            teamService.findById(request.teamKey)?.let { listOf(it) } ?: emptyList()
        } else {
            teamService.findAll()
        }

        if (teams.isEmpty()) {
            return ExportResult()
        }

        val teamDtos = teams.map { TeamResponseDto.from(it) }
        val fileName = request.teamKey ?: "teams"

        val exportFile = ExportFile(
            PATH.format(fileName),
            objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(teamDtos)
        )

        return ExportResult(setOf(exportFile))
    }

    companion object {
        const val PATH = "config/global/team/%s.team.json"
    }
}
