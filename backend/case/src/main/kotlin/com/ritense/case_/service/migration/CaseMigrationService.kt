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
import com.ritense.case_.domain.migration.CaseMigrationStatus
import com.ritense.case_.domain.migration.MigrationExecutionError
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case_.repository.CaseDefinitionMigrationExecutionRepository
import com.ritense.case_.repository.CaseDefinitionMigrationRepository
import com.ritense.case_.repository.CaseMigrationCaseRepository
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationCandidateProvider
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentDeployer
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.dao.OptimisticLockingFailureException
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.transaction.support.TransactionTemplate
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
    private val documentRepository: JsonSchemaDocumentRepository,
    private val conditionEvaluator: MigrationConditionEvaluator,
    private val candidateProviders: List<MigrationCandidateProvider>,
    private val componentExecutors: List<MigrationComponentExecutor>,
    private val componentDeployers: List<MigrationComponentDeployer>,
    private val transactionTemplate: TransactionTemplate,
    private val leaseDuration: Duration,
) {

    /** Delete a migration plan and everything derived from it (components, execution, per-case rows). */
    fun deletePlan(migrationId: BlueprintMigrationId) {
        transactionTemplate.executeWithoutResult {
            componentDeployers.forEach { it.undeploy(migrationId) }
            caseMigrationCaseRepository.deleteByIdMigrationId(migrationId)
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
                MigrationPlanManagementDto(
                    migrationKey = plan.id.migrationKey,
                    title = plan.title,
                    triggers = plan.migrationTriggers,
                    conditions = plan.conditions,
                    components = componentDeployers
                        .filter { it.getComponentToExport(plan.id) != null }
                        .map { it.componentKey() },
                    status = getStatus(plan.id),
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
            .countByIdMigrationIdAndStatus(migrationId, CaseMigrationCaseStatus.MIGRATED)
        val failedCases = caseMigrationCaseRepository
            .findByIdMigrationIdAndStatus(migrationId, CaseMigrationCaseStatus.FAILED)
        return MigrationExecutionStatusDto(
            status = execution.status,
            casesToMigrate = execution.casesToMigrate,
            casesMigrated = casesMigrated.toInt(),
            casesWithErrors = failedCases.size,
            errors = failedCases.map { MigrationExecutionError(it.id.caseId, it.errorMessage) },
            startedOn = execution.startedOn,
            finishedOn = execution.finishedOn,
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
        return MigrationExecutionStatusDto.NOT_STARTED.copy(casesToMigrate = estimate)
    }

    /**
     * Count the cases currently matching the plan's conditions, without migrating anything or writing
     * per-case rows. A case whose conditions cannot be evaluated is treated as not matching.
     */
    private fun countMatchingCases(migrationId: BlueprintMigrationId, plan: CaseDefinitionMigration): Int {
        val source = resolveSource(resolveTarget(migrationId, plan), plan)
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
        val target = resolveTarget(migrationId, plan)
        val source = resolveSource(target, plan)
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
            recordFailure(migrationId, caseId, e.message, runToken)
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
                // Re-home the case onto the target blueprint version first (independent of which
                // components run), so component writes are validated against the target schema.
                attachToTarget(caseId, target)
                componentExecutors.forEach { it.execute(migrationId, target, caseId) }
                caseMigrationCaseRepository.save(CaseMigrationCase(caseRecordId, CaseMigrationCaseStatus.MIGRATED))
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
            recordFailure(migrationId, caseId, e.message, runToken)
        }
    }

    private fun recordFailure(
        migrationId: BlueprintMigrationId,
        caseId: UUID,
        message: String?,
        runToken: String,
    ) {
        transactionTemplate.executeWithoutResult {
            assertOwnership(migrationId, runToken)
            caseMigrationCaseRepository.save(
                CaseMigrationCase(CaseMigrationCaseId(migrationId, caseId.toString()), CaseMigrationCaseStatus.FAILED, message)
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
     * Detach the case document [caseId] from its source blueprint version and attach it to the
     * [target] version: keep the document-definition name but point the `documentDefinitionId` at
     * the target blueprint (case definition or building block definition), then persist it. Runs for
     * every migrated case, independent of which plan components are configured.
     */
    private fun attachToTarget(caseId: UUID, target: BlueprintId) {
        runWithoutAuthorization {
            val document = documentRepository.findById(JsonSchemaDocumentId.existingId(caseId)).orElseThrow {
                NoSuchElementException("No document found for case '$caseId' to migrate to the target blueprint")
            }
            val name = document.definitionId().name()
            val targetDefinitionId = when (target) {
                is CaseDefinitionId -> JsonSchemaDocumentDefinitionId.forCase(name, target)
                is BuildingBlockDefinitionId -> JsonSchemaDocumentDefinitionId.forBuildingBlock(name, target)
                else -> throw IllegalArgumentException("Unsupported target blueprint '$target' for migration")
            }
            document.setDefinitionId(targetDefinitionId)
            documentRepository.save(document)
        }
    }

    /** The provider that enumerates candidate instances for a blueprint type, if any. */
    private fun candidateProvider(blueprintType: BlueprintType): MigrationCandidateProvider? {
        return candidateProviders.firstOrNull { it.supports(blueprintType) }
    }

    /**
     * The blueprint version a plan migrates instances TO. Defaults each unset `target*` field to the
     * plan's own id — i.e. the blueprint version the plan is deployed under.
     */
    private fun resolveTarget(migrationId: BlueprintMigrationId, plan: CaseDefinitionMigration): BlueprintId {
        val targetType = plan.targetBlueprintType ?: migrationId.blueprintType
        val targetKey = plan.targetKey ?: migrationId.key
        val targetVersion = plan.targetVersionTag ?: migrationId.versionTag
        return BlueprintMigrationId.blueprintIdOf(targetType, targetKey, targetVersion)
    }

    /**
     * The blueprint version a plan migrates instances FROM. Defaults each unset `source*` field to
     * the resolved [target]'s type / key, and the version to the target blueprint's
     * `basedOnVersionTag` (falling back to the target version itself when there is no recorded
     * predecessor).
     */
    private fun resolveSource(target: BlueprintId, plan: CaseDefinitionMigration): BlueprintId {
        val sourceType = plan.sourceBlueprintType ?: target.blueprintType()
        val sourceKey = plan.sourceKey ?: target.getIdKey()
        val sourceVersion = plan.sourceVersionTag
            ?: candidateProvider(target.blueprintType())?.basedOnVersionTag(target)
            ?: target.blueprintVersionTag()
        return BlueprintMigrationId.blueprintIdOf(sourceType, sourceKey, sourceVersion)
    }

    private fun isLeaseLive(execution: CaseDefinitionMigrationExecution): Boolean {
        return execution.leaseExpiresAt?.isAfter(LocalDateTime.now()) == true
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

    private companion object {
        val logger = KotlinLogging.logger {}
        const val CANDIDATE_PAGE_SIZE = 500
    }
}
