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

/**
 * Runs migration plans on a background thread.
 *
 * A migration is not something a request can wait for: it works through every matching case one at a
 * time, and on a real configuration that is hours. Held open, the request times out long before the
 * run ends — leaving the caller with an error for a migration that is in fact still going, which is the
 * worst of both outcomes. So the claim happens on the calling thread and the work does not.
 *
 * The split is [CaseMigrationService.claimMigration] / [CaseMigrationService.runClaimedMigration]:
 * everything the caller needs answered — unknown plan, building block plan, undeployed source, already
 * running — is settled before this returns, and the plan is already RUNNING by then, so a status poll
 * cannot read a not-yet-started run as a finished one.
 *
 * Nothing here retries or recovers. A run that dies with its node — or with this whole application —
 * leaves the execution RUNNING with a lease that stops being renewed, and
 * [MigrationTriggerScheduler] reclaims it: on startup, and hourly after that. Per-case transactions
 * mean it resumes rather than restarts.
 */
class CaseMigrationRunner(
    private val caseMigrationService: CaseMigrationService,
    private val taskExecutor: TaskExecutor,
) : DisposableBean {

    /**
     * Shut the pool down with this bean. The executor is not a Spring bean (see
     * `CaseAutoConfiguration.caseMigrationRunner` for why), so nothing else would stop its threads. A
     * synchronous executor, as the tests use, has nothing to shut down.
     */
    override fun destroy() {
        (taskExecutor as? DisposableBean)?.destroy()
    }

    /**
     * Claim [migrationId] and migrate its cases on a background thread. Returns false when the plan is
     * already being run, in which case nothing was dispatched — starting a run that is already going is
     * a no-op, not an error.
     *
     * Throws whatever [CaseMigrationService.claimMigration] throws for a plan that cannot run at all,
     * so the caller can still answer for it.
     */
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
                // No security context on this thread; the actor for the audit trail comes off the
                // execution row instead (see CaseMigrationService.runClaimedMigration).
                runWithoutAuthorization {
                    try {
                        run()
                    } catch (e: Exception) {
                        // Deliberately swallowed: the lease stops being renewed, so the trigger sweep
                        // reclaims and resumes the run. Rethrowing would only reach the pool's handler.
                        logger.error(e) { "Background $what of migration plan '$migrationId' failed" }
                    }
                }
            }
        } catch (e: TaskRejectedException) {
            // The pool is full, so this run never started. Release the claim rather than leave the plan
            // RUNNING with nobody running it — waiting for the lease to lapse would report it as in
            // progress, and block a retry, for the whole lease duration.
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
