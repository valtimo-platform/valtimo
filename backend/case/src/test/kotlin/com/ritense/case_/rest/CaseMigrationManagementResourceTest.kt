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
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
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
        // The plan is meant to run on its scheduledAtDate or after its runAfter predecessor. Starting it
        // by hand would run it at a moment its author ruled out, so the endpoint refuses instead of
        // relying on the UI having disabled its button.
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
        // The importer validates the plan itself (missing source, source == target, unknown condition
        // operator, ...) and throws IllegalArgumentException. On this path the caller wrote the plan,
        // so it has to read as a bad request rather than as a server fault.
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
        // The run guards refuse a plan whose declared source was never deployed (it would select nothing
        // and report COMPLETED) and a building block plan started on its own. Both are `require`, so both
        // arrive here as IllegalArgumentException, and both name the plan's problem — a 500 would tell the
        // editor the server broke instead.
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
        // Same guards run ahead of a dry run, so the same translation has to hold there — this is where an
        // author checks a plan before committing to it, and it is the likeliest place to meet the refusal.
        whenever(caseMigrationRunner.startDryRun(any()))
            .thenThrow(IllegalArgumentException("declares source 'verhuizing:9.9.9', which is not deployed"))

        assertThatThrownBy { resource.startDryRun("woninginspectie", "1.0.4", "plan") }
            .isInstanceOf(ResponseStatusException::class.java)
            .satisfies({ thrown ->
                assertThat((thrown as ResponseStatusException).statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
                assertThat(thrown.reason).contains("which is not deployed")
            })
    }
}
