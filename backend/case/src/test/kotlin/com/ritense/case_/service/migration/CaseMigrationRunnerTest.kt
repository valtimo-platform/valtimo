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

import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.core.task.SyncTaskExecutor
import org.springframework.core.task.TaskExecutor
import org.springframework.core.task.TaskRejectedException

@ExtendWith(MockitoExtension::class)
class CaseMigrationRunnerTest(
    @Mock private val caseMigrationService: CaseMigrationService,
) {

    private val migrationId = BlueprintMigrationId.from(CaseDefinitionId("bezwaar", "1.0.1"), "plan")

    /** Runs the dispatched work on the calling thread, so the assertions can see its effect. */
    private fun runnerOn(executor: TaskExecutor) = CaseMigrationRunner(caseMigrationService, executor)

    @Test
    fun `should claim first and then run the claimed plan`() {
        whenever(caseMigrationService.claimMigration(migrationId)).thenReturn("token")

        val started = runnerOn(SyncTaskExecutor()).startMigration(migrationId)

        assertThat(started).isTrue()
        verify(caseMigrationService).claimMigration(migrationId)
        verify(caseMigrationService).runClaimedMigration(migrationId, "token")
    }

    @Test
    fun `should not dispatch anything when the plan is already running`() {
        whenever(caseMigrationService.claimMigration(migrationId)).thenReturn(null)

        val started = runnerOn(SyncTaskExecutor()).startMigration(migrationId)

        assertThat(started).isFalse()
        verify(caseMigrationService, never()).runClaimedMigration(any(), any())
    }

    @Test
    fun `should swallow a failing run so the pool thread is not the one to report it`() {
        whenever(caseMigrationService.claimMigration(migrationId)).thenReturn("token")
        whenever(caseMigrationService.runClaimedMigration(migrationId, "token"))
            .thenThrow(RuntimeException("boom"))

        // Nothing rethrown: the lapsed lease is what gets the run reclaimed and resumed.
        assertThat(runnerOn(SyncTaskExecutor()).startMigration(migrationId)).isTrue()
    }

    @Test
    fun `should give the claim back when the pool has no capacity`() {
        whenever(caseMigrationService.claimMigration(migrationId)).thenReturn("token")
        val fullPool = TaskExecutor { throw TaskRejectedException("full") }

        assertThatThrownBy { runnerOn(fullPool).startMigration(migrationId) }
            .isInstanceOf(TaskRejectedException::class.java)

        // Without this the plan would sit RUNNING with nobody running it until the lease lapsed.
        verify(caseMigrationService).abandonClaim(migrationId, "token")
    }

    @Test
    fun `should claim and run a dry run the same way`() {
        whenever(caseMigrationService.claimDryRun(migrationId)).thenReturn("token")

        assertThat(runnerOn(SyncTaskExecutor()).startDryRun(migrationId)).isTrue()

        verify(caseMigrationService).runClaimedDryRun(migrationId, "token")
    }

    @Test
    fun `should give a dry run claim back when the pool has no capacity`() {
        whenever(caseMigrationService.claimDryRun(migrationId)).thenReturn("token")
        val fullPool = TaskExecutor { throw TaskRejectedException("full") }

        assertThatThrownBy { runnerOn(fullPool).startDryRun(migrationId) }
            .isInstanceOf(TaskRejectedException::class.java)

        verify(caseMigrationService).abandonDryRunClaim(migrationId, "token")
    }
}
