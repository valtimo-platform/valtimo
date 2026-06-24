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

import io.github.oshai.kotlinlogging.KotlinLogging
import liquibase.Contexts
import liquibase.Liquibase
import liquibase.database.Database
import liquibase.database.DatabaseFactory
import liquibase.database.jvm.JdbcConnection
import liquibase.exception.DatabaseException
import liquibase.exception.LiquibaseException
import liquibase.exception.LockException
import liquibase.lockservice.LockService
import liquibase.lockservice.LockServiceFactory
import liquibase.resource.ClassLoaderResourceAccessor
import org.springframework.beans.factory.InitializingBean
import org.springframework.boot.autoconfigure.liquibase.LiquibaseProperties
import java.sql.SQLException
import java.time.Duration
import java.time.Instant
import javax.sql.DataSource

open class OutboxLiquibaseRunner(
    liquibaseProperties: LiquibaseProperties,
    private val datasource: DataSource,
    private val staleLockThresholdMinutes: Int,
) : InitializingBean {
    private val context: Contexts = Contexts(liquibaseProperties.contexts)

    @Volatile
    private var aborting = false

    @Throws(SQLException::class, DatabaseException::class)
    override fun afterPropertiesSet() {
        val connection = datasource.connection
        val jdbcConnection = JdbcConnection(connection)
        val database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(jdbcConnection)
        val lockService = LockServiceFactory.getInstance().getLockService(database)
        val shutdownHook = newShutdownHook()
        try {
            forceReleaseStaleLock(lockService)
            Runtime.getRuntime().addShutdownHook(shutdownHook)
            if (aborting) {
                logger.warn {
                    "Outbox Liquibase migration aborted by JVM shutdown signal before: $LIQUIBASE_CHANGE_LOG_LOCATION"
                }
            } else {
                applyChangeLog(database)
            }
        } catch (liquibaseException: LiquibaseException) {
            throw DatabaseException(liquibaseException)
        } finally {
            // liquibase.update() releases on its own happy path; this covers an exception escaping
            // the call or a shutdown-triggered skip.
            releaseLockQuietly(lockService)
            deregisterShutdownHook(shutdownHook)
            try {
                connection.rollback()
                connection.close()
            } catch (sqlException: SQLException) {
                logger.error(sqlException) { "Error closing connection" }
            }
        }
    }

    internal open fun applyChangeLog(database: Database) {
        val liquibase = Liquibase(LIQUIBASE_CHANGE_LOG_LOCATION, ClassLoaderResourceAccessor(), database)
        logger.info { "Running liquibase master changelog: ${liquibase.changeLogFile}" }
        liquibase.update(context)
    }

    /** Recovers from a stale lock left by a previous JVM that died (SIGKILL/OOM) without releasing it. */
    internal fun forceReleaseStaleLock(lockService: LockService) {
        lockService.listLocks().forEach { lock ->
            val heldForMinutes = Duration.between(lock.lockGranted.toInstant(), Instant.now()).toMinutes()
            if (heldForMinutes >= staleLockThresholdMinutes) {
                logger.warn {
                    "Force-releasing stale Outbox Liquibase changelog lock held by '${lock.lockedBy}' " +
                        "since ${lock.lockGranted} ($heldForMinutes minutes ago, threshold $staleLockThresholdMinutes min)"
                }
                lockService.forceReleaseLock()
            }
        }
    }

    /**
     * Signals an in-flight migration to abort at the next phase boundary. The hook intentionally
     * does no DB I/O: releasing the lock here would let another pod acquire it and start its own
     * DDL while this pod's in-flight [Liquibase.update] is still executing against the same
     * database. Lock release is deferred to the main thread, which skips [applyChangeLog] once
     * the current changeset finishes and releases the lock in [afterPropertiesSet]'s `finally`.
     * Hard kills bypass shutdown hooks entirely — [forceReleaseStaleLock] covers those on the
     * next startup.
     */
    internal fun newShutdownHook(): Thread {
        return Thread({
            logger.warn { "JVM shutdown signal received; Outbox Liquibase migration will abort before the changelog runs" }
            aborting = true
        }, "outbox-liquibase-shutdown-hook")
    }

    private fun deregisterShutdownHook(hook: Thread) {
        try {
            Runtime.getRuntime().removeShutdownHook(hook)
        } catch (ignored: IllegalStateException) {
            // JVM is already shutting down; the hook has fired (or is firing) and the abort flag is set.
        } catch (e: RuntimeException) {
            // Best-effort: must not abort the outer finally.
            logger.warn(e) { "Failed to deregister Outbox Liquibase shutdown hook" }
        }
    }

    private fun releaseLockQuietly(lockService: LockService) {
        try {
            lockService.releaseLock()
        } catch (e: LockException) {
            logger.warn(e) { "Failed to release Outbox Liquibase changelog lock" }
        } catch (e: RuntimeException) {
            // "Quietly": a throw here would mask the real migration exception. RuntimeException
            // covers cases where Liquibase internals leak past the declared LockException.
            logger.warn(e) { "Failed to release Outbox Liquibase changelog lock" }
        }
    }

    companion object {
        val logger = KotlinLogging.logger {}

        private const val LIQUIBASE_CHANGE_LOG_LOCATION = "config/liquibase/outbox-master.xml"
    }
}
