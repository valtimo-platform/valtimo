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

import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case_.domain.migration.CaseDefinitionMigration
import com.ritense.case_.domain.migration.CaseDefinitionMigrationExecution
import com.ritense.case_.domain.migration.CaseMigrationCase
import com.ritense.case_.domain.migration.CaseMigrationCaseId
import com.ritense.case_.domain.migration.CaseMigrationCaseStatus
import com.ritense.case_.domain.migration.CaseMigrationDryRun
import com.ritense.case_.domain.migration.CaseMigrationDryRunCase
import com.ritense.case_.domain.migration.CaseMigrationStatus
import com.ritense.case_.domain.migration.DryRunCaseStatus
import com.ritense.case_.domain.migration.MigrationTriggers
import com.ritense.case_.repository.CaseDefinitionMigrationExecutionRepository
import com.ritense.case_.repository.CaseDefinitionMigrationRepository
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.case_.repository.CaseMigrationCaseRepository
import com.ritense.case_.repository.CaseMigrationDryRunCaseRepository
import com.ritense.case_.repository.CaseMigrationDryRunRepository
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintVersionLineage
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
import com.ritense.valtimo.contract.blueprint.migration.event.CaseMigratedEvent
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import java.time.Duration
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Answers
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.junit.jupiter.MockitoSettings
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.mockito.quality.Strictness
import org.semver4j.Semver
import org.springframework.context.ApplicationEventPublisher
import org.springframework.dao.OptimisticLockingFailureException
import org.springframework.data.domain.PageImpl
import org.springframework.data.jpa.domain.Specification
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.SimpleTransactionStatus
import org.springframework.transaction.support.TransactionTemplate

