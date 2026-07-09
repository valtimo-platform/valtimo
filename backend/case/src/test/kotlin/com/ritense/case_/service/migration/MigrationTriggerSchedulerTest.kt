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

package com.ritense.case_.service.migration

import com.ritense.case_.domain.migration.CaseDefinitionMigration
import com.ritense.case_.domain.migration.CaseDefinitionMigrationExecution
import com.ritense.case_.domain.migration.CaseMigrationStatus
import com.ritense.case_.domain.migration.MigrationTriggers
import com.ritense.case_.repository.CaseDefinitionMigrationExecutionRepository
import com.ritense.case_.repository.CaseDefinitionMigrationRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.junit.jupiter.MockitoSettings
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.mockito.quality.Strictness
import java.time.LocalDateTime
import java.util.Optional

@ExtendWith(MockitoExtension::class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MigrationTriggerSchedulerTest(
    @Mock private val migrationRepository: CaseDefinitionMigrationRepository,
    @Mock private val executionRepository: CaseDefinitionMigrationExecutionRepository,
    @Mock private val caseMigrationService: CaseMigrationService,
) {

    private lateinit var scheduler: MigrationTriggerScheduler

    private val caseDefinitionId = CaseDefinitionId("bezwaar", "1.0.1")

    @BeforeEach
    fun setUp() {
        scheduler = MigrationTriggerScheduler(migrationRepository, executionRepository, caseMigrationService)
        whenever(executionRepository.findReclaimable(any())).thenReturn(emptyList())
        whenever(migrationRepository.findAllWithoutExecution()).thenReturn(emptyList())
    }

    private fun migrationId(key: String) = BlueprintMigrationId.from(caseDefinitionId, key)

    private fun plan(key: String, triggers: MigrationTriggers) =
        CaseDefinitionMigration(id = migrationId(key), title = key, migrationTriggers = triggers)

    @Test
    fun `should reclaim crashed runs whose lease has expired`() {
        whenever(executionRepository.findReclaimable(any()))
            .thenReturn(listOf(CaseDefinitionMigrationExecution(migrationId("crashed"), CaseMigrationStatus.RUNNING)))

        scheduler.checkTriggers()

        verify(caseMigrationService).startMigration(migrationId("crashed"))
    }

    @Test
    fun `should start a scheduled plan once its date has passed`() {
        whenever(migrationRepository.findAllWithoutExecution())
            .thenReturn(listOf(plan("scheduled", MigrationTriggers(scheduledAtDate = LocalDateTime.of(2020, 1, 1, 0, 0)))))

        scheduler.checkTriggers()

        verify(caseMigrationService).startMigration(migrationId("scheduled"))
    }

    @Test
    fun `should not start a scheduled plan before its date`() {
        whenever(migrationRepository.findAllWithoutExecution())
            .thenReturn(listOf(plan("later", MigrationTriggers(scheduledAtDate = LocalDateTime.now().plusDays(1)))))

        scheduler.checkTriggers()

        verify(caseMigrationService, never()).startMigration(any())
    }

    @Test
    fun `should start a runAfter plan once its predecessor has finished`() {
        whenever(migrationRepository.findAllWithoutExecution())
            .thenReturn(listOf(plan("successor", MigrationTriggers(runAfter = "predecessor"))))
        whenever(executionRepository.findById(migrationId("predecessor")))
            .thenReturn(Optional.of(CaseDefinitionMigrationExecution(migrationId("predecessor"), CaseMigrationStatus.COMPLETED)))

        scheduler.checkTriggers()

        verify(caseMigrationService).startMigration(migrationId("successor"))
    }

    @Test
    fun `should not start a runAfter plan while its predecessor is unfinished`() {
        whenever(migrationRepository.findAllWithoutExecution())
            .thenReturn(listOf(plan("successor", MigrationTriggers(runAfter = "predecessor"))))
        whenever(executionRepository.findById(migrationId("predecessor")))
            .thenReturn(Optional.of(CaseDefinitionMigrationExecution(migrationId("predecessor"), CaseMigrationStatus.RUNNING)))

        scheduler.checkTriggers()

        verify(caseMigrationService, never()).startMigration(any())
    }

    @Test
    fun `should refresh the case-count estimate for a plan that is not due to run`() {
        whenever(migrationRepository.findAllWithoutExecution())
            .thenReturn(listOf(plan("manual", MigrationTriggers(triggeredByButton = true))))

        scheduler.checkTriggers()

        verify(caseMigrationService).refreshCaseCountEstimate(migrationId("manual"))
        verify(caseMigrationService, never()).startMigration(any())
    }

    @Test
    fun `should not refresh the estimate for a plan that is being triggered`() {
        whenever(migrationRepository.findAllWithoutExecution())
            .thenReturn(listOf(plan("scheduled", MigrationTriggers(scheduledAtDate = LocalDateTime.of(2020, 1, 1, 0, 0)))))

        scheduler.checkTriggers()

        verify(caseMigrationService).startMigration(migrationId("scheduled"))
        verify(caseMigrationService, never()).refreshCaseCountEstimate(any())
    }
}
