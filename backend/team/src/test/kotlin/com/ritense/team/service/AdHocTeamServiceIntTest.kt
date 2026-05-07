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
import com.ritense.valtimo.contract.event.DocumentDeletedEvent
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.ApplicationEventPublisher
import org.springframework.security.test.context.support.WithMockUser
import java.util.UUID

class AdHocTeamServiceIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var teamManagementService: TeamManagementServiceImpl

    @Autowired
    lateinit var eventPublisher: ApplicationEventPublisher

    @Test
    @WithMockUser(username = ADMIN_USER_NAME, authorities = [ADMIN])
    fun `should create ad hoc team with generated title`() {
        val caseId = UUID.randomUUID()

        val team = teamManagementService.createAdHocTeam(caseId)

        assertThat(team.key).startsWith("adhoc-")
        assertThat(team.title).isEqualTo("Ad hoc team")
        assertThat(team.adHocCaseDocumentId).isEqualTo(caseId)
        assertThat(team.adHoc).isTrue()
    }

    @Test
    @WithMockUser(username = ADMIN_USER_NAME, authorities = [ADMIN])
    fun `should create ad hoc team with custom title`() {
        val caseId = UUID.randomUUID()

        val team = teamManagementService.createAdHocTeam(caseId, "Custom Team")

        assertThat(team.title).isEqualTo("Custom Team")
        assertThat(team.adHocCaseDocumentId).isEqualTo(caseId)
    }

    @Test
    @WithMockUser(username = ADMIN_USER_NAME, authorities = [ADMIN])
    fun `should exclude ad hoc teams from findAll`() {
        val caseId = UUID.randomUUID()

        teamManagementService.create(Team(key = "regular-team-adhoc-test", title = "Regular"))
        teamManagementService.createAdHocTeam(caseId)

        val allTeams = teamManagementService.findAll()

        assertThat(allTeams.content).noneMatch { it.adHoc }
        assertThat(allTeams.content).anyMatch { it.key == "regular-team-adhoc-test" }
    }

    @Test
    @WithMockUser(username = ADMIN_USER_NAME, authorities = [ADMIN])
    fun `should find ad hoc teams by case document id`() {
        val caseId1 = UUID.randomUUID()
        val caseId2 = UUID.randomUUID()

        teamManagementService.createAdHocTeam(caseId1, "Team A")
        teamManagementService.createAdHocTeam(caseId1, "Team B")
        teamManagementService.createAdHocTeam(caseId2, "Team C")

        val teams = teamManagementService.findAllByAdHocCaseDocumentId(caseId1)

        assertThat(teams.content).hasSize(2)
        assertThat(teams.content.map { it.title }).containsExactlyInAnyOrder("Team A", "Team B")
    }

    @Test
    @WithMockUser(username = ADMIN_USER_NAME, authorities = [ADMIN])
    fun `should delete all ad hoc teams by case document id`() {
        val caseId = UUID.randomUUID()

        teamManagementService.createAdHocTeam(caseId, "To Delete 1")
        teamManagementService.createAdHocTeam(caseId, "To Delete 2")

        teamManagementService.deleteAllByAdHocCaseDocumentId(caseId)

        val teams = teamManagementService.findAllByAdHocCaseDocumentId(caseId)
        assertThat(teams.content).isEmpty()
    }

    @Test
    @WithMockUser(username = ADMIN_USER_NAME, authorities = [ADMIN])
    fun `should cleanup ad hoc teams on DocumentDeletedEvent`() {
        val caseId = UUID.randomUUID()

        teamManagementService.createAdHocTeam(caseId, "Event Cleanup")

        eventPublisher.publishEvent(DocumentDeletedEvent(caseId))

        val teams = runWithoutAuthorization {
            teamManagementService.findAllByAdHocCaseDocumentId(caseId)
        }
        assertThat(teams.content).isEmpty()
    }
}
