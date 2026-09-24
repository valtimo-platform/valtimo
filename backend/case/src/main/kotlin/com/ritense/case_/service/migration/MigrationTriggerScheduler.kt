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
import com.ritense.case_.domain.migration.CaseDefinitionMigration
import com.ritense.case_.repository.CaseDefinitionMigrationExecutionRepository
import com.ritense.case_.repository.CaseDefinitionMigrationRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.event.ApplicationFullyReadyEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import java.time.Instant
import java.time.LocalDateTime
import java.util.concurrent.ConcurrentHashMap
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock
import org.springframework.context.event.EventListener
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/** Two ShedLock'd sweeps: [checkTriggers] per minute so the picker's minutes are real, [refreshEstimates] hourly because it scans candidates per plan. Case plans only. */
@SkipComponentScan
@Component
class MigrationTriggerScheduler(
    private val caseDefinitionMigrationRepository: CaseDefinitionMigrationRepository,
    private val executionRepository: CaseDefinitionMigrationExecutionRepository,
    private val caseMigrationRunner: CaseMigrationRunner,
    private val caseMigrationService: CaseMigrationService,
) {

    // Last failure per plan that could not start, so a retry each minute logs its error once.
    private val startFailures = ConcurrentHashMap<BlueprintMigrationId, String>()

    @Scheduled(cron = "\${valtimo.case.migration.trigger-poll-cron:0 * * * * *}")
    @SchedulerLock(name = "caseMigrationTriggerScheduler", lockAtLeastFor = "PT5S", lockAtMostFor = "PT5M")
    fun checkTriggers() {
        runWithoutAuthorization {
            // Resume runs abandoned by a crashed node (RUNNING with an expired lease).
            val reclaimable = executionRepository.findReclaimable(LocalDateTime.now())
                .filter { it.id.blueprintType == BlueprintType.CASE }
                .map { it.id }
            reclaimable.forEach { runTrigger(it) }

            // Only never-triggered plans are loaded; started ones have an execution row.
            val now = Instant.now()
            val due = caseDefinitionMigrationRepository.findAllWithoutExecutionByBlueprintType(BlueprintType.CASE)
                .filter { plan -> isScheduledDue(plan, now) || isRunAfterSatisfied(plan) }
                .map { it.id }
            due.forEach { runTrigger(it) }
            startFailures.keys.retainAll((reclaimable + due).toSet())
        }
    }

    /** The expensive half. A plan already due is skipped: [checkTriggers] is about to run it, and a run counts as it goes. */
    @Scheduled(cron = "\${valtimo.case.migration.estimate-refresh-cron:0 0 * * * *}")
    @SchedulerLock(name = "caseMigrationEstimateRefresh", lockAtLeastFor = "PT5S", lockAtMostFor = "PT60M")
    fun refreshEstimates() = refreshEstimatesNow()

    /** The body both entry points share. Called directly on startup, where there is deliberately no lock — as there never was. */
    private fun refreshEstimatesNow() {
        runWithoutAuthorization {
            val now = Instant.now()
            caseDefinitionMigrationRepository.findAllWithoutExecutionByBlueprintType(BlueprintType.CASE)
                .forEach { plan ->
                    if (!isScheduledDue(plan, now) && !isRunAfterSatisfied(plan)) {
                        refreshEstimate(plan.id)
                    }
                }
        }
    }

    /** On startup, resume runs this node was killed mid-way through. A run now lives on a background thread, so a redeploy interrupts one routinely — waiting an hour would report it as running while nothing ran. */
    @EventListener(ApplicationFullyReadyEvent::class)
    fun refresh() {
        runWithoutAuthorization {
            executionRepository.findReclaimable(LocalDateTime.now())
                .filter { it.id.blueprintType == BlueprintType.CASE }
                .forEach { execution ->
                    logger.info { "Resuming migration plan '${execution.id}' interrupted by a restart" }
                    runTrigger(execution.id)
                }
        }
        refreshEstimatesNow()
    }

    private fun refreshEstimate(migrationId: BlueprintMigrationId) {
        try {
            caseMigrationService.refreshCaseCountEstimate(migrationId)
        } catch (e: Exception) {
            logger.warn(e) { "Failed to refresh case-count estimate for migration plan '$migrationId'" }
        }
    }

    /** Hand the plan to the background runner: run inline, one long plan would hold the ShedLock and postpone every trigger behind it. */
    private fun runTrigger(migrationId: BlueprintMigrationId) {
        try {
            logger.debug { "Trigger fired for migration plan '$migrationId'" }
            caseMigrationRunner.startMigration(migrationId)
            startFailures.remove(migrationId)
        } catch (e: Exception) {
            val failure = "${e::class.qualifiedName}: ${e.message}"
            if (startFailures.put(migrationId, failure) == failure) {
                logger.debug { "Migration plan '$migrationId' still cannot start: $failure" }
            } else {
                logger.error(e) { "Failed to run migration trigger for plan '$migrationId'; retrying every sweep, logged again only if the error changes" }
            }
        }
    }

    private fun isScheduledDue(plan: CaseDefinitionMigration, now: Instant): Boolean {
        val scheduledAtDate = plan.migrationTriggers.scheduledAtDate ?: return false
        return !now.isBefore(scheduledAtDate)
    }

    private fun isRunAfterSatisfied(plan: CaseDefinitionMigration): Boolean {
        val runAfter = plan.migrationTriggers.runAfter ?: return false
        val predecessorId = plan.id.copy(migrationKey = runAfter)
        return executionRepository.findById(predecessorId).map { it.status.isFinished() }.orElse(false)!!
    }

    private companion object {
        val logger = KotlinLogging.logger {}
    }
}
