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

package com.ritense.valtimo.contract.config;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import javax.sql.DataSource;
import liquibase.database.Database;
import liquibase.exception.LiquibaseException;
import liquibase.lockservice.DatabaseChangeLogLock;
import liquibase.lockservice.LockService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.liquibase.LiquibaseProperties;

class LiquibaseRunnerTest {

    private static final int THRESHOLD_MINUTES = 30;

    private final LiquibaseRunner runner = new LiquibaseRunner(
        Collections.emptyList(),
        new LiquibaseProperties(),
        mock(DataSource.class),
        THRESHOLD_MINUTES
    );

    @Test
    void forceReleasesStaleLock() throws Exception {
        LockService lockService = mock(LockService.class);
        DatabaseChangeLogLock staleLock = new DatabaseChangeLogLock(
            1,
            Date.from(Instant.now().minusSeconds((THRESHOLD_MINUTES + 5) * 60L)),
            "previous-pod (10.0.0.1)"
        );
        when(lockService.listLocks()).thenReturn(new DatabaseChangeLogLock[]{staleLock});

        runner.forceReleaseStaleLock(lockService);

        verify(lockService, times(1)).forceReleaseLock();
    }

    @Test
    void leavesFreshLockAlone() throws Exception {
        LockService lockService = mock(LockService.class);
        DatabaseChangeLogLock freshLock = new DatabaseChangeLogLock(
            1,
            Date.from(Instant.now().minusSeconds(60L)),
            "current-pod (10.0.0.2)"
        );
        when(lockService.listLocks()).thenReturn(new DatabaseChangeLogLock[]{freshLock});

        runner.forceReleaseStaleLock(lockService);

        verify(lockService, never()).forceReleaseLock();
    }

    @Test
    void noOpWhenNoLockHeld() throws Exception {
        LockService lockService = mock(LockService.class);
        when(lockService.listLocks()).thenReturn(new DatabaseChangeLogLock[]{});

        runner.forceReleaseStaleLock(lockService);

        verify(lockService, never()).forceReleaseLock();
    }

    @Test
    void releasesLockEvenWhenIterationThrows() throws Exception {
        LockService lockService = mock(LockService.class);
        Database database = mock(Database.class);
        LiquibaseMasterChangeLogLocation location = mock(LiquibaseMasterChangeLogLocation.class);
        when(location.getFilePath()).thenReturn("changelog.xml");

        LiquibaseRunner failingRunner = new LiquibaseRunner(
            List.of(location),
            new LiquibaseProperties(),
            mock(DataSource.class),
            THRESHOLD_MINUTES
        ) {
            @Override
            void runChangeLog(Database db, String filePath) throws LiquibaseException {
                throw new LiquibaseException("boom");
            }
        };

        assertThatThrownBy(() -> failingRunner.executeMigrations(database, lockService))
            .isInstanceOf(LiquibaseException.class)
            .hasMessage("boom");

        verify(lockService).releaseLock();
    }

    @Test
    void shutdownHookIsNoOpWhenLockNotHeld() throws Exception {
        DataSource datasource = mock(DataSource.class);
        LockService lockService = mock(LockService.class);
        when(lockService.hasChangeLogLock()).thenReturn(false);

        LiquibaseRunner hookRunner = new LiquibaseRunner(
            Collections.emptyList(),
            new LiquibaseProperties(),
            datasource,
            THRESHOLD_MINUTES
        );

        Thread hook = hookRunner.newShutdownHook(lockService);
        hook.start();
        hook.join();

        verify(lockService).hasChangeLogLock();
        verify(datasource, never()).getConnection();
    }

    @Test
    void executeMigrationsBreaksWhenAbortFlagSet() throws Exception {
        LockService hookLockService = mock(LockService.class);
        when(hookLockService.hasChangeLogLock()).thenReturn(false);
        LockService loopLockService = mock(LockService.class);
        Database database = mock(Database.class);
        LiquibaseMasterChangeLogLocation first = mock(LiquibaseMasterChangeLogLocation.class);
        when(first.getFilePath()).thenReturn("first-master.xml");
        LiquibaseMasterChangeLogLocation second = mock(LiquibaseMasterChangeLogLocation.class);

        LiquibaseRunner abortingRunner = new LiquibaseRunner(
            List.of(first, second),
            new LiquibaseProperties(),
            mock(DataSource.class),
            THRESHOLD_MINUTES
        ) {
            @Override
            void runChangeLog(Database db, String filePath) {
                throw new AssertionError("runChangeLog must not be called once aborting=true");
            }
        };

        Thread hook = abortingRunner.newShutdownHook(hookLockService);
        hook.start();
        hook.join();

        assertThatThrownBy(() -> abortingRunner.executeMigrations(database, loopLockService))
            .isInstanceOf(LiquibaseException.class)
            .hasMessageContaining("aborted by JVM shutdown signal")
            .hasMessageContaining("first-master.xml");

        verify(loopLockService).releaseLock();
    }
}
