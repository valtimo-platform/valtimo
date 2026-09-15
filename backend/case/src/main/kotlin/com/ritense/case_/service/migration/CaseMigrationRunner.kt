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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.DisposableBean
import org.springframework.core.task.TaskExecutor
import org.springframework.core.task.TaskRejectedException

/** Runs migration plans on a background thread — a real configuration takes hours, so the claim happens on the calling thread and the work does not. Nothing here retries; the trigger sweep reclaims a dead run. */
class CaseMigrationRunner(
    private val caseMigrationService: CaseMigrationService,
    private val taskExecutor: TaskExecutor,
) : DisposableBean {

    /** Shut the pool down with this bean — the executor is not a Spring bean, so nothing else would stop its threads. */
    override fun destroy() {
        (taskExecutor as? DisposableBean)?.destroy()
    }

    /** Claim [migrationId] and migrate its cases on a background thread; false when it is already running, which is a no-op rather than an error. */
    fun startMigration(migrationId: BlueprintMigrationId): Boolean {
        val runToken = caseMigrationService.claimMigration(migrationId) ?: return false
        return dispatch(
            what = "migration",
            migrationId = migrationId,
            run = { caseMigrationService.runClaimedMigration(migrationId, runToken) },
            release = { caseMigrationService.abandonClaim(migrationId, runToken) },
        )
    }

    /** As [startMigration], for a dry run: same duration, same reason not to hold a request open. */
    fun startDryRun(migrationId: BlueprintMigrationId): Boolean {
        val runToken = caseMigrationService.claimDryRun(migrationId) ?: return false
        return dispatch(
            what = "dry run",
            migrationId = migrationId,
            run = { caseMigrationService.runClaimedDryRun(migrationId, runToken) },
            release = { caseMigrationService.abandonDryRunClaim(migrationId, runToken) },
        )
    }

    private fun dispatch(
        what: String,
        migrationId: BlueprintMigrationId,
        run: () -> Unit,
        release: () -> Unit,
    ): Boolean {
        try {
            taskExecutor.execute {
                // No security context on this thread; the audit actor comes off the execution row instead.
                runWithoutAuthorization {
                    try {
                        run()
                    } catch (e: Exception) {
                        // Deliberately swallowed: the lease stops being renewed, so the trigger sweep reclaims and resumes the run.
                        logger.error(e) { "Background $what of migration plan '$migrationId' failed" }
                    }
                }
            }
        } catch (e: TaskRejectedException) {
            // The pool was full, so release the claim rather than leave the plan RUNNING with nobody running it.
            logger.warn(e) { "No capacity to start $what of migration plan '$migrationId'" }
            release()
            throw e
        }
        return true
    }

    private companion object {
        val logger = KotlinLogging.logger {}
    }
}
