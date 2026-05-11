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

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Collections;
import java.util.Date;
import javax.sql.DataSource;
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
    void shutdownHookSignalsAbortWithoutTouchingDatasource() throws Exception {
        DataSource datasource = mock(DataSource.class);

        LiquibaseRunner hookRunner = new LiquibaseRunner(
            Collections.emptyList(),
            new LiquibaseProperties(),
            datasource,
            THRESHOLD_MINUTES
        );

        Thread hook = hookRunner.newShutdownHook();
        hook.start();
        hook.join();

        verify(datasource, never()).getConnection();
    }
}
