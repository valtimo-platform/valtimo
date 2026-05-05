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

package com.ritense.outbox

import liquibase.database.Database
import liquibase.exception.LiquibaseException
import liquibase.lockservice.DatabaseChangeLogLock
import liquibase.lockservice.LockService
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.boot.autoconfigure.liquibase.LiquibaseProperties
import java.time.Instant
import java.util.Date
import javax.sql.DataSource

class OutboxLiquibaseRunnerTest {

    private val thresholdMinutes = 30
    private val runner = OutboxLiquibaseRunner(
        LiquibaseProperties(),
        mock<DataSource>(),
        thresholdMinutes,
    )

    @Test
    fun `force-releases stale outbox lock`() {
        val lockService = mock<LockService>()
        val staleLock = DatabaseChangeLogLock(
            1,
            Date.from(Instant.now().minusSeconds((thresholdMinutes + 5) * 60L)),
            "previous-pod (10.0.0.1)",
        )
        whenever(lockService.listLocks()).thenReturn(arrayOf(staleLock))

        runner.forceReleaseStaleLock(lockService)

        verify(lockService, times(1)).forceReleaseLock()
    }

    @Test
    fun `leaves fresh outbox lock alone`() {
        val lockService = mock<LockService>()
        val freshLock = DatabaseChangeLogLock(
            1,
            Date.from(Instant.now().minusSeconds(60L)),
            "current-pod (10.0.0.2)",
        )
        whenever(lockService.listLocks()).thenReturn(arrayOf(freshLock))

        runner.forceReleaseStaleLock(lockService)

        verify(lockService, never()).forceReleaseLock()
    }

    @Test
    fun `no-op when no outbox lock held`() {
        val lockService = mock<LockService>()
        whenever(lockService.listLocks()).thenReturn(emptyArray())

        runner.forceReleaseStaleLock(lockService)

        verify(lockService, never()).forceReleaseLock()
    }

    @Test
    fun `releases lock even when migration throws`() {
        val lockService = mock<LockService>()
        val database = mock<Database>()
        val failingRunner = object : OutboxLiquibaseRunner(LiquibaseProperties(), mock<DataSource>(), thresholdMinutes) {
            override fun applyChangeLog(database: Database) {
                throw LiquibaseException("boom")
            }
        }

        assertThatThrownBy { failingRunner.executeMigration(database, lockService) }
            .isInstanceOf(LiquibaseException::class.java)
            .hasMessage("boom")

        verify(lockService).releaseLock()
    }

    @Test
    fun `shutdown hook is no-op when lock not held`() {
        val datasource = mock<DataSource>()
        val lockService = mock<LockService>()
        whenever(lockService.hasChangeLogLock()).thenReturn(false)

        val hookRunner = OutboxLiquibaseRunner(LiquibaseProperties(), datasource, thresholdMinutes)

        val hook = hookRunner.newShutdownHook(lockService)
        hook.start()
        hook.join()

        verify(lockService).hasChangeLogLock()
        verify(datasource, never()).connection
    }
}
