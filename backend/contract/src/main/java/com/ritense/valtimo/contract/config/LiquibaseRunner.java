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

import java.sql.Connection;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.stream.Stream;
import javax.sql.DataSource;
import liquibase.Contexts;
import liquibase.Liquibase;
import liquibase.Scope;
import liquibase.command.CommandFactory;
import liquibase.command.core.AbstractUpdateCommandStep;
import liquibase.command.core.UpdateCommandStep;
import liquibase.command.core.UpdateSqlCommandStep;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.exception.DatabaseException;
import liquibase.exception.LiquibaseException;
import liquibase.exception.LockException;
import liquibase.lockservice.DatabaseChangeLogLock;
import liquibase.lockservice.LockService;
import liquibase.lockservice.LockServiceFactory;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.liquibase.LiquibaseProperties;

public class LiquibaseRunner {

    private static final Logger logger = LoggerFactory.getLogger(LiquibaseRunner.class);
    private final List<LiquibaseMasterChangeLogLocation> liquibaseMasterChangeLogLocations;
    private final Contexts context;
    private final DataSource datasource;
    private final int staleLockThresholdMinutes;
    private volatile boolean aborting = false;

    public LiquibaseRunner(
        final List<LiquibaseMasterChangeLogLocation> liquibaseMasterChangeLogLocations,
        final LiquibaseProperties liquibaseProperties,
        final DataSource datasource,
        final int staleLockThresholdMinutes
    ) {
        this.liquibaseMasterChangeLogLocations = liquibaseMasterChangeLogLocations;
        this.datasource = datasource;
        this.context = new Contexts(liquibaseProperties.getContexts());
        this.staleLockThresholdMinutes = staleLockThresholdMinutes;
    }

    public void run() throws SQLException, DatabaseException {
        Connection connection = datasource.getConnection();
        JdbcConnection jdbcConnection = new JdbcConnection(connection);
        Database database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(jdbcConnection);
        LockService lockService = LockServiceFactory.getInstance().getLockService(database);
        Thread shutdownHook = newShutdownHook();
        try {
            forceReleaseStaleLock(lockService);
            Runtime.getRuntime().addShutdownHook(shutdownHook);
            for (LiquibaseMasterChangeLogLocation changeLogLocation : liquibaseMasterChangeLogLocations) {
                if (aborting) {
                    logger.warn("Liquibase migration aborted by JVM shutdown signal before: {}",
                        changeLogLocation.getFilePath());
                    break;
                }
                disableFastCheckCaching();
                runChangeLog(database, changeLogLocation.getFilePath());
            }
        } catch (LiquibaseException liquibaseException) {
            throw new DatabaseException(liquibaseException);
        } finally {
            // liquibase.update() releases on its own happy path; this covers an iteration-time
            // exception or a shutdown-triggered break before the next changelog runs.
            releaseLockQuietly(lockService);
            deregisterShutdownHook(shutdownHook);
            try {
                connection.rollback();
                connection.close();
            } catch (SQLException sqlException) {
                logger.error("Error closing connection ", sqlException);
            }
        }
        logger.info("Finished running liquibase");
    }

    /** Recovers from a stale lock left by a previous JVM that died (SIGKILL/OOM) without releasing it. */
    void forceReleaseStaleLock(LockService lockService) throws LockException, DatabaseException {
        DatabaseChangeLogLock[] locks = lockService.listLocks();
        for (DatabaseChangeLogLock lock : locks) {
            long heldForMinutes = Duration.between(lock.getLockGranted().toInstant(), Instant.now()).toMinutes();
            if (heldForMinutes >= staleLockThresholdMinutes) {
                logger.warn(
                    "Force-releasing stale Liquibase changelog lock held by '{}' since {} ({} minutes ago, threshold {} min)",
                    lock.getLockedBy(), lock.getLockGranted(), heldForMinutes, staleLockThresholdMinutes
                );
                lockService.forceReleaseLock();
            }
        }
    }

    /**
     * Signals an in-flight migration to abort at the next iteration boundary. The hook intentionally
     * does no DB I/O: releasing the lock here would let another pod acquire it and start its own DDL
     * while this pod's in-flight {@link Liquibase#update} is still executing against the same
     * database. Lock release is deferred to the main thread, which breaks out of the iteration loop
     * once the current changeset finishes and releases the lock in {@link #run()}'s {@code finally}.
     * Hard kills bypass shutdown hooks entirely — {@link #forceReleaseStaleLock} covers those on the
     * next startup.
     */
    Thread newShutdownHook() {
        return new Thread(() -> {
            logger.warn("JVM shutdown signal received; Liquibase migration will abort at the next changelog boundary");
            aborting = true;
        }, "liquibase-shutdown-hook");
    }

    private void deregisterShutdownHook(Thread hook) {
        try {
            Runtime.getRuntime().removeShutdownHook(hook);
        } catch (IllegalStateException ignored) {
            // JVM is already shutting down; the hook has fired (or is firing) and the abort flag is set.
        } catch (RuntimeException e) {
            // Best-effort: must not abort the outer finally.
            logger.warn("Failed to deregister Liquibase shutdown hook", e);
        }
    }

    private void releaseLockQuietly(LockService lockService) {
        try {
            lockService.releaseLock();
        } catch (LockException | RuntimeException e) {
            // "Quietly": a throw here would mask the real migration exception. RuntimeException
            // covers cases where Liquibase internals leak past the declared LockException.
            logger.warn("Failed to release Liquibase changelog lock", e);
        }
    }

    @SuppressWarnings({"squid:S2095", "java:S2095"}) // Liquibase connection is closed elsewhere
    void runChangeLog(Database database, String filePath) throws LiquibaseException {
        Liquibase liquibase = new Liquibase(filePath, new ClassLoaderResourceAccessor(), database);
        logger.info("Running liquibase master changelog: {}", liquibase.getChangeLogFile());
        liquibase.update(context);
    }

    /**
     * Liquibase's fast-check optimization caches "already executed" state on pipeline objects
     * that live on the Liquibase Scope and are shared across {@link Liquibase#update} calls.
     * We run multiple master changelogs in sequence, so the cache from one update leaks into the
     * next and can incorrectly skip newly-added changesets. Disable it before every update.
     */
    private void disableFastCheckCaching() {
        CommandFactory commandFactory = Scope.getCurrentScope().getSingleton(CommandFactory.class);
        Stream.of(UpdateSqlCommandStep.COMMAND_NAME, UpdateCommandStep.COMMAND_NAME)
            .flatMap(command -> commandFactory.getCommandDefinition(command).getPipeline().stream())
            .filter(AbstractUpdateCommandStep.class::isInstance)
            .forEach(it -> ((AbstractUpdateCommandStep) it).setFastCheckEnabled(false));
    }
}
