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

import com.ritense.case_.domain.migration.CaseDefinitionMigration
import com.ritense.case_.domain.migration.CaseDefinitionMigrationExecution
import com.ritense.case_.domain.migration.CaseMigrationCase
import com.ritense.case_.domain.migration.CaseMigrationCaseId
import com.ritense.case_.domain.migration.CaseMigrationCaseStatus
import com.ritense.case_.domain.migration.CaseMigrationDryRun
import com.ritense.case_.domain.migration.CaseMigrationDryRunCase
import com.ritense.case_.domain.migration.CaseMigrationStatus
import com.ritense.case_.domain.migration.DryRunCaseStatus
import com.ritense.case_.domain.migration.MigrationExecutionError
import com.ritense.case_.domain.migration.MigrationExecutionWarning
import com.ritense.case_.repository.CaseDefinitionMigrationExecutionRepository
import com.ritense.case_.repository.CaseDefinitionMigrationRepository
import com.ritense.case_.repository.CaseMigrationCaseRepository
import com.ritense.case_.repository.CaseMigrationDryRunCaseRepository
import com.ritense.case_.repository.CaseMigrationDryRunRepository
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintVersionLineage
import com.ritense.valtimo.contract.blueprint.migration.MigrationCandidateProvider
import com.ritense.valtimo.contract.blueprint.migration.MigrationRunCache
import com.ritense.valtimo.contract.blueprint.migration.MigrationWarnings
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentDeployer
import com.ritense.valtimo.contract.blueprint.migration.event.CaseMigratedEvent
import com.ritense.valtimo.contract.audit.utils.AuditHelper
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.ApplicationEventPublisher
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.dao.OptimisticLockingFailureException
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.transaction.support.TransactionTemplate
import java.io.PrintWriter
import java.io.StringWriter
import java.time.Duration
import java.time.LocalDateTime
import java.util.UUID

