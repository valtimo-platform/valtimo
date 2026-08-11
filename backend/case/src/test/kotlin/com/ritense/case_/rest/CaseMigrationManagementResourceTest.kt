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

    private val resource = CaseMigrationManagementResource(
        caseMigrationService,
        mock<MigrationPlanImporter>(),
        mock<MigrationPlanExporter>(),
        mock<MigrationSuggestionService>(),
    )

    private val caseDefinitionId = CaseDefinitionId("woninginspectie", "1.0.4")
    private val migrationId = BlueprintMigrationId.from(caseDefinitionId, "plan")

    @Test
    fun `starting a plan by hand runs it when the plan has the button trigger`() {
        whenever(caseMigrationService.isTriggeredByButton(migrationId)).thenReturn(true)
        whenever(caseMigrationService.getStatus(any())).thenReturn(mock<MigrationExecutionStatusDto>())

        resource.startMigration("woninginspectie", "1.0.4", "plan")

        verify(caseMigrationService).startMigration(eq(migrationId))
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

        verify(caseMigrationService, never()).startMigration(any())
    }

    @Test
    fun `a dry run is allowed regardless of the triggers, since it changes nothing`() {
        resource.startDryRun("woninginspectie", "1.0.4", "plan")

        verify(caseMigrationService).startDryRun(eq(migrationId))
        verify(caseMigrationService, never()).isTriggeredByButton(any())
    }
}
