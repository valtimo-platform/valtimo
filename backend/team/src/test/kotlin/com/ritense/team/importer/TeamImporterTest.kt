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
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.importer.ImportRequest
import com.ritense.team.domain.Team
import com.ritense.team.service.TeamService
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class TeamImporterTest {

    private val objectMapper = ObjectMapper().registerKotlinModule()
    private val teamService: TeamService = mock()
    private val teamImporter = TeamImporter(objectMapper, teamService)

    @Test
    fun `should import team`(): Unit = runWithoutAuthorization {
        val json = """[{"key":"team-1","title":"Team 1"}]"""
        val request = ImportRequest(
            fileName = "config/global/team/teams.team.json",
            content = json.toByteArray(Charsets.UTF_8)
        )

        whenever(teamService.findById("team-1")).thenReturn(null)

        teamImporter.import(request)

        verify(teamService).create(any())
    }

    @Test
    fun `should update existing team on import`(): Unit = runWithoutAuthorization {
        val existingTeam = Team("team-1", "Old Title")
        whenever(teamService.findById("team-1")).thenReturn(existingTeam)

        val json = """[{"key":"team-1","title":"New Title"}]"""
        val request = ImportRequest(
            fileName = "config/global/team/teams.team.json",
            content = json.toByteArray(Charsets.UTF_8)
        )

        teamImporter.import(request)

        verify(teamService).update("team-1", "New Title")
    }
}
