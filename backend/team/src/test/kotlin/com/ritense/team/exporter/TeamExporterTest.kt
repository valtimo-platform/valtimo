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
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.team.domain.Team
import com.ritense.team.service.TeamService
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.skyscreamer.jsonassert.JSONAssert
import org.skyscreamer.jsonassert.JSONCompareMode
import org.springframework.data.domain.PageImpl

class TeamExporterTest {

    private val objectMapper = ObjectMapper()
    private val teamService: TeamService = mock()
    private val teamExporter = TeamExporter(objectMapper, teamService)

    @Test
    fun `should export teams`(): Unit = runWithoutAuthorization {
        val team1 = Team("team-1", "Team 1")
        val team2 = Team("team-2", "Team 2")
        whenever(teamService.findAll()).thenReturn(PageImpl(listOf(team1, team2)))

        val exportResult = teamExporter.export(TeamExportRequest())
        val exportFiles = exportResult.exportFiles

        assert(exportFiles.size == 1)
        val file1 = exportFiles.find { it.path == "config/global/team/default.team.json" }!!

        JSONAssert.assertEquals(
            """[{"key":"team-1","title":"Team 1"},{"key":"team-2","title":"Team 2"}]""",
            objectMapper.writeValueAsString(objectMapper.readTree(file1.content)),
            JSONCompareMode.NON_EXTENSIBLE
        )
    }
}
