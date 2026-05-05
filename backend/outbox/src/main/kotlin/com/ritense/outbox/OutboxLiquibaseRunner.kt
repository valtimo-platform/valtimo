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
import mu.KotlinLogging
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

    @Throws(SQLException::class, DatabaseException::class)
    override fun afterPropertiesSet() {
        val connection = datasource.connection
        val jdbcConnection = JdbcConnection(connection)
        val database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(jdbcConnection)
        val lockService = LockServiceFactory.getInstance().getLockService(database)
        val shutdownHook = newShutdownHook(lockService)
        try {
            forceReleaseStaleLock(lockService)
            Runtime.getRuntime().addShutdownHook(shutdownHook)
            executeMigration(database, lockService)
        } catch (liquibaseException: LiquibaseException) {
            throw DatabaseException(liquibaseException)
        } finally {
            deregisterShutdownHook(shutdownHook)
            try {
                connection.rollback()
                connection.close()
            } catch (sqlException: SQLException) {
                logger.error(sqlException) { "Error closing connection" }
            }
        }
    }

    internal open fun executeMigration(database: Database, lockService: LockService) {
        try {
            applyChangeLog(database)
        } finally {
            // liquibase.update() releases on its own happy path; this catches an exception escaping the call.
            releaseLockQuietly(lockService)
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
     * Releases the lock on graceful SIGTERM if the migration is still in flight. Hard kills bypass
     * shutdown hooks — [forceReleaseStaleLock] covers those. Uses a fresh connection because the
     * original is closed by the outer finally before this fires.
     */
    internal fun newShutdownHook(originalLockService: LockService): Thread {
        return Thread({
            if (!originalLockService.hasChangeLogLock()) {
                return@Thread
            }
            try {
                datasource.connection.use { conn ->
                    val jdbc = JdbcConnection(conn)
                    val db = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(jdbc)
                    LockServiceFactory.getInstance().getLockService(db).forceReleaseLock()
                    conn.commit()
                    logger.warn { "JVM shutdown: force-released Outbox Liquibase changelog lock" }
                }
            } catch (e: Exception) {
                logger.warn(e) { "JVM shutdown: failed to release Outbox Liquibase changelog lock" }
            }
        }, "outbox-liquibase-shutdown-hook")
    }

    private fun deregisterShutdownHook(hook: Thread) {
        try {
            Runtime.getRuntime().removeShutdownHook(hook)
        } catch (ignored: IllegalStateException) {
            // JVM is already shutting down; the hook will fire (or has fired) and no-op via its hasChangeLogLock guard.
        } catch (e: RuntimeException) {
            // Best-effort: must not abort the outer finally. Worst case the hook stays registered
            // and no-ops on JVM exit via its hasChangeLogLock guard.
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
