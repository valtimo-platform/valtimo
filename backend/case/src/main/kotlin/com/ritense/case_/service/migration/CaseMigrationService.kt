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

/**
 * Starts and drives the migration of the cases belonging to a migration plan.
 *
 * A plan migrates exactly the cases sitting on the blueprint version it declares as its
 * [source][CaseDefinitionMigration.sourceBlueprintId] and currently satisfying its conditions; cases
 * that do not match are the responsibility of other plans and are left untouched. The source is the
 * plan's own data, so it may be any earlier version and may carry a different key from the target. A
 * run migrates its whole matching slice and then finishes ([CaseMigrationStatus.COMPLETED] /
 * [CaseMigrationStatus.COMPLETED_WITH_ERRORS]).
 *
 * Concurrency & crash safety:
 * - Only one run per plan makes progress at a time. [claim] stamps a fresh fencing [runToken] and a
 *   [leaseDuration] lease; every write re-checks the token, so if the lease expired and another node
 *   took the plan over (a fresh token), this node stops cleanly instead of racing on.
 * - Each case's outcome is a [CaseMigrationCase] row written *in the case's own transaction*, so a
 *   case is either migrated-and-recorded or neither. Re-runs skip already-migrated cases (an O(1)
 *   indexed lookup), so a run is idempotent and crash-resumable — no case is migrated twice, and no
 *   growing collection is reloaded per case.
 */
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

    /**
     * Whether [migrationId] declares the manual (button) trigger.
     *
     * The button is a trigger like any other, so a plan that does not declare it is started only by the
     * trigger sweep — on its `scheduledAtDate`, or after the plan its `runAfter` names. Callers that
     * represent a person pressing the button ask this first; [startMigration] itself deliberately does
     * not, because [MigrationTriggerScheduler] runs exactly the plans whose only triggers are the other
     * two, and those legitimately have no button trigger.
     */
    fun isTriggeredByButton(migrationId: BlueprintMigrationId): Boolean {
        return caseDefinitionMigrationRepository.findById(migrationId)
            .orElseThrow { NoSuchElementException("No migration plan found for '$migrationId'") }
            .migrationTriggers
            .triggeredByButton
    }

    /**
     * Start (or resume) the migration plan identified by [migrationId]. Idempotent: cases already
     * migrated are skipped. Does nothing if the plan is already being executed elsewhere (a live lease),
     * and stops cleanly if this node is fenced by a takeover mid-run.
     *
     * Trigger-agnostic on purpose: this is the one entry point all three triggers share, so it does not
     * check [isTriggeredByButton] — the manual entry point does that before calling here.
     */
    fun startMigration(migrationId: BlueprintMigrationId): CaseDefinitionMigrationExecution {
        val runToken = claimMigration(migrationId)
            ?: return executionRepository.findById(migrationId).orElseThrow()
        return runClaimedMigration(migrationId, runToken)
    }

    /**
     * Validate the plan and become its single active runner, without migrating anything yet. Returns
     * the fencing token to hand to [runClaimedMigration], or null when a run already owns the plan.
     *
     * Split from the run itself so a caller that cannot wait for the run — an HTTP request, since a
     * migration of tens of thousands of cases takes hours — can claim on its own thread and hand the
     * token to a background one. Claiming here rather than there is what keeps that safe: everything
     * that should answer the caller (an unknown plan, a building block plan, an undeployed source, a
     * plan already running) is decided before the response, and the execution is already RUNNING when
     * the caller returns, so a status poll cannot mistake a not-yet-started run for a finished one.
     */
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

    /**
     * Migrate every matching case of an already-claimed plan, then finish it. [runToken] must be the
     * token [claimMigration] returned; the run stops cleanly if a takeover fences it mid-way.
     *
     * The actor is read from the execution row rather than the current thread, so a run continues to be
     * attributed to whoever claimed it — including after a crash, when it is resumed by the trigger
     * sweep on a thread that has no user at all.
     */
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
        // casesMigrated and the failed rows are *lifetime* counts: one row per instance the plan has
        // touched, kept across runs so a re-run skips what it already migrated. execution.casesToMigrate
        // is only the **current** run's matched slice, and a plan run twice over successive batches
        // matches fewer cases the second time than it has already migrated in total. Using it directly
        // as the denominator then reports "6 of 3", so the total is floored at what the plan has
        // already accounted for.
        val casesAccountedFor = casesMigrated + failedCases.size
        val casesTotal = maxOf(execution.casesToMigrate, casesAccountedFor)
        // Cases still needing migration; reaches 0 once every matching case has been processed.
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

    /**
     * Start a **dry run** of the migration plan: simulate migrating every matching case — running
     * the real per-case migration ([applyMigration]) inside a transaction that is always rolled
     * back — and record, per case, whether it would migrate or fail (and why). Persists **nothing**
     * to the cases: no document is re-homed, no process is migrated, no [CaseMigratedEvent] is
     * published, and (crucially) no real-run [CaseMigrationCase] `MIGRATED` row is written, so a
     * dry run never influences whether a later real run migrates or skips a case.
     *
     * Each dry run starts fresh (prior per-case results are cleared on claim). Does nothing if a dry
     * run is already in progress elsewhere (a live lease), and stops cleanly if fenced by a takeover.
     */
    fun startDryRun(migrationId: BlueprintMigrationId): DryRunStatusDto {
        val runToken = claimDryRun(migrationId) ?: return getDryRunStatus(migrationId)
        runClaimedDryRun(migrationId, runToken)
        return getDryRunStatus(migrationId)
    }

    /**
     * Validate the plan and become its single active dry runner, without simulating anything yet.
     * Returns the fencing token to hand to [runClaimedDryRun], or null when a dry run already owns the
     * plan. Split from the run for the same reason as [claimMigration]: a dry run does the same work as
     * a real one, so it takes the same hours and cannot be held open by an HTTP request either.
     */
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

    /**
     * Recompute and cache [CaseDefinitionMigration.estimatedCasesToMigrate] — the (inherently
     * approximate) number of cases currently matching the plan — so the UI can show "cases to migrate"
     * before a run starts, without paying the full scan on every page load. Called by the hourly
     * trigger sweep for plans that have not started yet; once a run starts, the execution's live count
     * is authoritative instead.
     */
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

    /**
     * The status of a **building block** plan, which owns no run of its own: it has no execution row,
     * no lease and no fencing token, because it is never started — it is applied, instance by instance,
     * by whichever case migrations move a building block onto its version. So its status is derived
     * purely from the rows those applications left behind.
     *
     * [MigrationExecutionStatusDto.casesMigrated] is therefore the number of building block *instances*
     * this plan has been applied to so far. There is no "still to migrate" figure — how many instances
     * will ever reach this version depends on which cases migrate — and no error count: an instance
     * that fails rolls back its whole case, and is recorded as a failure against the *case* plan.
     */
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

    /**
     * Count the cases currently matching the plan's conditions, without migrating anything or writing
     * per-case rows. A case whose conditions cannot be evaluated is treated as not matching.
     */
    private fun countMatchingCases(migrationId: BlueprintMigrationId, plan: CaseDefinitionMigration): Int {
        val source = plan.sourceBlueprintId()
        val provider = candidateProvider(source.blueprintType()) ?: return 0

        var count = 0
        var pageable: Pageable = PageRequest.of(0, CANDIDATE_PAGE_SIZE)
        while (true) {
            val page = provider.findCandidateIds(source, pageable)
            // No run is in progress, so an unevaluable case is logged and dropped, recorded nowhere.
            count += page.content.count { caseId ->
                matchesConditions(plan, caseId, "while estimating plan '${plan.id}'")
            }
            if (!page.hasNext()) break
            pageable = page.nextPageable()
        }
        return count
    }

    /**
     * Whether the case's conditions currently hold (this plan's responsibility). A case whose
     * conditions cannot be evaluated is treated as not matching; what that is worth recording is the
     * caller's, via [onFailure] — a failure against the run for a real run, a `WOULD_FAIL` row for a
     * dry run, nothing at all while merely counting.
     */
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

    /**
     * Enumerate the candidate cases page-by-page (never hydrating the full documents nor holding them
     * all in memory) and hand each one whose conditions currently hold to [onMatch]. The lease is
     * renewed as the scan progresses — including during the (potentially long) condition filtering —
     * so the plan is not mistaken for crashed while it is still working.
     *
     * Shared by the real run and the dry run, which differ only in what they do per matching case and
     * in which lease they hold: the paging, the renewal interval and the run cache below are the same
     * scan, and while they were written out twice a fix to one was a fix to neither.
     */
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

        // The scan is the run: the target is fixed for its duration and every case below asks the same
        // questions of it (G31). Wrapped around the loop, not the caller, so finalize() stays outside
        // it. In memory rather than in the transaction, so a dry run's per-case rollback neither undoes
        // it nor is affected by it.
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

    /**
     * Become the single active runner: move the execution to RUNNING with a fresh fencing token and
     * lease, unless another run holds it with a live lease. Returns the token, or null when it is
     * already owned or a concurrent claim won the optimistic-lock/insert race.
     *
     * [actor] is recorded as the run's actor, except when taking over a run that was already RUNNING —
     * a crashed run being reclaimed keeps whoever started it, since resuming someone's migration is not
     * the same act as starting one.
     */
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
        // Warnings are collected on the thread for the duration of this one case (MigrationWarnings),
        // so start from a clean slate and hold on to whatever the components raise — the same set is
        // recorded on the case whether it ends up MIGRATED or FAILED.
        MigrationWarnings.clear()
        var warnings: String? = null
        try {
            // One transaction per case: the case migration (dataMigration + processMigration) AND
            // recording it as migrated commit together, or roll back together.
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
                // Record the migration on the case's audit trail (in the same transaction, so it is
                // present exactly when the case is recorded migrated — and rolled back if it is not).
                applicationEventPublisher.publishEvent(
                    CaseMigratedEvent(
                        // Explicit: the run outlives the request, so the thread has no user to infer
                        // the actor from and would otherwise audit every case as "System".
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
            // A genuine migration failure is recorded against the case; it stays on the old version
            // and the run continues.
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

    /**
     * Give up a claim that was taken but never run — the background pool had no capacity for it.
     *
     * Drops the lease while leaving the status RUNNING, which is precisely the state a node that died
     * mid-run leaves behind, and therefore already means "reclaimable" to
     * [CaseDefinitionMigrationExecutionRepository.findReclaimable]: the trigger sweep resumes it on its
     * next pass. The alternative — finishing it — would report a plan that migrated nothing as
     * COMPLETED, and reverting it to NOT_STARTED would strand the cases a resumed run had left to do.
     */
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

    /**
     * The heart of migrating a single case, shared by the real run and the dry run: re-home the case
     * onto the [target] blueprint version first (independent of which components run, so component
     * writes are validated against the target schema), then run every registered component executor.
     * Runs in the caller's transaction. Returns the source blueprint version the document was on
     * before the re-home (for the audit trail). The real run commits this; the dry run rolls it back.
     */
    private fun applyMigration(migrationId: BlueprintMigrationId, target: BlueprintId, caseId: UUID): BlueprintId {
        return planApplier.apply(migrationId, target, caseId)
    }

    /**
     * Simulate migrating [caseId]: run the real [applyMigration] inside a transaction, then force a
     * rollback so nothing is persisted — capturing whether the case would migrate or fail. Because
     * the process engine shares the application's transaction manager and datasource, the rollback
     * cleanly undoes both the data migration and the (synchronous) process migration. The outcome is
     * recorded in its own (separate, committed) transaction so it survives the rollback.
     */
    private fun simulateCase(migrationId: BlueprintMigrationId, target: BlueprintId, caseId: UUID, runToken: String) {
        MigrationWarnings.clear()
        try {
            transactionTemplate.executeWithoutResult {
                assertDryRunOwnership(migrationId, runToken) // stop if another node has taken over
                applyMigration(migrationId, target, caseId)
                throw DryRunRollback // undo the simulated migration; commit nothing
            }
        } catch (e: DryRunRollback) {
            // The rollback undoes the simulated migration, but not the warnings: they were collected
            // in memory, which is what lets a dry run report what the real run would skip.
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

    /**
     * Simulate migrating every case matching the plan. Mirrors [migrateMatchingCases] but persists
     * nothing to the cases — every matching case's simulated outcome, and every condition-evaluation
     * failure, is recorded in the dry-run table instead.
     */
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

    /**
     * Become the single active dry-run runner: move the dry run to RUNNING with a fresh fencing token
     * and lease (unless another dry run holds it with a live lease), and clear the previous per-case
     * results so this run starts fresh. Returns the token, or null when it is already owned or a
     * concurrent claim won the optimistic-lock/insert race.
     */
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

    /**
     * Drop the plan's latest dry run entirely (status row and per-case results). Called when a real run
     * starts, so the UI never shows a now-stale dry run (it simulated the pre-migration state) next to
     * the real run. After this, [getDryRunStatus] reports [DryRunStatusDto.NOT_STARTED] again.
     */
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

    /**
     * Mutate and save the dry run, but only while this run still owns it (fencing token unchanged and
     * optimistic lock held). Ownership loss surfaces as [MigrationOwnershipLostException] so the dry
     * run stops cleanly.
     */
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

    /**
     * A plan whose declared source version was never deployed selects nothing, migrates nothing and
     * finishes `COMPLETED` — the most convincing way this feature can appear to work while doing
     * nothing (G16). The save path refuses it (`findPlanProblems`), but a plan deployed from a **file**
     * never passes the save path, and auto-deploy visits definition folders in no guaranteed order, so
     * it cannot be refused at import either. Running it is the first moment the answer is knowable and
     * the last moment before an operator reads `COMPLETED` and believes it.
     *
     * Deliberately narrow: this refuses an undeployed *version*, never an empty one. A source version
     * with no documents left is the normal state of a plan that already ran, and re-running it has to
     * stay a silent no-op.
     */
    private fun assertSourceIsDeployed(plan: CaseDefinitionMigration) {
        val source = plan.sourceBlueprintId()
        val lineage = blueprintVersionLineages.firstOrNull { it.supports(source.blueprintType()) } ?: return
        require(lineage.exists(source)) {
            "Migration plan '${plan.id}' declares source '$source', which is not deployed. Running it " +
                "would select no cases and report success without migrating anything. Correct the " +
                "plan's source, or deploy that version first."
        }
    }

    /**
     * A building block plan has no run of its own (R1): it is applied by
     * `BuildingBlockVersionAlignmentExecutor` while its *owner* migrates, to exactly the instances the
     * owner's new version links. Starting one directly is refused rather than quietly doing nothing —
     * which is what it would otherwise do, since there is no building block
     * [MigrationCandidateProvider] to enumerate instances with.
     */
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

    /**
     * Mutate and save the execution, but only while this run still owns it. Ownership loss — either
     * a changed fencing token or a lost optimistic lock — surfaces as [MigrationOwnershipLostException]
     * so the run stops cleanly.
     */
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

    /**
     * Thrown at the end of a successful dry-run simulation to force the surrounding transaction to
     * roll back, so nothing the simulation did is committed. A singleton with no stacktrace (it is
     * control flow, thrown once per simulated case, not a real error).
     */
    private object DryRunRollback : RuntimeException() {
        private fun readResolve(): Any = DryRunRollback
        override fun fillInStackTrace(): Throwable = this
    }

    private companion object {
        val logger = KotlinLogging.logger {}
        const val CANDIDATE_PAGE_SIZE = 500
    }
}