@ExtendWith(MockitoExtension::class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CaseMigrationServiceTest(
    @Mock private val migrationRepository: CaseDefinitionMigrationRepository,
    @Mock private val executionRepository: CaseDefinitionMigrationExecutionRepository,
    @Mock private val caseRepository: CaseMigrationCaseRepository,
    @Mock private val dryRunRepository: CaseMigrationDryRunRepository,
    @Mock private val dryRunCaseRepository: CaseMigrationDryRunCaseRepository,
    @Mock private val documentRepository: JsonSchemaDocumentRepository,
    @Mock private val documentDefinitionRepository: JsonSchemaDocumentDefinitionRepository,
    @Mock private val caseDefinitionRepository: CaseDefinitionRepository,
    @Mock private val conditionEvaluator: MigrationConditionEvaluator,
    @Mock private val executor: MigrationComponentExecutor,
    @Mock private val transactionManager: PlatformTransactionManager,
    @Mock private val applicationEventPublisher: ApplicationEventPublisher,
) {

    private lateinit var service: CaseMigrationService

    private val caseDefinitionId = CaseDefinitionId("bezwaar", "1.0.1")
    private val migrationId = BlueprintMigrationId.from(caseDefinitionId, "plan")
    private val case1 = UUID.randomUUID()
    private val case2 = UUID.randomUUID()

    private lateinit var execution: CaseDefinitionMigrationExecution
    private lateinit var dryRun: CaseMigrationDryRun

    @BeforeEach
    fun setUp() {
        whenever(transactionManager.getTransaction(any())).thenReturn(SimpleTransactionStatus())
        val transactionTemplate = TransactionTemplate(transactionManager)

        val candidateProvider = CaseMigrationCandidateProvider(documentRepository, caseDefinitionRepository)
        service = CaseMigrationService(
            migrationRepository,
            executionRepository,
            caseRepository,
            dryRunRepository,
            dryRunCaseRepository,
            MigrationPlanApplier(documentRepository, documentDefinitionRepository, listOf(executor)),
            conditionEvaluator,
            listOf(candidateProvider),
            emptyList(), // no lineage: the source-is-deployed guard is a no-op, as in a bare context
            emptyList(),
            transactionTemplate,
            applicationEventPublisher,
            Duration.ofMinutes(5),
        )

        execution = CaseDefinitionMigrationExecution(migrationId)
        whenever(migrationRepository.findById(migrationId)).thenReturn(Optional.of(plan()))
        whenever(executionRepository.findById(migrationId)).thenReturn(Optional.of(execution))
        whenever(executionRepository.save(any())).thenAnswer { it.getArgument(0) }
        whenever(caseRepository.save(any())).thenAnswer { it.getArgument(0) }
        whenever(caseRepository.existsByIdAndStatus(any(), any())).thenReturn(false)
        whenever(caseRepository.countByIdMigrationIdAndStatus(any(), any())).thenReturn(0L)
        dryRun = CaseMigrationDryRun(migrationId)
        whenever(dryRunRepository.findById(migrationId)).thenReturn(Optional.of(dryRun))
        whenever(dryRunRepository.save(any())).thenAnswer { it.getArgument(0) }
        whenever(dryRunCaseRepository.save(any())).thenAnswer { it.getArgument(0) }
        whenever(dryRunCaseRepository.countByIdMigrationIdAndStatus(any(), any())).thenReturn(0L)
        whenever(dryRunCaseRepository.findByIdMigrationIdAndStatus(any(), any())).thenReturn(emptyList())
        whenever(caseDefinitionRepository.findById(any())).thenReturn(Optional.empty())
        val document = mock<JsonSchemaDocument>(defaultAnswer = Answers.RETURNS_DEEP_STUBS)
        whenever(document.definitionId().name()).thenReturn("bezwaar")
        // The blueprint the document is currently homed on — what the re-home reports as the source.
        whenever(document.definitionId().blueprintId().asCaseDefinitionId())
            .thenReturn(CaseDefinitionId("bezwaar", "1.0.0"))
        whenever(documentRepository.findById(any())).thenReturn(Optional.of(document))
        val documentDefinition = mock<JsonSchemaDocumentDefinition>(defaultAnswer = Answers.RETURNS_DEEP_STUBS)
        whenever(documentDefinitionRepository.findOne(any<Specification<JsonSchemaDocumentDefinition>>()))
            .thenReturn(Optional.of(documentDefinition))
    }

    /** G16: an undeployed source selects nothing, migrates nothing and reports success. The save path refuses it, but a file-deployed plan never passes the save path. */
    @Test
    fun `should refuse to run a plan whose source version is not deployed`() {
        val lineage = mock<BlueprintVersionLineage>()
        whenever(lineage.supports(BlueprintType.CASE)).thenReturn(true)
        whenever(lineage.exists(any())).thenReturn(false)
        val guarded = serviceWith(lineage)
        whenever(migrationRepository.findById(migrationId)).thenReturn(Optional.of(plan()))

        assertThatThrownBy { guarded.startMigration(migrationId) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("is not deployed")

        assertThatThrownBy { guarded.startDryRun(migrationId) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("is not deployed")

        verify(executionRepository, never()).save(any())
    }

    @Test
    fun `should run a plan whose source version is deployed but empty`() {
        val lineage = mock<BlueprintVersionLineage>()
        whenever(lineage.supports(BlueprintType.CASE)).thenReturn(true)
        whenever(lineage.exists(any())).thenReturn(true)
        val guarded = serviceWith(lineage)
        whenever(migrationRepository.findById(migrationId)).thenReturn(Optional.of(plan()))

        // An empty source version is the normal state of a plan that already ran, so it stays a silent no-op. Asserted on the guard alone.
        val thrown = runCatching { guarded.startMigration(migrationId) }.exceptionOrNull()
        assertThat(thrown?.message).doesNotContain("is not deployed")
    }

    private fun serviceWith(lineage: BlueprintVersionLineage) = CaseMigrationService(
        migrationRepository,
        executionRepository,
        caseRepository,
        dryRunRepository,
        dryRunCaseRepository,
        MigrationPlanApplier(documentRepository, documentDefinitionRepository, listOf(executor)),
        conditionEvaluator,
        listOf(CaseMigrationCandidateProvider(documentRepository, caseDefinitionRepository)),
        listOf(lineage),
        emptyList(),
        TransactionTemplate(transactionManager),
        applicationEventPublisher,
        Duration.ofMinutes(5),
    )

    private fun plan(
        sourceKey: String = "bezwaar",
        sourceVersionTag: Semver = Semver("1.0.0"),
        migrationTriggers: MigrationTriggers = MigrationTriggers(triggeredByButton = true),
    ) = CaseDefinitionMigration(
        id = migrationId,
        sourceKey = sourceKey,
        sourceVersionTag = sourceVersionTag,
        title = "Plan",
        migrationTriggers = migrationTriggers,
    )

    @Test
    fun `should report whether a plan has the button trigger, so the manual entry point can refuse`() {
        whenever(migrationRepository.findById(migrationId))
            .thenReturn(Optional.of(plan(migrationTriggers = MigrationTriggers(triggeredByButton = true))))
        assertThat(service.isTriggeredByButton(migrationId)).isTrue()

        whenever(migrationRepository.findById(migrationId)).thenReturn(
            Optional.of(
                plan(migrationTriggers = MigrationTriggers(scheduledAtDate = LocalDateTime.now().minusDays(1)))
            )
        )
        assertThat(service.isTriggeredByButton(migrationId)).isFalse()
    }

    @Test
    fun `should still start a plan whose only trigger is a schedule, since that is the sweep's entry point`() {
        // The button check belongs to the manual entry point only: the sweep runs exactly the plans with no button trigger.
        whenever(migrationRepository.findById(migrationId)).thenReturn(
            Optional.of(
                plan(migrationTriggers = MigrationTriggers(scheduledAtDate = LocalDateTime.now().minusDays(1)))
            )
        )
        stubCandidates(case1)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)

        val result = service.startMigration(migrationId)

        verify(executor).execute(migrationId, caseDefinitionId, case1)
        assertThat(result.status).isEqualTo(CaseMigrationStatus.COMPLETED)
    }

    private fun caseRecordId(caseId: UUID) = CaseMigrationCaseId(migrationId, caseId.toString())

    private fun stubCandidates(vararg caseIds: UUID) {
        whenever(documentRepository.findCaseIdsByBlueprintVersion(any(), any(), any(), any()))
            .thenReturn(PageImpl(caseIds.toList()))
    }

    @Test
    fun `should migrate all matching candidates and complete`() {
        stubCandidates(case1, case2)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)

        val result = service.startMigration(migrationId)

        verify(executor).execute(migrationId, caseDefinitionId, case1)
        verify(executor).execute(migrationId, caseDefinitionId, case2)
        verify(caseRepository).save(CaseMigrationCase(caseRecordId(case1), CaseMigrationCaseStatus.MIGRATED))
        verify(caseRepository).save(CaseMigrationCase(caseRecordId(case2), CaseMigrationCaseStatus.MIGRATED))
        assertThat(result.casesToMigrate).isEqualTo(2)
        assertThat(result.status).isEqualTo(CaseMigrationStatus.COMPLETED)
        assertThat(result.finishedOn).isNotNull()
    }

    @Test
    fun `should select candidates on the version the plan declares as its source, not on every version`() {
        stubCandidates(case1)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)

        service.startMigration(migrationId)

        verify(documentRepository).findCaseIdsByBlueprintVersion(
            eq(BlueprintType.CASE), eq("bezwaar"), eq(Semver("1.0.0")), any()
        )
    }

    @Test
    fun `should select candidates several versions back when that is what the plan declares`() {
        // Nothing about the target says 0.9.0; the plan does, and that is the only thing consulted.
        whenever(migrationRepository.findById(migrationId))
            .thenReturn(Optional.of(plan(sourceVersionTag = Semver("0.9.0"))))
        stubCandidates(case1)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)

        service.startMigration(migrationId)

        verify(documentRepository).findCaseIdsByBlueprintVersion(
            eq(BlueprintType.CASE), eq("bezwaar"), eq(Semver("0.9.0")), any()
        )
    }

    @Test
    fun `should select candidates of another case definition key when the plan declares one`() {
        whenever(migrationRepository.findById(migrationId))
            .thenReturn(Optional.of(plan(sourceKey = "bezwaar-oud", sourceVersionTag = Semver("2.0.0"))))
        stubCandidates(case1)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)

        service.startMigration(migrationId)

        verify(documentRepository).findCaseIdsByBlueprintVersion(
            eq(BlueprintType.CASE), eq("bezwaar-oud"), eq(Semver("2.0.0")), any()
        )
    }

    @Test
    fun `should ignore the target's basedOnVersionTag, which no longer decides the source`() {
        whenever(caseDefinitionRepository.findById(caseDefinitionId)).thenReturn(
            Optional.of(
                CaseDefinition(
                    id = caseDefinitionId,
                    name = "bezwaar",
                    createdDate = null,
                    basedOnVersionTag = Semver("1.0.0"),
                )
            )
        )
        whenever(migrationRepository.findById(migrationId))
            .thenReturn(Optional.of(plan(sourceVersionTag = Semver("0.8.0"))))
        stubCandidates(case1)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)

        service.startMigration(migrationId)

        verify(documentRepository).findCaseIdsByBlueprintVersion(
            eq(BlueprintType.CASE), eq("bezwaar"), eq(Semver("0.8.0")), any()
        )
    }

    @Test
    fun `should publish a CaseMigratedEvent on the case audit trail for each migrated case`() {
        stubCandidates(case1)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)

        service.startMigration(migrationId)

        val captor = argumentCaptor<CaseMigratedEvent>()
        verify(applicationEventPublisher).publishEvent(captor.capture())
        val event = captor.firstValue
        assertThat(event.documentId).isEqualTo(case1)
        assertThat(event.blueprintKey).isEqualTo("bezwaar")
        assertThat(event.fromBlueprintKey).isEqualTo("bezwaar")
        assertThat(event.fromVersionTag).isEqualTo("1.0.0")
        assertThat(event.toVersionTag).isEqualTo("1.0.1")
        assertThat(event.migrationKey).isEqualTo("plan")
    }

    @Test
    fun `casesToMigrate should count only cases that satisfy the conditions`() {
        stubCandidates(case1, case2)
        whenever(conditionEvaluator.matches(eq(case1), any())).thenReturn(true)
        whenever(conditionEvaluator.matches(eq(case2), any())).thenReturn(false)

        val result = service.startMigration(migrationId)

        verify(executor).execute(migrationId, caseDefinitionId, case1)
        verify(executor, never()).execute(migrationId, caseDefinitionId, case2)
        verify(caseRepository, never()).save(CaseMigrationCase(caseRecordId(case2), CaseMigrationCaseStatus.MIGRATED))
        assertThat(result.casesToMigrate).isEqualTo(1)
        assertThat(result.status).isEqualTo(CaseMigrationStatus.COMPLETED)
    }

    @Test
    fun `should record a failed case and complete with errors`() {
        stubCandidates(case1, case2)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)
        whenever(executor.execute(migrationId, caseDefinitionId, case2)).thenThrow(RuntimeException("boom"))
        whenever(caseRepository.countByIdMigrationIdAndStatus(migrationId, CaseMigrationCaseStatus.FAILED)).thenReturn(1L)

        val result = service.startMigration(migrationId)

        verify(caseRepository).save(CaseMigrationCase(caseRecordId(case1), CaseMigrationCaseStatus.MIGRATED))

        // The failed case is recorded with the full stack trace, so match on content.
        val savedCases = argumentCaptor<CaseMigrationCase>()
        verify(caseRepository, times(2)).save(savedCases.capture())
        val failed = savedCases.allValues.single { it.status == CaseMigrationCaseStatus.FAILED }
        assertThat(failed.id).isEqualTo(caseRecordId(case2))
        assertThat(failed.errorMessage).contains("boom")
        assertThat(result.status).isEqualTo(CaseMigrationStatus.COMPLETED_WITH_ERRORS)
    }

    @Test
    fun `should reclaim a crashed run and skip already-migrated cases`() {
        execution.status = CaseMigrationStatus.RUNNING
        execution.leaseExpiresAt = LocalDateTime.now().minusMinutes(10)
        stubCandidates(case1, case2)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)
        whenever(caseRepository.existsByIdAndStatus(caseRecordId(case1), CaseMigrationCaseStatus.MIGRATED)).thenReturn(true)

        val result = service.startMigration(migrationId)

        verify(executor, never()).execute(migrationId, caseDefinitionId, case1)
        verify(executor).execute(migrationId, caseDefinitionId, case2)
        verify(caseRepository).save(CaseMigrationCase(caseRecordId(case2), CaseMigrationCaseStatus.MIGRATED))
        assertThat(result.status).isEqualTo(CaseMigrationStatus.COMPLETED)
    }

    @Test
    fun `should record the actor that claimed the run, so a background run is not audited as System`() {
        // The claim happens on the request thread, which still has the user; the run does not.
        SecurityContextHolder.getContext().authentication =
            UsernamePasswordAuthenticationToken("asha", null, emptyList())
        try {
            stubCandidates(case1)
            whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)

            val runToken = service.claimMigration(migrationId)!!
            assertThat(execution.runActor).isEqualTo("asha")

            // The run itself has no user, and must take the actor off the execution row instead.
            SecurityContextHolder.clearContext()
            service.runClaimedMigration(migrationId, runToken)

            val captor = argumentCaptor<CaseMigratedEvent>()
            verify(applicationEventPublisher).publishEvent(captor.capture())
            assertThat(captor.firstValue.user).isEqualTo("asha")
        } finally {
            SecurityContextHolder.clearContext()
        }
    }

    @Test
    fun `a reclaimed run should keep the actor that started it, not the one that resumed it`() {
        // A crashed run: RUNNING with a lapsed lease. Reclaiming must not re-attribute the original person's migration.
        execution.status = CaseMigrationStatus.RUNNING
        execution.leaseExpiresAt = LocalDateTime.now().minusMinutes(10)
        execution.runActor = "asha"
        stubCandidates(case1)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)

        service.startMigration(migrationId)

        assertThat(execution.runActor).isEqualTo("asha")
        val captor = argumentCaptor<CaseMigratedEvent>()
        verify(applicationEventPublisher).publishEvent(captor.capture())
        assertThat(captor.firstValue.user).isEqualTo("asha")
    }

    @Test
    fun `abandoning a claim should leave the run reclaimable rather than falsely completed`() {
        val runToken = service.claimMigration(migrationId)!!

        service.abandonClaim(migrationId, runToken)

        // RUNNING with no lease is exactly what findReclaimable looks for, so the sweep resumes it.
        assertThat(execution.status).isEqualTo(CaseMigrationStatus.RUNNING)
        assertThat(execution.leaseExpiresAt).isNull()
        assertThat(execution.runToken).isNull()
    }

    @Test
    fun `should stop without recording failures when fenced by a takeover mid-run`() {
        stubCandidates(case1, case2)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)
        // Simulate another node taking the plan over (changing the fencing token) during case1.
        doAnswer { execution.runToken = "taken-over-by-another-node"; null }
            .whenever(executor).execute(migrationId, caseDefinitionId, case1)

        val result = service.startMigration(migrationId)

        verify(executor).execute(migrationId, caseDefinitionId, case1)
        verify(executor, never()).execute(migrationId, caseDefinitionId, case2)
        verify(caseRepository, never()).save(CaseMigrationCase(caseRecordId(case2), CaseMigrationCaseStatus.FAILED))
        assertThat(result.status).isEqualTo(CaseMigrationStatus.RUNNING)
    }

    @Test
    fun `should not run when another node holds a live lease`() {
        execution.status = CaseMigrationStatus.RUNNING
        execution.leaseExpiresAt = LocalDateTime.now().plusMinutes(10)

        service.startMigration(migrationId)

        verify(documentRepository, never()).findCaseIdsByBlueprintVersion(any(), any(), any(), any())
        verify(executor, never()).execute(any(), any(), any())
    }

    @Test
    fun `should not run when the claim loses the optimistic lock race`() {
        whenever(executionRepository.save(any())).thenThrow(OptimisticLockingFailureException("lost race"))

        service.startMigration(migrationId)

        verify(documentRepository, never()).findCaseIdsByBlueprintVersion(any(), any(), any(), any())
        verify(executor, never()).execute(any(), any(), any())
    }

    @Test
    fun `should release the lease when the run finishes`() {
        stubCandidates()

        val result = service.startMigration(migrationId)

        assertThat(result.leaseExpiresAt).isNull()
        assertThat(result.status).isEqualTo(CaseMigrationStatus.COMPLETED)
    }

    @Test
    fun `getStatus should return the cached estimate before a run has started`() {
        val plan = CaseDefinitionMigration(
            id = migrationId,
            sourceKey = "bezwaar",
            sourceVersionTag = Semver("1.0.0"),
            title = "Plan",
            migrationTriggers = MigrationTriggers(triggeredByButton = true),
            estimatedCasesToMigrate = 7,
        )
        whenever(migrationRepository.findById(migrationId)).thenReturn(Optional.of(plan))
        whenever(executionRepository.findById(migrationId)).thenReturn(Optional.empty())

        val status = service.getStatus(migrationId)

        assertThat(status.status).isEqualTo(CaseMigrationStatus.NOT_STARTED)
        assertThat(status.casesToMigrate).isEqualTo(7)
        assertThat(status.casesTotal).isEqualTo(7)
    }

    @Test
    fun `getStatus should report remaining as total minus migrated and errors`() {
        execution.status = CaseMigrationStatus.RUNNING
        execution.casesToMigrate = 5 // the run's matched slice
        whenever(caseRepository.countByIdMigrationIdAndStatus(migrationId, CaseMigrationCaseStatus.MIGRATED))
            .thenReturn(3L)
        whenever(caseRepository.findByIdMigrationIdAndStatus(migrationId, CaseMigrationCaseStatus.FAILED))
            .thenReturn(listOf(CaseMigrationCase(caseRecordId(case1), CaseMigrationCaseStatus.FAILED, "boom")))

        val status = service.getStatus(migrationId)

        assertThat(status.casesTotal).isEqualTo(5)
        assertThat(status.casesMigrated).isEqualTo(3)
        assertThat(status.casesWithErrors).isEqualTo(1)
        assertThat(status.casesToMigrate).isEqualTo(1) // 5 matched - 3 migrated - 1 failed
    }

    @Test
    fun `getStatus should report 0 remaining once every matching case has been migrated`() {
        execution.status = CaseMigrationStatus.COMPLETED
        execution.casesToMigrate = 1
        whenever(caseRepository.countByIdMigrationIdAndStatus(migrationId, CaseMigrationCaseStatus.MIGRATED))
            .thenReturn(1L)

        val status = service.getStatus(migrationId)

        assertThat(status.casesTotal).isEqualTo(1)
        assertThat(status.casesMigrated).isEqualTo(1)
        assertThat(status.casesToMigrate).isEqualTo(0)
    }

    @Test
    fun `getStatus should never report more migrated than total when a plan is run over successive batches`() {
        // MIGRATED rows are lifetime, so the numerator is 6 while the run's own slice is 3 — the denominator has to account for both, or the UI reads "6 of 3".
        execution.status = CaseMigrationStatus.COMPLETED
        execution.casesToMigrate = 3 // this run's matched slice only
        whenever(caseRepository.countByIdMigrationIdAndStatus(migrationId, CaseMigrationCaseStatus.MIGRATED))
            .thenReturn(6L)

        val status = service.getStatus(migrationId)

        assertThat(status.casesMigrated).isEqualTo(6)
        assertThat(status.casesTotal).isEqualTo(6)
        assertThat(status.casesToMigrate).isEqualTo(0)
        assertThat(status.casesMigrated).isLessThanOrEqualTo(status.casesTotal)
    }

    @Test
    fun `should clear the latest dry run when a real run starts`() {
        stubCandidates(case1)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)

        service.startMigration(migrationId)

        verify(dryRunCaseRepository).deleteByIdMigrationId(migrationId)
        verify(dryRunRepository).delete(dryRun)
    }

    @Test
    fun `refreshCaseCountEstimate should count matching cases and cache it on the plan`() {
        val plan = CaseDefinitionMigration(
            id = migrationId,
            sourceKey = "bezwaar",
            sourceVersionTag = Semver("1.0.0"),
            title = "Plan",
            migrationTriggers = MigrationTriggers(triggeredByButton = true),
        )
        whenever(migrationRepository.findById(migrationId)).thenReturn(Optional.of(plan))
        whenever(migrationRepository.save(any())).thenAnswer { it.getArgument(0) }
        stubCandidates(case1, case2)
        whenever(conditionEvaluator.matches(eq(case1), any())).thenReturn(true)
        whenever(conditionEvaluator.matches(eq(case2), any())).thenReturn(false)

        service.refreshCaseCountEstimate(migrationId)

        assertThat(plan.estimatedCasesToMigrate).isEqualTo(1)
        verify(migrationRepository).save(plan)
        // Estimating must not touch per-case state or record failures.
        verify(caseRepository, never()).save(any())
    }

    @Test
    fun `dry run should simulate every matching case and record it as would-migrate`() {
        stubCandidates(case1, case2)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)
        whenever(dryRunCaseRepository.countByIdMigrationIdAndStatus(migrationId, DryRunCaseStatus.WOULD_MIGRATE))
            .thenReturn(2L)

        val result = service.startDryRun(migrationId)

        // The real migration is exercised for each case (so real validation/mapping errors surface)...
        verify(executor).execute(migrationId, caseDefinitionId, case1)
        verify(executor).execute(migrationId, caseDefinitionId, case2)
        // ...recorded as a would-migrate dry-run outcome...
        verify(dryRunCaseRepository).save(CaseMigrationDryRunCase(caseRecordId(case1), DryRunCaseStatus.WOULD_MIGRATE))
        verify(dryRunCaseRepository).save(CaseMigrationDryRunCase(caseRecordId(case2), DryRunCaseStatus.WOULD_MIGRATE))
        assertThat(result.status).isEqualTo(CaseMigrationStatus.COMPLETED)
        assertThat(result.casesWouldMigrate).isEqualTo(2)
        assertThat(result.casesChecked).isEqualTo(2)
    }

    @Test
    fun `dry run must not write any real migration row or publish an audit event (isolation)`() {
        stubCandidates(case1, case2)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)

        service.startDryRun(migrationId)

        // The critical invariant: a dry run leaves no real-run trace, so it can never make a later real run skip a case.
        verify(caseRepository, never()).save(any())
        verify(applicationEventPublisher, never()).publishEvent(any())
    }

    @Test
    fun `dry run should record a case whose migration would fail, with the reason`() {
        stubCandidates(case1, case2)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)
        whenever(executor.execute(migrationId, caseDefinitionId, case2)).thenThrow(RuntimeException("boom"))
        whenever(dryRunCaseRepository.countByIdMigrationIdAndStatus(migrationId, DryRunCaseStatus.WOULD_FAIL))
            .thenReturn(1L)

        val result = service.startDryRun(migrationId)

        verify(dryRunCaseRepository).save(CaseMigrationDryRunCase(caseRecordId(case1), DryRunCaseStatus.WOULD_MIGRATE))
        // The failing case is recorded with its full stacktrace, so match on content.
        val saved = argumentCaptor<CaseMigrationDryRunCase>()
        verify(dryRunCaseRepository, times(2)).save(saved.capture())
        val failed = saved.allValues.single { it.status == DryRunCaseStatus.WOULD_FAIL }
        assertThat(failed.id).isEqualTo(caseRecordId(case2))
        assertThat(failed.errorMessage).contains("boom")
        // No real migration row is written for the failing (or the succeeding) case.
        verify(caseRepository, never()).save(any())
        assertThat(result.status).isEqualTo(CaseMigrationStatus.COMPLETED_WITH_ERRORS)
    }

    @Test
    fun `dry run should record a would-fail when a case's conditions cannot be evaluated`() {
        stubCandidates(case1)
        whenever(conditionEvaluator.matches(eq(case1), any())).thenThrow(RuntimeException("condition boom"))
        whenever(dryRunCaseRepository.countByIdMigrationIdAndStatus(migrationId, DryRunCaseStatus.WOULD_FAIL))
            .thenReturn(1L)

        val result = service.startDryRun(migrationId)

        // A case whose conditions cannot be evaluated is a would-fail and is not simulated.
        verify(executor, never()).execute(any(), any(), any())
        val saved = argumentCaptor<CaseMigrationDryRunCase>()
        verify(dryRunCaseRepository).save(saved.capture())
        assertThat(saved.firstValue.status).isEqualTo(DryRunCaseStatus.WOULD_FAIL)
        assertThat(saved.firstValue.errorMessage).contains("condition boom")
        assertThat(result.status).isEqualTo(CaseMigrationStatus.COMPLETED_WITH_ERRORS)
    }

    @Test
    fun `dry run should clear previous results on claim so each run starts fresh`() {
        stubCandidates()

        service.startDryRun(migrationId)

        verify(dryRunCaseRepository).deleteByIdMigrationId(migrationId)
    }

    @Test
    fun `dry run should not run when another dry run holds a live lease`() {
        dryRun.status = CaseMigrationStatus.RUNNING
        dryRun.leaseExpiresAt = LocalDateTime.now().plusMinutes(10)

        service.startDryRun(migrationId)

        verify(documentRepository, never()).findCaseIdsByBlueprintVersion(any(), any(), any(), any())
        verify(executor, never()).execute(any(), any(), any())
    }

    @Test
    fun `should refuse to start a building block plan on its own`() {
        val buildingBlockPlanId = BlueprintMigrationId.from(
            BuildingBlockDefinitionId.of("verhuizing-inspectie", "1.0.4"), "fotodossier"
        )

        assertThatThrownBy { service.startMigration(buildingBlockPlanId) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("cannot be started on its own")
            .hasMessageContaining("because its owner migrated")
        // Refused before anything is claimed, so no lease and no run row are left behind.
        verify(executionRepository, never()).save(any())
        verify(executor, never()).execute(any(), any(), any())
    }

    @Test
    fun `should refuse to dry run a building block plan on its own`() {
        val buildingBlockPlanId = BlueprintMigrationId.from(
            BuildingBlockDefinitionId.of("verhuizing-inspectie", "1.0.4"), "fotodossier"
        )

        assertThatThrownBy { service.startDryRun(buildingBlockPlanId) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("cannot be started on its own")
        verify(dryRunRepository, never()).save(any())
        verify(executor, never()).execute(any(), any(), any())
    }
}
