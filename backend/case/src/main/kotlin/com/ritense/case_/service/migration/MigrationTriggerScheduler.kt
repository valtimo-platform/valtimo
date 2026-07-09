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
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.event.ApplicationFullyReadyEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import java.time.LocalDateTime
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock
import org.springframework.context.event.EventListener
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/**
 * Drives the automatic migration triggers. Runs hourly and — cluster-safe via ShedLock, so only one
 * node sweeps at a time — for every deployed migration plan:
 *
 * - reclaims runs that crashed mid-execution (status RUNNING with an expired lease) so they resume;
 * - starts never-run plans whose `scheduledAtDate` has passed, or whose `runAfter` predecessor has
 *   finished. `runAfter` is just another trigger, alongside `scheduledAtDate` and the manual button.
 * - refreshes the cached "cases to migrate" estimate for not-yet-due plans, so the UI can show it
 *   before a run starts without recomputing the (expensive) count on every page load.
 *
 * A plan migrates its matching cases in a single run and then finishes, so there is nothing to
 * "resume" for a plan that completed normally — only crashed runs are reclaimed.
 */
@SkipComponentScan
@Component
class MigrationTriggerScheduler(
    private val caseDefinitionMigrationRepository: CaseDefinitionMigrationRepository,
    private val executionRepository: CaseDefinitionMigrationExecutionRepository,
    private val caseMigrationService: CaseMigrationService,
) {

    @Scheduled(cron = "\${valtimo.case.migration.trigger-poll-cron:0 0 * * * *}")
    @SchedulerLock(name = "caseMigrationTriggerScheduler", lockAtLeastFor = "PT5S", lockAtMostFor = "PT60M")
    fun checkTriggers() {
        runWithoutAuthorization {
            val now = LocalDateTime.now()

            // Resume runs abandoned by a crashed node (RUNNING with an expired lease).
            executionRepository.findReclaimable(now).forEach { execution ->
                runTrigger(execution.id)
            }

            // Auto-start never-run plans whose scheduled date has passed or runAfter is satisfied.
            // Only never-triggered plans are loaded (started/finished plans have an execution row).
            // Plans that are not (yet) due get their cached "cases to migrate" estimate refreshed so
            // the UI can show it before the run starts; due plans compute the live count as they run.
            caseDefinitionMigrationRepository.findAllWithoutExecution().forEach { plan ->
                if (isScheduledDue(plan, now) || isRunAfterSatisfied(plan)) {
                    runTrigger(plan.id)
                } else {
                    refreshEstimate(plan.id)
                }
            }
        }
    }

    @EventListener(ApplicationFullyReadyEvent::class)
    fun refresh() {
        runWithoutAuthorization {
            val now = LocalDateTime.now()
            caseDefinitionMigrationRepository.findAllWithoutExecution().forEach { plan ->
                if (!isScheduledDue(plan, now) && !isRunAfterSatisfied(plan)) {
                    refreshEstimate(plan.id)
                }
            }
        }
    }

    private fun refreshEstimate(migrationId: BlueprintMigrationId) {
        try {
            caseMigrationService.refreshCaseCountEstimate(migrationId)
        } catch (e: Exception) {
            logger.warn(e) { "Failed to refresh case-count estimate for migration plan '$migrationId'" }
        }
    }

    private fun runTrigger(migrationId: BlueprintMigrationId) {
        try {
            logger.debug { "Trigger fired for migration plan '$migrationId'" }
            caseMigrationService.startMigration(migrationId)
        } catch (e: Exception) {
            logger.error(e) { "Failed to run migration trigger for plan '$migrationId'" }
        }
    }

    private fun isScheduledDue(plan: CaseDefinitionMigration, now: LocalDateTime): Boolean {
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