/** Starts and drives the migration of a plan's cases. One run per plan at a time (fencing token + lease); each case commits its own outcome, so a run is idempotent and crash-resumable. */
class CaseMigrationService(
    private val caseDefinitionMigrationRepository: CaseDefinitionMigrationRepository,
    private val executionRepository: CaseDefinitionMigrationExecutionRepository,
    private val caseMigrationCaseRepository: CaseMigrationCaseRepository,
    private val dryRunRepository: CaseMigrationDryRunRepository,
    private val dryRunCaseRepository: CaseMigrationDryRunCaseRepository,
    private val planApplier: MigrationPlanApplier,
    private val conditionEvaluator: MigrationConditionEvaluator,
    private val candidateProviders: List<MigrationCandidateProvider>,
    private val blueprintVersionLineages: List<BlueprintVersionLineage>,
    private val componentDeployers: List<MigrationComponentDeployer>,
    private val transactionTemplate: TransactionTemplate,
    private val applicationEventPublisher: ApplicationEventPublisher,
    private val leaseDuration: Duration,
) {

    /** Delete a migration plan and everything derived from it (components, execution, per-case rows). */
    fun deletePlan(migrationId: BlueprintMigrationId) {
        transactionTemplate.executeWithoutResult {
            componentDeployers.forEach { it.undeploy(migrationId) }
            caseMigrationCaseRepository.deleteByIdMigrationId(migrationId)
            dryRunCaseRepository.deleteByIdMigrationId(migrationId)
            dryRunRepository.findById(migrationId).ifPresent { dryRunRepository.delete(it) }
            executionRepository.findById(migrationId).ifPresent { executionRepository.delete(it) }
            caseDefinitionMigrationRepository.findById(migrationId).ifPresent {
                caseDefinitionMigrationRepository.delete(it)
            }
        }
    }

    /** All migration plans for a blueprint version, with their configuration and run status. */
    fun getPlans(blueprintId: BlueprintId): List<MigrationPlanManagementDto> {
        return caseDefinitionMigrationRepository.findAllByIdBlueprintTypeAndIdKeyAndIdVersionTag(
            blueprintId.blueprintType(), blueprintId.getIdKey(), blueprintId.blueprintVersionTag()
        )
            .sortedBy { it.id.migrationKey }
            .map { plan ->
                val isBuildingBlockPlan = plan.id.blueprintType == BlueprintType.BUILDING_BLOCK
                MigrationPlanManagementDto(
                    migrationKey = plan.id.migrationKey,
                    title = plan.title,
                    source = formatBlueprintVersion(plan.sourceBlueprintId()),
                    target = formatBlueprintVersion(plan.targetBlueprintId()),
                    components = componentDeployers
                        .filter { it.getComponentToExport(plan.id) != null }
                        .map { it.componentKey() },
                    status = getStatus(plan.id),
                    // A building block plan has no triggers, no conditions and no dry run of its own.
                    triggers = plan.migrationTriggers.takeUnless { isBuildingBlockPlan },
                    conditions = plan.conditions.takeUnless { isBuildingBlockPlan },
                    dryRun = if (isBuildingBlockPlan) null else getDryRunStatus(plan.id),
                )
            }
    }

    /** Whether [migrationId] declares the manual trigger. Asked by callers representing a button press; [startMigration] is trigger-agnostic. */
    fun isTriggeredByButton(migrationId: BlueprintMigrationId): Boolean {
        return caseDefinitionMigrationRepository.findById(migrationId)
            .orElseThrow { NoSuchElementException("No migration plan found for '$migrationId'") }
            .migrationTriggers
            .triggeredByButton
    }

    /** Start or resume [migrationId]. Idempotent, does nothing while another run holds a live lease, and stops cleanly when fenced by a takeover. */
    fun startMigration(migrationId: BlueprintMigrationId): CaseDefinitionMigrationExecution {
        val runToken = claimMigration(migrationId)
            ?: return executionRepository.findById(migrationId).orElseThrow()
        return runClaimedMigration(migrationId, runToken)
    }

    /** Claim the plan without migrating yet, returning the fencing token — so an HTTP caller can decide every answerable error before handing the run to a background thread. */
    fun claimMigration(migrationId: BlueprintMigrationId): String? {
        assertNotBuildingBlockPlan(migrationId)
        val plan = caseDefinitionMigrationRepository.findById(migrationId).orElseThrow {
            NoSuchElementException("No migration plan found for '$migrationId'")
        }
        assertSourceIsDeployed(plan)

        val runToken = claim(migrationId, AuditHelper.getActor())
        if (runToken == null) {
            logger.debug { "Migration plan '$migrationId' is already being executed; skipping" }
            return null
        }

        // A real run makes the latest dry run stale (it simulated the pre-migration state), so drop it.
        clearDryRun(migrationId)
        return runToken
    }

    /** Migrate every matching case of an already-claimed plan, then finish it. Actor comes from the execution row, so a resumed run keeps whoever started it. */
    fun runClaimedMigration(
        migrationId: BlueprintMigrationId,
        runToken: String,
    ): CaseDefinitionMigrationExecution {
        val plan = caseDefinitionMigrationRepository.findById(migrationId).orElseThrow {
            NoSuchElementException("No migration plan found for '$migrationId'")
        }
        val actor = executionRepository.findById(migrationId).orElseThrow().runActor
            ?: AuditHelper.getActor()

        return try {
            migrateMatchingCases(migrationId, plan, runToken, actor)
            finalize(migrationId, runToken)
        } catch (e: MigrationOwnershipLostException) {
            logger.info { "Stopped running migration plan '$migrationId': ${e.message}" }
            executionRepository.findById(migrationId).orElseThrow()
        }
    }

    /** Assemble the current migration status (counts and errors come from the per-case table). */
    fun getStatus(migrationId: BlueprintMigrationId): MigrationExecutionStatusDto {
        if (migrationId.blueprintType == BlueprintType.BUILDING_BLOCK) {
            return buildingBlockPlanStatus(migrationId)
        }
        val execution = executionRepository.findById(migrationId).orElse(null)
            ?: return notStartedStatus(migrationId)
        val casesMigrated = caseMigrationCaseRepository
            .countByIdMigrationIdAndStatus(migrationId, CaseMigrationCaseStatus.MIGRATED).toInt()
        val failedCases = caseMigrationCaseRepository
            .findByIdMigrationIdAndStatus(migrationId, CaseMigrationCaseStatus.FAILED)
        val warnedCases = caseMigrationCaseRepository.findByIdMigrationIdAndWarningsIsNotNull(migrationId)
        // casesMigrated is a lifetime count while casesToMigrate is only this run's slice, so the total is floored at what the plan already accounts for — otherwise "6 of 3".
        val casesAccountedFor = casesMigrated + failedCases.size
        val casesTotal = maxOf(execution.casesToMigrate, casesAccountedFor)
        // Reaches 0 once every matching case has been processed.
        val casesToMigrate = casesTotal - casesAccountedFor
        return MigrationExecutionStatusDto(
            status = execution.status,
            casesToMigrate = casesToMigrate,
            casesTotal = casesTotal,
            casesMigrated = casesMigrated,
            casesWithErrors = failedCases.size,
            errors = failedCases.map { MigrationExecutionError(it.id.caseId, it.errorMessage) },
            casesWithWarnings = warnedCases.size,
            warnings = warnedCases.map { MigrationExecutionWarning(it.id.caseId, it.warnings) },
            startedOn = execution.startedOn,
            finishedOn = execution.finishedOn,
        )
    }

    /** Simulate migrating every matching case — the real per-case migration inside an always-rolled-back transaction — persisting nothing to the cases. */
    fun startDryRun(migrationId: BlueprintMigrationId): DryRunStatusDto {
        val runToken = claimDryRun(migrationId) ?: return getDryRunStatus(migrationId)
        runClaimedDryRun(migrationId, runToken)
        return getDryRunStatus(migrationId)
    }

    /** Claim the dry run without simulating yet. Split from the run for the same reason as [claimMigration]: it takes the same hours. */
    fun claimDryRun(migrationId: BlueprintMigrationId): String? {
        assertNotBuildingBlockPlan(migrationId)
        val plan = caseDefinitionMigrationRepository.findById(migrationId).orElseThrow {
            NoSuchElementException("No migration plan found for '$migrationId'")
        }
        assertSourceIsDeployed(plan)

        val runToken = claimDryRun(migrationId, AuditHelper.getActor())
        if (runToken == null) {
            logger.debug { "Dry run for migration plan '$migrationId' is already in progress; skipping" }
            return null
        }
        return runToken
    }

    /** Simulate every matching case of an already-claimed dry run, then finish it. */
    fun runClaimedDryRun(migrationId: BlueprintMigrationId, runToken: String) {
        val plan = caseDefinitionMigrationRepository.findById(migrationId).orElseThrow {
            NoSuchElementException("No migration plan found for '$migrationId'")
        }
        try {
            dryRunMatchingCases(migrationId, plan, runToken)
            finalizeDryRun(migrationId, runToken)
        } catch (e: MigrationOwnershipLostException) {
            logger.info { "Stopped dry run for migration plan '$migrationId': ${e.message}" }
        }
    }

    /** Assemble the latest dry-run status (counts and errors come from the per-case dry-run table). */
    fun getDryRunStatus(migrationId: BlueprintMigrationId): DryRunStatusDto {
        val dryRun = dryRunRepository.findById(migrationId).orElse(null)
            ?: return DryRunStatusDto.NOT_STARTED
        val wouldMigrate = dryRunCaseRepository
            .countByIdMigrationIdAndStatus(migrationId, DryRunCaseStatus.WOULD_MIGRATE).toInt()
        val wouldFail = dryRunCaseRepository
            .findByIdMigrationIdAndStatus(migrationId, DryRunCaseStatus.WOULD_FAIL)
        val warnedCases = dryRunCaseRepository.findByIdMigrationIdAndWarningsIsNotNull(migrationId)
        return DryRunStatusDto(
            status = dryRun.status,
            casesChecked = wouldMigrate + wouldFail.size,
            casesWouldMigrate = wouldMigrate,
            casesWouldFail = wouldFail.size,
            errors = wouldFail.map { MigrationExecutionError(it.id.caseId, it.errorMessage) },
            casesWithWarnings = warnedCases.size,
            warnings = warnedCases.map { MigrationExecutionWarning(it.id.caseId, it.warnings) },
            startedOn = dryRun.startedOn,
            finishedOn = dryRun.finishedOn,
        )
    }

    /** Recompute the cached, approximate "cases to migrate" count so the UI need not pay the full scan per page load. Once a run starts its live count wins. */
    fun refreshCaseCountEstimate(migrationId: BlueprintMigrationId) {
        val plan = caseDefinitionMigrationRepository.findById(migrationId).orElse(null) ?: return
        val estimate = countMatchingCases(migrationId, plan)
        transactionTemplate.executeWithoutResult {
            caseDefinitionMigrationRepository.findById(migrationId).ifPresent { fresh ->
                fresh.estimatedCasesToMigrate = estimate
                caseDefinitionMigrationRepository.save(fresh)
            }
        }
    }

    /** Status of a building block plan, which owns no run: it is applied instance by instance by whichever case migrations reach it, so its status is derived from the rows left behind. */
    private fun buildingBlockPlanStatus(migrationId: BlueprintMigrationId): MigrationExecutionStatusDto {
        val instancesMigrated = caseMigrationCaseRepository
            .countByIdMigrationIdAndStatus(migrationId, CaseMigrationCaseStatus.MIGRATED).toInt()
        return MigrationExecutionStatusDto(
            status = if (instancesMigrated == 0) CaseMigrationStatus.NOT_STARTED else CaseMigrationStatus.COMPLETED,
            casesToMigrate = 0,
            casesTotal = instancesMigrated,
            casesMigrated = instancesMigrated,
            casesWithErrors = 0,
            errors = emptyList(),
            casesWithWarnings = 0,
            warnings = emptyList(),
            startedOn = null,
            finishedOn = null,
        )
    }

    private fun notStartedStatus(migrationId: BlueprintMigrationId): MigrationExecutionStatusDto {
        val estimate = caseDefinitionMigrationRepository.findById(migrationId).orElse(null)
            ?.estimatedCasesToMigrate ?: 0
        return MigrationExecutionStatusDto.NOT_STARTED.copy(casesToMigrate = estimate, casesTotal = estimate)
    }

    /** Count the cases currently matching the plan, writing nothing. An unevaluable case counts as not matching. */
    private fun countMatchingCases(migrationId: BlueprintMigrationId, plan: CaseDefinitionMigration): Int {
        val source = plan.sourceBlueprintId()
        val provider = candidateProvider(source.blueprintType()) ?: return 0

        var count = 0
        var pageable: Pageable = PageRequest.of(0, CANDIDATE_PAGE_SIZE)
        while (true) {
            val page = provider.findCandidateIds(source, pageable)
            // No run in progress, so an unevaluable case is logged and dropped, recorded nowhere.
            count += page.content.count { caseId ->
                matchesConditions(plan, caseId, "while estimating plan '${plan.id}'")
            }
            if (!page.hasNext()) break
            pageable = page.nextPageable()
        }
        return count
    }

    /** Whether the case's conditions currently hold; what an evaluation failure is worth recording is the caller's call, via [onFailure]. */
    private fun matchesConditions(
        plan: CaseDefinitionMigration,
        caseId: UUID,
        context: String,
        onFailure: (Exception) -> Unit = {},
    ): Boolean {
        return try {
            transactionTemplate.execute { conditionEvaluator.matches(caseId, plan.conditions) } ?: false
        } catch (e: Exception) {
            logger.warn(e) { "Could not evaluate conditions for case '$caseId' $context" }
            onFailure(e)
            false
        }
    }

    /** Page through candidate cases, handing each matching one to [onMatch] and renewing the lease as it goes. Shared by the real run and the dry run. */
    private fun scanMatchingCases(
        plan: CaseDefinitionMigration,
        renewLease: () -> Unit,
        matches: (UUID) -> Boolean,
        onMatch: (UUID) -> Unit,
        onPageComplete: () -> Unit = {},
    ) {
        val source = plan.sourceBlueprintId()
        val provider = candidateProvider(source.blueprintType()) ?: return

        val renewInterval = leaseDuration.dividedBy(2)
        var leaseRenewedAt = LocalDateTime.now()
        var pageable: Pageable = PageRequest.of(0, CANDIDATE_PAGE_SIZE)

        // The scan is the run: the target is fixed for its duration and every case asks it the same questions. In memory, so a dry run's rollback neither undoes nor affects it.
        MigrationRunCache.inRun {
            while (true) {
                val page = provider.findCandidateIds(source, pageable)

                page.content.forEach { caseId ->
                    if (matches(caseId)) {
                        onMatch(caseId)
                    }
                    if (Duration.between(leaseRenewedAt, LocalDateTime.now()) >= renewInterval) {
                        renewLease()
                        leaseRenewedAt = LocalDateTime.now()
                    }
                }

                onPageComplete()
                if (!page.hasNext()) break
                pageable = page.nextPageable()
            }
        }
    }

    /** Migrate every case matching the plan, recording a condition failure against the run. */
    private fun migrateMatchingCases(
        migrationId: BlueprintMigrationId,
        plan: CaseDefinitionMigration,
        runToken: String,
        actor: String,
    ) {
        val target = plan.targetBlueprintId()
        var matchedCount = 0
        scanMatchingCases(
            plan = plan,
            renewLease = { renewLease(migrationId, runToken) },
            matches = { caseId ->
                matchesConditions(plan, caseId, "in plan '$migrationId'") { e ->
                    recordFailure(migrationId, caseId, e, runToken)
                }
            },
            onMatch = { caseId ->
                matchedCount++
                migrateCase(migrationId, target, caseId, runToken, actor)
            },
            onPageComplete = { updateExecution(migrationId, runToken) { it.casesToMigrate = matchedCount } },
        )
    }

    /** Become the single active runner with a fresh token and lease, or null when already owned. A reclaimed crashed run keeps its original actor. */
    private fun claim(migrationId: BlueprintMigrationId, actor: String): String? {
        var runToken: String? = null
        try {
            transactionTemplate.executeWithoutResult {
                val execution = executionRepository.findById(migrationId)
                    .orElseGet { CaseDefinitionMigrationExecution(migrationId) }
                if (execution.status == CaseMigrationStatus.RUNNING && isLeaseLive(execution)) {
                    return@executeWithoutResult // another node is actively running it
                }
                val isReclaim = execution.status == CaseMigrationStatus.RUNNING
                val token = UUID.randomUUID().toString()
                execution.status = CaseMigrationStatus.RUNNING
                execution.runToken = token
                execution.runActor = if (isReclaim) execution.runActor ?: actor else actor
                if (execution.startedOn == null) {
                    execution.startedOn = LocalDateTime.now()
                }
                execution.leaseExpiresAt = LocalDateTime.now().plus(leaseDuration)
                executionRepository.save(execution)
                runToken = token
            }
        } catch (e: OptimisticLockingFailureException) {
            return null // another run claimed it first
        } catch (e: DataIntegrityViolationException) {
            return null // another run inserted the execution row first
        }
        return runToken
    }

    private fun migrateCase(
        migrationId: BlueprintMigrationId,
        target: BlueprintId,
        caseId: UUID,
        runToken: String,
        actor: String,
    ) {
        val caseRecordId = CaseMigrationCaseId(migrationId, caseId.toString())
        // Warnings are collected per case on the thread; the same set is recorded whether the case ends MIGRATED or FAILED.
        MigrationWarnings.clear()
        var warnings: String? = null
        try {
            // One transaction per case: the migration and the record of it commit or roll back together.
            transactionTemplate.executeWithoutResult {
                assertOwnership(migrationId, runToken) // stop if another node has taken over
                if (caseMigrationCaseRepository.existsByIdAndStatus(caseRecordId, CaseMigrationCaseStatus.MIGRATED)) {
                    return@executeWithoutResult // already migrated (idempotent re-run)
                }
                val from = applyMigration(migrationId, target, caseId)
                warnings = MigrationWarnings.drain()
                caseMigrationCaseRepository.save(
                    CaseMigrationCase(caseRecordId, CaseMigrationCaseStatus.MIGRATED, warnings = warnings)
                )
                // Audited in the same transaction, so it is present exactly when the case is recorded migrated.
                applicationEventPublisher.publishEvent(
                    CaseMigratedEvent(
                        // Explicit: the run outlives the request, so the thread would otherwise audit every case as "System".
                        user = actor,
                        caseId = caseId,
                        blueprintKey = target.getIdKey(),
                        fromBlueprintKey = from.getIdKey(),
                        fromVersionTag = from.blueprintVersionTag().toString(),
                        toVersionTag = target.blueprintVersionTag().toString(),
                        migrationKey = migrationId.migrationKey,
                    )
                )
            }
            warnings?.let {
                logger.warn { "Case '$caseId' migrated under plan '$migrationId', but not completely: $it" }
            }
        } catch (e: MigrationOwnershipLostException) {
            throw e // propagate: this node has been fenced, stop the run
        } catch (e: OptimisticLockingFailureException) {
            throw MigrationOwnershipLostException("Concurrent modification of '$migrationId' while migrating '$caseId'")
        } catch (e: DataIntegrityViolationException) {
            throw MigrationOwnershipLostException("Case '$caseId' of '$migrationId' was concurrently migrated by another run")
        } catch (e: Exception) {
            // The case stays on the old version and the run continues.
            logger.warn(e) { "Migration failed for case '$caseId' in plan '$migrationId'; rolled back" }
            recordFailure(migrationId, caseId, e, runToken, warnings ?: MigrationWarnings.drain())
        }
    }

    private fun recordFailure(
        migrationId: BlueprintMigrationId,
        caseId: UUID,
        error: Throwable,
        runToken: String,
        warnings: String? = null,
    ) {
        val stackTrace = StringWriter().also { error.printStackTrace(PrintWriter(it)) }.toString()
        transactionTemplate.executeWithoutResult {
            assertOwnership(migrationId, runToken)
            caseMigrationCaseRepository.save(
                CaseMigrationCase(
                    CaseMigrationCaseId(migrationId, caseId.toString()),
                    CaseMigrationCaseStatus.FAILED,
                    stackTrace,
                    warnings,
                )
            )
        }
    }

    private fun renewLease(migrationId: BlueprintMigrationId, runToken: String) {
        updateExecution(migrationId, runToken) { it.leaseExpiresAt = LocalDateTime.now().plus(leaseDuration) }
    }

    /** Give up a claim that was taken but never run. Leaves the status RUNNING with no lease — the state a died-mid-run node leaves, which the sweep already treats as reclaimable. */
    fun abandonClaim(migrationId: BlueprintMigrationId, runToken: String) {
        updateExecution(migrationId, runToken) { execution ->
            execution.leaseExpiresAt = null
            execution.runToken = null
        }
    }

    /** As [abandonClaim], for a dry run. A dry run always starts fresh, so it is simply not started. */
    fun abandonDryRunClaim(migrationId: BlueprintMigrationId, runToken: String) {
        updateDryRun(migrationId, runToken) { dryRun ->
            dryRun.status = CaseMigrationStatus.NOT_STARTED
            dryRun.leaseExpiresAt = null
            dryRun.runToken = null
            dryRun.startedOn = null
        }
    }

    private fun finalize(
        migrationId: BlueprintMigrationId,
        runToken: String,
    ): CaseDefinitionMigrationExecution {
        val hasErrors = caseMigrationCaseRepository
            .countByIdMigrationIdAndStatus(migrationId, CaseMigrationCaseStatus.FAILED) > 0
        return updateExecution(migrationId, runToken) { execution ->
            execution.status = if (hasErrors) {
                CaseMigrationStatus.COMPLETED_WITH_ERRORS
            } else {
                CaseMigrationStatus.COMPLETED
            }
            execution.finishedOn = LocalDateTime.now()
            execution.leaseExpiresAt = null // release the lease
            execution.runToken = null
        }
    }

    /** Migrating a single case, shared by both runs: re-home onto [target] first so component writes validate against the target schema, then run every executor. */
    private fun applyMigration(migrationId: BlueprintMigrationId, target: BlueprintId, caseId: UUID): BlueprintId {
        return planApplier.apply(migrationId, target, caseId)
    }

    /** Run the real [applyMigration], then force a rollback so nothing persists. The outcome is recorded in its own committed transaction so it survives that rollback. */
    private fun simulateCase(migrationId: BlueprintMigrationId, target: BlueprintId, caseId: UUID, runToken: String) {
        MigrationWarnings.clear()
        try {
            transactionTemplate.executeWithoutResult {
                assertDryRunOwnership(migrationId, runToken) // stop if another node has taken over
                applyMigration(migrationId, target, caseId)
                throw DryRunRollback // undo the simulated migration; commit nothing
            }
        } catch (e: DryRunRollback) {
            // The rollback undoes the simulated migration but not the warnings — they were collected in memory.
            recordDryRunOutcome(
                migrationId, caseId, DryRunCaseStatus.WOULD_MIGRATE, null, runToken, MigrationWarnings.drain()
            )
        } catch (e: MigrationOwnershipLostException) {
            throw e // propagate: this node has been fenced, stop the dry run
        } catch (e: Exception) {
            logger.debug(e) { "Dry run: case '$caseId' would fail in plan '$migrationId'" }
            recordDryRunOutcome(
                migrationId, caseId, DryRunCaseStatus.WOULD_FAIL, e, runToken, MigrationWarnings.drain()
            )
        }
    }

    private fun recordDryRunOutcome(
        migrationId: BlueprintMigrationId,
        caseId: UUID,
        status: DryRunCaseStatus,
        error: Throwable?,
        runToken: String,
        warnings: String? = null,
    ) {
        val stackTrace = error?.let { StringWriter().also { w -> it.printStackTrace(PrintWriter(w)) }.toString() }
        transactionTemplate.executeWithoutResult {
            assertDryRunOwnership(migrationId, runToken)
            dryRunCaseRepository.save(
                CaseMigrationDryRunCase(
                    CaseMigrationCaseId(migrationId, caseId.toString()), status, stackTrace, warnings
                )
            )
        }
    }

    /** Mirrors [migrateMatchingCases], but every outcome goes to the dry-run table instead of to the cases. */
    private fun dryRunMatchingCases(
        migrationId: BlueprintMigrationId,
        plan: CaseDefinitionMigration,
        runToken: String,
    ) {
        val target = plan.targetBlueprintId()
        scanMatchingCases(
            plan = plan,
            renewLease = { renewDryRunLease(migrationId, runToken) },
            matches = { caseId ->
                matchesConditions(plan, caseId, "in dry run of plan '$migrationId'") { e ->
                    recordDryRunOutcome(migrationId, caseId, DryRunCaseStatus.WOULD_FAIL, e, runToken)
                }
            },
            onMatch = { caseId -> simulateCase(migrationId, target, caseId, runToken) },
        )
    }

    /** Become the single active dry-run runner and clear the previous per-case results, or null when already owned. */
    private fun claimDryRun(migrationId: BlueprintMigrationId, actor: String): String? {
        var runToken: String? = null
        try {
            transactionTemplate.executeWithoutResult {
                val dryRun = dryRunRepository.findById(migrationId)
                    .orElseGet { CaseMigrationDryRun(migrationId) }
                if (dryRun.status == CaseMigrationStatus.RUNNING && isLeaseLive(dryRun.leaseExpiresAt)) {
                    return@executeWithoutResult // another node is actively running it
                }
                val token = UUID.randomUUID().toString()
                dryRun.status = CaseMigrationStatus.RUNNING
                dryRun.runToken = token
                dryRun.runActor = actor
                dryRun.startedOn = LocalDateTime.now()
                dryRun.finishedOn = null
                dryRun.leaseExpiresAt = LocalDateTime.now().plus(leaseDuration)
                dryRunRepository.save(dryRun)
                dryRunCaseRepository.deleteByIdMigrationId(migrationId) // fresh results for this run
                runToken = token
            }
        } catch (e: OptimisticLockingFailureException) {
            return null // another dry run claimed it first
        } catch (e: DataIntegrityViolationException) {
            return null // another dry run inserted the row first
        }
        return runToken
    }

    private fun finalizeDryRun(migrationId: BlueprintMigrationId, runToken: String): CaseMigrationDryRun {
        val hasErrors = dryRunCaseRepository
            .countByIdMigrationIdAndStatus(migrationId, DryRunCaseStatus.WOULD_FAIL) > 0
        return updateDryRun(migrationId, runToken) { dryRun ->
            dryRun.status = if (hasErrors) {
                CaseMigrationStatus.COMPLETED_WITH_ERRORS
            } else {
                CaseMigrationStatus.COMPLETED
            }
            dryRun.finishedOn = LocalDateTime.now()
            dryRun.leaseExpiresAt = null // release the lease
            dryRun.runToken = null
        }
    }

    private fun renewDryRunLease(migrationId: BlueprintMigrationId, runToken: String) {
        updateDryRun(migrationId, runToken) { it.leaseExpiresAt = LocalDateTime.now().plus(leaseDuration) }
    }

    /** Drop the plan's latest dry run entirely, so the UI never shows a now-stale simulation beside a real run. */
    private fun clearDryRun(migrationId: BlueprintMigrationId) {
        transactionTemplate.executeWithoutResult {
            dryRunCaseRepository.deleteByIdMigrationId(migrationId)
            dryRunRepository.findById(migrationId).ifPresent { dryRunRepository.delete(it) }
        }
    }

    private fun assertDryRunOwnership(migrationId: BlueprintMigrationId, runToken: String) {
        val dryRun = dryRunRepository.findById(migrationId).orElseThrow()
        if (dryRun.runToken != runToken) {
            throw MigrationOwnershipLostException("Dry run of migration plan '${dryRun.id}' was taken over by another run")
        }
    }

    /** Mutate and save the dry run only while this run still owns it; ownership loss surfaces as [MigrationOwnershipLostException]. */
    private fun updateDryRun(
        migrationId: BlueprintMigrationId,
        runToken: String,
        mutate: (CaseMigrationDryRun) -> Unit,
    ): CaseMigrationDryRun {
        return try {
            transactionTemplate.execute {
                val dryRun = dryRunRepository.findById(migrationId).orElseThrow()
                if (dryRun.runToken != runToken) {
                    throw MigrationOwnershipLostException("Dry run of migration plan '$migrationId' was taken over by another run")
                }
                mutate(dryRun)
                dryRunRepository.save(dryRun)
            }!!
        } catch (e: OptimisticLockingFailureException) {
            throw MigrationOwnershipLostException("Concurrent modification of dry run for migration plan '$migrationId'")
        }
    }

    /** Refuses an undeployed source version, which would otherwise select nothing and finish COMPLETED (G16). Never refuses an empty one — that is the normal state of a plan that already ran. */
    private fun assertSourceIsDeployed(plan: CaseDefinitionMigration) {
        val source = plan.sourceBlueprintId()
        val lineage = blueprintVersionLineages.firstOrNull { it.supports(source.blueprintType()) } ?: return
        require(lineage.exists(source)) {
            "Migration plan '${plan.id}' declares source '$source', which is not deployed. Running it " +
                "would select no cases and report success without migrating anything. Correct the " +
                "plan's source, or deploy that version first."
        }
    }

    /** A building block plan has no run of its own (R1); starting one is refused rather than quietly doing nothing. */
    private fun assertNotBuildingBlockPlan(migrationId: BlueprintMigrationId) {
        require(migrationId.blueprintType != BlueprintType.BUILDING_BLOCK) {
            "Building block migration plan '$migrationId' cannot be started on its own. A building " +
                "block migrates because its owner migrated: run the case migration whose target " +
                "version links this building block, and it will be applied as part of that."
        }
    }

    /** The provider that enumerates candidate instances for a blueprint type, if any. */
    private fun candidateProvider(blueprintType: BlueprintType): MigrationCandidateProvider? {
        return candidateProviders.firstOrNull { it.supports(blueprintType) }
    }

    private fun formatBlueprintVersion(blueprintId: BlueprintId): String =
        "${blueprintId.getIdKey()}:${blueprintId.blueprintVersionTag()}"

    private fun isLeaseLive(execution: CaseDefinitionMigrationExecution): Boolean {
        return isLeaseLive(execution.leaseExpiresAt)
    }

    private fun isLeaseLive(leaseExpiresAt: LocalDateTime?): Boolean {
        return leaseExpiresAt?.isAfter(LocalDateTime.now()) == true
    }

    private fun assertOwnership(migrationId: BlueprintMigrationId, runToken: String) {
        requireOwnership(executionRepository.findById(migrationId).orElseThrow(), runToken)
    }

    private fun requireOwnership(execution: CaseDefinitionMigrationExecution, runToken: String) {
        if (execution.runToken != runToken) {
            throw MigrationOwnershipLostException("Migration plan '${execution.id}' was taken over by another run")
        }
    }

    /** Mutate and save the execution only while this run still owns it; ownership loss surfaces as [MigrationOwnershipLostException]. */
    private fun updateExecution(
        migrationId: BlueprintMigrationId,
        runToken: String,
        mutate: (CaseDefinitionMigrationExecution) -> Unit,
    ): CaseDefinitionMigrationExecution {
        return try {
            transactionTemplate.execute {
                val execution = executionRepository.findById(migrationId).orElseThrow()
                requireOwnership(execution, runToken)
                mutate(execution)
                executionRepository.save(execution)
            }!!
        } catch (e: OptimisticLockingFailureException) {
            throw MigrationOwnershipLostException("Concurrent modification of migration plan '$migrationId'")
        }
    }

    /** Forces the surrounding transaction to roll back after a successful simulation. Control flow, so a stacktrace-free singleton. */
    private object DryRunRollback : RuntimeException() {
        private fun readResolve(): Any = DryRunRollback
        override fun fillInStackTrace(): Throwable = this
    }

    private companion object {
        val logger = KotlinLogging.logger {}
        const val CANDIDATE_PAGE_SIZE = 500
    }
}
