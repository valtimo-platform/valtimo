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
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case_.repository.CaseDefinitionMigrationExecutionRepository
import com.ritense.case_.repository.CaseDefinitionMigrationRepository
import com.ritense.case_.repository.CaseMigrationCaseRepository
import com.ritense.case_.repository.CaseMigrationDryRunCaseRepository
import com.ritense.case_.repository.CaseMigrationDryRunRepository
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationCandidateProvider
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentDeployer
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
import com.ritense.valtimo.contract.blueprint.migration.event.CaseMigratedEvent
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
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
 * A plan migrates exactly the cases that currently satisfy its conditions; cases that do not match
 * are the responsibility of other plans and are left untouched. A run migrates its whole matching
 * slice and then finishes ([CaseMigrationStatus.COMPLETED] / [CaseMigrationStatus.COMPLETED_WITH_ERRORS]).
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
    private val documentRepository: JsonSchemaDocumentRepository,
    private val conditionEvaluator: MigrationConditionEvaluator,
    private val candidateProviders: List<MigrationCandidateProvider>,
    private val componentExecutors: List<MigrationComponentExecutor>,
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
                val target = resolveTarget(plan.id)
                val source = resolveSource(target)
                MigrationPlanManagementDto(
                    migrationKey = plan.id.migrationKey,
                    title = plan.title,
                    source = formatBlueprintVersion(source),
                    target = formatBlueprintVersion(target),
                    triggers = plan.migrationTriggers,
                    conditions = plan.conditions,
                    components = componentDeployers
                        .filter { it.getComponentToExport(plan.id) != null }
                        .map { it.componentKey() },
                    status = getStatus(plan.id),
                    dryRun = getDryRunStatus(plan.id),
                )
            }
    }

    /**
     * Start (or resume) the migration plan identified by [migrationId]. Idempotent: cases already
     * migrated are skipped. Does nothing if the plan is already being executed elsewhere (a live lease),
     * and stops cleanly if this node is fenced by a takeover mid-run.
     */
    fun startMigration(migrationId: BlueprintMigrationId): CaseDefinitionMigrationExecution {
        val plan = caseDefinitionMigrationRepository.findById(migrationId).orElseThrow {
            NoSuchElementException("No migration plan found for '$migrationId'")
        }

        val runToken = claim(migrationId)
        if (runToken == null) {
            logger.debug { "Migration plan '$migrationId' is already being executed; skipping" }
            return executionRepository.findById(migrationId).orElseThrow()
        }

        // A real run makes the latest dry run stale (it simulated the pre-migration state), so drop it.
        clearDryRun(migrationId)

        return try {
            migrateMatchingCases(migrationId, plan, runToken)
            finalize(migrationId, runToken)
        } catch (e: MigrationOwnershipLostException) {
            logger.info { "Stopped running migration plan '$migrationId': ${e.message}" }
            executionRepository.findById(migrationId).orElseThrow()
        }
    }

    /** Assemble the current migration status (counts and errors come from the per-case table). */
    fun getStatus(migrationId: BlueprintMigrationId): MigrationExecutionStatusDto {
        val execution = executionRepository.findById(migrationId).orElse(null)
            ?: return notStartedStatus(migrationId)
        val casesMigrated = caseMigrationCaseRepository
            .countByIdMigrationIdAndStatus(migrationId, CaseMigrationCaseStatus.MIGRATED).toInt()
        val failedCases = caseMigrationCaseRepository
            .findByIdMigrationIdAndStatus(migrationId, CaseMigrationCaseStatus.FAILED)
        val casesTotal = execution.casesToMigrate
        // Cases still needing migration = the run's matched slice minus those already migrated or failed.
        // Reaches 0 once every matching case has been processed.
        val casesToMigrate = (casesTotal - casesMigrated - failedCases.size).coerceAtLeast(0)
        return MigrationExecutionStatusDto(
            status = execution.status,
            casesToMigrate = casesToMigrate,
            casesTotal = casesTotal,
            casesMigrated = casesMigrated,
            casesWithErrors = failedCases.size,
            errors = failedCases.map { MigrationExecutionError(it.id.caseId, it.errorMessage) },
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
        val plan = caseDefinitionMigrationRepository.findById(migrationId).orElseThrow {
            NoSuchElementException("No migration plan found for '$migrationId'")
        }

        val runToken = claimDryRun(migrationId)
        if (runToken == null) {
            logger.debug { "Dry run for migration plan '$migrationId' is already in progress; skipping" }
            return getDryRunStatus(migrationId)
        }

        return try {
            dryRunMatchingCases(migrationId, plan, runToken)
            finalizeDryRun(migrationId, runToken)
            getDryRunStatus(migrationId)
        } catch (e: MigrationOwnershipLostException) {
            logger.info { "Stopped dry run for migration plan '$migrationId': ${e.message}" }
            getDryRunStatus(migrationId)
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
        return DryRunStatusDto(
            status = dryRun.status,
            casesChecked = wouldMigrate + wouldFail.size,
            casesWouldMigrate = wouldMigrate,
            casesWouldFail = wouldFail.size,
            errors = wouldFail.map { MigrationExecutionError(it.id.caseId, it.errorMessage) },
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
        val source = resolveSource(resolveTarget(migrationId))
        val provider = candidateProvider(source.blueprintType()) ?: return 0

        var count = 0
        var pageable: Pageable = PageRequest.of(0, CANDIDATE_PAGE_SIZE)
        while (true) {
            val page = provider.findCandidateIds(source, pageable)
            count += page.content.count { caseId -> matchesConditionsQuietly(plan, caseId) }
            if (!page.hasNext()) break
            pageable = page.nextPageable()
        }
        return count
    }

    /** Like [matchesConditions] but for counting only: never records a failure (no run is in progress). */
    private fun matchesConditionsQuietly(plan: CaseDefinitionMigration, caseId: UUID): Boolean {
        return try {
            transactionTemplate.execute { conditionEvaluator.matches(caseId, plan.conditions) } ?: false
        } catch (e: Exception) {
            logger.warn(e) { "Could not evaluate conditions for case '$caseId' while estimating plan '${plan.id}'" }
            false
        }
    }

    /**
     * Enumerate the candidate cases page-by-page (never hydrating the full documents nor holding
     * them all in memory) and migrate the ones whose conditions currently hold. The lease is renewed
     * as the scan progresses — including during the (potentially long) condition filtering — so the
     * plan is not mistaken for crashed while it is still working.
     */
    private fun migrateMatchingCases(
        migrationId: BlueprintMigrationId,
        plan: CaseDefinitionMigration,
        runToken: String,
    ) {
        val target = resolveTarget(migrationId)
        val source = resolveSource(target)
        val provider = candidateProvider(source.blueprintType()) ?: return

        val renewInterval = leaseDuration.dividedBy(2)
        var leaseRenewedAt = LocalDateTime.now()
        var matchedCount = 0
        var pageable: Pageable = PageRequest.of(0, CANDIDATE_PAGE_SIZE)

        while (true) {
            val page = provider.findCandidateIds(source, pageable)

            page.content.forEach { caseId ->
                if (matchesConditions(migrationId, plan, caseId, runToken)) {
                    matchedCount++
                    migrateCase(migrationId, target, caseId, runToken)
                }
                if (Duration.between(leaseRenewedAt, LocalDateTime.now()) >= renewInterval) {
                    renewLease(migrationId, runToken)
                    leaseRenewedAt = LocalDateTime.now()
                }
            }

            updateExecution(migrationId, runToken) { it.casesToMigrate = matchedCount }
            if (!page.hasNext()) break
            pageable = page.nextPageable()
        }
    }

    /**
     * Become the single active runner: move the execution to RUNNING with a fresh fencing token and
     * lease, unless another run holds it with a live lease. Returns the token, or null when it is
     * already owned or a concurrent claim won the optimistic-lock/insert race.
     */
    private fun claim(migrationId: BlueprintMigrationId): String? {
        var runToken: String? = null
        try {
            transactionTemplate.executeWithoutResult {
                val execution = executionRepository.findById(migrationId)
                    .orElseGet { CaseDefinitionMigrationExecution(migrationId) }
                if (execution.status == CaseMigrationStatus.RUNNING && isLeaseLive(execution)) {
                    return@executeWithoutResult // another node is actively running it
                }
                val token = UUID.randomUUID().toString()
                execution.status = CaseMigrationStatus.RUNNING
                execution.runToken = token
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

    /**
     * Whether the case's conditions currently hold (this plan's responsibility). A case whose
     * conditions cannot be evaluated is recorded as a failure and treated as not matching.
     */
    private fun matchesConditions(
        migrationId: BlueprintMigrationId,
        plan: CaseDefinitionMigration,
        caseId: UUID,
        runToken: String,
    ): Boolean {
        return try {
            transactionTemplate.execute { conditionEvaluator.matches(caseId, plan.conditions) } ?: false
        } catch (e: Exception) {
            logger.warn(e) { "Could not evaluate conditions for case '$caseId' in plan '$migrationId'" }
            recordFailure(migrationId, caseId, e, runToken)
            false
        }
    }

    private fun migrateCase(migrationId: BlueprintMigrationId, target: BlueprintId, caseId: UUID, runToken: String) {
        val caseRecordId = CaseMigrationCaseId(migrationId, caseId.toString())
        try {
            // One transaction per case: the case migration (dataMigration + processMigration) AND
            // recording it as migrated commit together, or roll back together.
            transactionTemplate.executeWithoutResult {
                assertOwnership(migrationId, runToken) // stop if another node has taken over
                if (caseMigrationCaseRepository.existsByIdAndStatus(caseRecordId, CaseMigrationCaseStatus.MIGRATED)) {
                    return@executeWithoutResult // already migrated (idempotent re-run)
                }
                val fromVersionTag = applyMigration(migrationId, target, caseId)
                caseMigrationCaseRepository.save(CaseMigrationCase(caseRecordId, CaseMigrationCaseStatus.MIGRATED))
                // Record the migration on the case's audit trail (in the same transaction, so it is
                // present exactly when the case is recorded migrated — and rolled back if it is not).
                applicationEventPublisher.publishEvent(
                    CaseMigratedEvent(
                        caseId = caseId,
                        blueprintKey = target.getIdKey(),
                        fromVersionTag = fromVersionTag,
                        toVersionTag = target.blueprintVersionTag().toString(),
                        migrationKey = migrationId.migrationKey,
                    )
                )
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
            recordFailure(migrationId, caseId, e, runToken)
        }
    }

    private fun recordFailure(
        migrationId: BlueprintMigrationId,
        caseId: UUID,
        error: Throwable,
        runToken: String,
    ) {
        val stackTrace = StringWriter().also { error.printStackTrace(PrintWriter(it)) }.toString()
        transactionTemplate.executeWithoutResult {
            assertOwnership(migrationId, runToken)
            caseMigrationCaseRepository.save(
                CaseMigrationCase(CaseMigrationCaseId(migrationId, caseId.toString()), CaseMigrationCaseStatus.FAILED, stackTrace)
            )
        }
    }

    private fun renewLease(migrationId: BlueprintMigrationId, runToken: String) {
        updateExecution(migrationId, runToken) { it.leaseExpiresAt = LocalDateTime.now().plus(leaseDuration) }
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
     * Runs in the caller's transaction. Returns the source version tag the document was on before the
     * re-home (for the audit trail). The real run commits this; the dry run rolls it back.
     */
    private fun applyMigration(migrationId: BlueprintMigrationId, target: BlueprintId, caseId: UUID): String {
        val fromVersionTag = attachToTarget(caseId, target)
        // Spring injects componentExecutors already sorted by each executor's @Order, so they run in
        // a dependency-correct order without the orchestrator knowing which executors exist or what
        // their component keys are.
        componentExecutors.forEach { it.execute(migrationId, target, caseId) }
        return fromVersionTag
    }

    /**
     * Simulate migrating [caseId]: run the real [applyMigration] inside a transaction, then force a
     * rollback so nothing is persisted — capturing whether the case would migrate or fail. Because
     * the process engine shares the application's transaction manager and datasource, the rollback
     * cleanly undoes both the data migration and the (synchronous) process migration. The outcome is
     * recorded in its own (separate, committed) transaction so it survives the rollback.
     */
    private fun simulateCase(migrationId: BlueprintMigrationId, target: BlueprintId, caseId: UUID, runToken: String) {
        try {
            transactionTemplate.executeWithoutResult {
                assertDryRunOwnership(migrationId, runToken) // stop if another node has taken over
                applyMigration(migrationId, target, caseId)
                throw DryRunRollback // undo the simulated migration; commit nothing
            }
        } catch (e: DryRunRollback) {
            recordDryRunOutcome(migrationId, caseId, DryRunCaseStatus.WOULD_MIGRATE, null, runToken)
        } catch (e: MigrationOwnershipLostException) {
            throw e // propagate: this node has been fenced, stop the dry run
        } catch (e: Exception) {
            logger.debug(e) { "Dry run: case '$caseId' would fail in plan '$migrationId'" }
            recordDryRunOutcome(migrationId, caseId, DryRunCaseStatus.WOULD_FAIL, e, runToken)
        }
    }

    private fun recordDryRunOutcome(
        migrationId: BlueprintMigrationId,
        caseId: UUID,
        status: DryRunCaseStatus,
        error: Throwable?,
        runToken: String,
    ) {
        val stackTrace = error?.let { StringWriter().also { w -> it.printStackTrace(PrintWriter(w)) }.toString() }
        transactionTemplate.executeWithoutResult {
            assertDryRunOwnership(migrationId, runToken)
            dryRunCaseRepository.save(
                CaseMigrationDryRunCase(CaseMigrationCaseId(migrationId, caseId.toString()), status, stackTrace)
            )
        }
    }

    /**
     * Enumerate the candidate cases page-by-page and simulate migrating the ones whose conditions
     * currently hold. Mirrors [migrateMatchingCases] but persists nothing to the cases — every
     * matching case's simulated outcome (or a condition-evaluation failure) is recorded in the
     * dry-run table. The lease is renewed as the scan progresses.
     */
    private fun dryRunMatchingCases(
        migrationId: BlueprintMigrationId,
        plan: CaseDefinitionMigration,
        runToken: String,
    ) {
        val target = resolveTarget(migrationId)
        val source = resolveSource(target)
        val provider = candidateProvider(source.blueprintType()) ?: return

        val renewInterval = leaseDuration.dividedBy(2)
        var leaseRenewedAt = LocalDateTime.now()
        var pageable: Pageable = PageRequest.of(0, CANDIDATE_PAGE_SIZE)

        while (true) {
            val page = provider.findCandidateIds(source, pageable)

            page.content.forEach { caseId ->
                if (matchesConditionsForDryRun(migrationId, plan, caseId, runToken)) {
                    simulateCase(migrationId, target, caseId, runToken)
                }
                if (Duration.between(leaseRenewedAt, LocalDateTime.now()) >= renewInterval) {
                    renewDryRunLease(migrationId, runToken)
                    leaseRenewedAt = LocalDateTime.now()
                }
            }

            if (!page.hasNext()) break
            pageable = page.nextPageable()
        }
    }

    /**
     * Whether the case's conditions currently hold, for a dry run. A case whose conditions cannot be
     * evaluated is recorded as a dry-run failure (WOULD_FAIL) and treated as not matching.
     */
    private fun matchesConditionsForDryRun(
        migrationId: BlueprintMigrationId,
        plan: CaseDefinitionMigration,
        caseId: UUID,
        runToken: String,
    ): Boolean {
        return try {
            transactionTemplate.execute { conditionEvaluator.matches(caseId, plan.conditions) } ?: false
        } catch (e: Exception) {
            logger.warn(e) { "Could not evaluate conditions for case '$caseId' in dry run of plan '$migrationId'" }
            recordDryRunOutcome(migrationId, caseId, DryRunCaseStatus.WOULD_FAIL, e, runToken)
            false
        }
    }

    /**
     * Become the single active dry-run runner: move the dry run to RUNNING with a fresh fencing token
     * and lease (unless another dry run holds it with a live lease), and clear the previous per-case
     * results so this run starts fresh. Returns the token, or null when it is already owned or a
     * concurrent claim won the optimistic-lock/insert race.
     */
    private fun claimDryRun(migrationId: BlueprintMigrationId): String? {
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
     * Detach the case document [caseId] from its source blueprint version and attach it to the
     * [target] version: keep the document-definition name but point the `documentDefinitionId` at
     * the target blueprint (case definition or building block definition), then persist it. Runs for
     * every migrated case, independent of which plan components are configured.
     *
     * Returns the version tag the document was on *before* the re-home (the source version), so the
     * caller can record an accurate from → to on the case's audit trail.
     */
    private fun attachToTarget(caseId: UUID, target: BlueprintId): String {
        return runWithoutAuthorization {
            val document = documentRepository.findById(JsonSchemaDocumentId.existingId(caseId)).orElseThrow {
                NoSuchElementException("No document found for case '$caseId' to migrate to the target blueprint")
            }
            val definitionId = document.definitionId() as JsonSchemaDocumentDefinitionId
            val name = definitionId.name()
            val fromVersionTag = definitionId.blueprintId().blueprintVersionTag().toString()
            val targetDefinitionId = when (target) {
                is CaseDefinitionId -> JsonSchemaDocumentDefinitionId.forCase(name, target)
                is BuildingBlockDefinitionId -> JsonSchemaDocumentDefinitionId.forBuildingBlock(name, target)
                else -> throw IllegalArgumentException("Unsupported target blueprint '$target' for migration")
            }
            document.setDefinitionId(targetDefinitionId)
            documentRepository.save(document)
            fromVersionTag
        }
    }

    /** The provider that enumerates candidate instances for a blueprint type, if any. */
    private fun candidateProvider(blueprintType: BlueprintType): MigrationCandidateProvider? {
        return candidateProviders.firstOrNull { it.supports(blueprintType) }
    }

    /**
     * The blueprint version a plan migrates instances TO: always the plan's own id — i.e. the
     * blueprint version the plan is deployed under (its folder).
     */
    private fun resolveTarget(migrationId: BlueprintMigrationId): BlueprintId {
        return BlueprintMigrationId.blueprintIdOf(migrationId.blueprintType, migrationId.key, migrationId.versionTag)
    }

    private fun formatBlueprintVersion(blueprintId: BlueprintId): String =
        "${blueprintId.getIdKey()}:${blueprintId.blueprintVersionTag()}"

    /**
     * The blueprint version a plan migrates instances FROM: the resolved [target]'s type / key, and
     * the version from the target blueprint's `basedOnVersionTag` (falling back to the target
     * version itself when there is no recorded predecessor).
     */
    private fun resolveSource(target: BlueprintId): BlueprintId {
        val sourceVersion = candidateProvider(target.blueprintType())?.basedOnVersionTag(target)
            ?: target.blueprintVersionTag()
        return BlueprintMigrationId.blueprintIdOf(target.blueprintType(), target.getIdKey(), sourceVersion)
    }

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
