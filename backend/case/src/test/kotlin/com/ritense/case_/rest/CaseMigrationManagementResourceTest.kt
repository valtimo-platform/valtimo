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

package com.ritense.case_.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case_.service.migration.CaseMigrationRunner
import com.ritense.case_.service.migration.CaseMigrationService
import com.ritense.case_.service.migration.MigrationExecutionStatusDto
import com.ritense.case_.service.migration.MigrationPlanExporter
import com.ritense.case_.service.migration.MigrationPlanImporter
import com.ritense.case_.service.migration.MigrationSuggestionService
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException

@ExtendWith(MockitoExtension::class)
class CaseMigrationManagementResourceTest {

    private val caseMigrationService = mock<CaseMigrationService>()
    private val caseMigrationRunner = mock<CaseMigrationRunner>()
    private val migrationPlanImporter = mock<MigrationPlanImporter>()
    private val migrationSuggestionService = mock<MigrationSuggestionService>()

    private val resource = CaseMigrationManagementResource(
        caseMigrationService,
        caseMigrationRunner,
        migrationPlanImporter,
        mock<MigrationPlanExporter>(),
        migrationSuggestionService,
    )

    private val caseDefinitionId = CaseDefinitionId("woninginspectie", "1.0.4")
    private val migrationId = BlueprintMigrationId.from(caseDefinitionId, "plan")

    @Test
    fun `starting a plan by hand runs it when the plan has the button trigger`() {
        whenever(caseMigrationService.isTriggeredByButton(migrationId)).thenReturn(true)
        whenever(caseMigrationService.getStatus(any())).thenReturn(mock<MigrationExecutionStatusDto>())

        resource.startMigration("woninginspectie", "1.0.4", "plan")

        verify(caseMigrationRunner).startMigration(eq(migrationId))
    }

    @Test
    fun `starting a plan by hand is refused when the plan does not have the button trigger`() {
        // Starting it by hand would run it at a moment its author ruled out, so the endpoint refuses rather than relying on the UI having disabled the button.
        whenever(caseMigrationService.isTriggeredByButton(migrationId)).thenReturn(false)

        assertThatThrownBy { resource.startMigration("woninginspectie", "1.0.4", "plan") }
            .isInstanceOf(ResponseStatusException::class.java)
            .satisfies({ thrown ->
                assertThat((thrown as ResponseStatusException).statusCode).isEqualTo(HttpStatus.CONFLICT)
                assertThat(thrown.reason).contains("cannot be started manually")
            })

        verify(caseMigrationRunner, never()).startMigration(any())
    }

    @Test
    fun `a plan the importer refuses is answered 400, not 500`() {
        // The importer throws IllegalArgumentException for a malformed plan, and on this path the caller wrote it — a bad request, not a server fault.
        val plan = ObjectMapper().createObjectNode()
        whenever(migrationSuggestionService.findPlanProblems(any(), any())).thenReturn(emptyList())
        whenever(migrationPlanImporter.deploy(any(), any()))
            .thenThrow(IllegalArgumentException("A migration plan requires a non-blank 'key'"))

        assertThatThrownBy { resource.saveMigrationPlan("woninginspectie", "1.0.4", plan) }
            .isInstanceOf(ResponseStatusException::class.java)
            .satisfies({ thrown ->
                assertThat((thrown as ResponseStatusException).statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
                assertThat(thrown.reason).contains("non-blank 'key'")
            })
    }

    @Test
    fun `a dry run is allowed regardless of the triggers, since it changes nothing`() {
        resource.startDryRun("woninginspectie", "1.0.4", "plan")

        verify(caseMigrationRunner).startDryRun(eq(migrationId))
        verify(caseMigrationService, never()).isTriggeredByButton(any())
    }

    @Test
    fun `a run the service refuses is answered 400, not 500`() {
        // The run guards refuse an undeployed source and a standalone building block plan. Both are `require`, and both name the plan's problem — a 500 would say the server broke.
        whenever(caseMigrationService.isTriggeredByButton(migrationId)).thenReturn(true)
        whenever(caseMigrationRunner.startMigration(any()))
            .thenThrow(IllegalArgumentException("declares source 'verhuizing:9.9.9', which is not deployed"))

        assertThatThrownBy { resource.startMigration("woninginspectie", "1.0.4", "plan") }
            .isInstanceOf(ResponseStatusException::class.java)
            .satisfies({ thrown ->
                assertThat((thrown as ResponseStatusException).statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
                assertThat(thrown.reason).contains("which is not deployed")
            })
    }

    @Test
    fun `a dry run the service refuses is answered 400, not 500`() {
        // The same guards run ahead of a dry run, which is the likeliest place to meet the refusal.
        whenever(caseMigrationRunner.startDryRun(any()))
            .thenThrow(IllegalArgumentException("declares source 'verhuizing:9.9.9', which is not deployed"))

        assertThatThrownBy { resource.startDryRun("woninginspectie", "1.0.4", "plan") }
            .isInstanceOf(ResponseStatusException::class.java)
            .satisfies({ thrown ->
                assertThat((thrown as ResponseStatusException).statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
                assertThat(thrown.reason).contains("which is not deployed")
            })
    }

    @Test
    fun `an add suggestion hijacks from the case as its instances still have it, not as the target version models it`() {
        // A process the target version handed to the block is gone from it — and is exactly the one the entry takes over.
        val block = BuildingBlockDefinitionId("inspectie-fotos", "1.0.1")
        val source = CaseDefinitionId("woninginspectie", "1.0.3")
        whenever(migrationSuggestionService.entryOwnerOf(any(), any())).thenReturn(caseDefinitionId)
        whenever(migrationSuggestionService.runningOwnerOf(any(), any(), anyOrNull())).thenReturn(source)
        whenever(migrationSuggestionService.suggestBuildingBlockEntry(any(), any(), any()))
            .thenReturn(ObjectMapper().createObjectNode())
        whenever(migrationSuggestionService.describeEntryOwner(any()))
            .thenReturn(ObjectMapper().createObjectNode())

        resource.suggestBuildingBlockEntry(
            "woninginspectie", "1.0.4", "inspectie-fotos", "1.0.1", "add", null, "1.0.3",
        )

        verify(migrationSuggestionService).runningOwnerOf(eq(caseDefinitionId), eq(caseDefinitionId), eq(source))
        verify(migrationSuggestionService).suggestBuildingBlockEntry(eq(caseDefinitionId), eq(block), eq(source))
    }
}
