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
import com.ritense.case_.domain.migration.MigrationTriggers
import com.ritense.case_.repository.CaseDefinitionMigrationExecutionRepository
import com.ritense.case_.repository.CaseDefinitionMigrationRepository
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.case_.repository.CaseMigrationCaseRepository
import com.ritense.case_.repository.CaseMigrationDryRunCaseRepository
import com.ritense.case_.repository.CaseMigrationDryRunRepository
import com.ritense.document.domain.DocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.service.DocumentDefinitionService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
import com.ritense.valtimo.contract.blueprint.migration.event.CaseMigratedEvent
import org.assertj.core.api.Assertions.assertThat
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
import org.springframework.context.ApplicationEventPublisher
import org.springframework.dao.OptimisticLockingFailureException
import org.springframework.data.domain.PageImpl
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.SimpleTransactionStatus
import org.springframework.transaction.support.TransactionTemplate
import java.time.Duration
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID

@ExtendWith(MockitoExtension::class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CaseMigrationServiceTest(
    @Mock private val migrationRepository: CaseDefinitionMigrationRepository,
    @Mock private val executionRepository: CaseDefinitionMigrationExecutionRepository,
    @Mock private val caseRepository: CaseMigrationCaseRepository,
    @Mock private val dryRunRepository: CaseMigrationDryRunRepository,
    @Mock private val dryRunCaseRepository: CaseMigrationDryRunCaseRepository,
    @Mock private val documentRepository: JsonSchemaDocumentRepository,
    @Mock private val documentDefinitionService: DocumentDefinitionService,
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

        service = CaseMigrationService(
            migrationRepository,
            executionRepository,
            caseRepository,
            dryRunRepository,
            dryRunCaseRepository,
            documentRepository,
            conditionEvaluator,
            listOf(CaseMigrationCandidateProvider(documentRepository, documentDefinitionService, caseDefinitionRepository)),
            listOf(executor),
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
        whenever(documentRepository.findById(any())).thenReturn(Optional.of(document))
    }

    private fun plan() = CaseDefinitionMigration(
        id = migrationId,
        title = "Plan",
        migrationTriggers = MigrationTriggers(triggeredByButton = true),
    )

    private fun caseRecordId(caseId: UUID) = CaseMigrationCaseId(migrationId, caseId.toString())

    private fun stubCandidates(vararg caseIds: UUID) {
        val documentDefinition = mock<DocumentDefinition>(defaultAnswer = Answers.RETURNS_DEEP_STUBS)
        whenever(documentDefinition.id().name()).thenReturn("bezwaar")
        whenever(documentDefinitionService.findByBlueprintId(caseDefinitionId)).thenReturn(Optional.of(documentDefinition))
        whenever(documentRepository.findCaseIdsByDocumentDefinitionName(any(), any())).thenReturn(PageImpl(caseIds.toList()))
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
    fun `should publish a CaseMigratedEvent on the case audit trail for each migrated case`() {
        stubCandidates(case1)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)

        service.startMigration(migrationId)

        val captor = argumentCaptor<CaseMigratedEvent>()
        verify(applicationEventPublisher).publishEvent(captor.capture())
        val event = captor.firstValue
        assertThat(event.documentId).isEqualTo(case1)
        assertThat(event.blueprintKey).isEqualTo("bezwaar")
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

        // The failed case is recorded with the full stack trace (a @Lob column), so match on content.
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

        verify(documentDefinitionService, never()).findByBlueprintId(any())
        verify(executor, never()).execute(any(), any(), any())
    }

    @Test
    fun `should not run when the claim loses the optimistic lock race`() {
        whenever(executionRepository.save(any())).thenThrow(OptimisticLockingFailureException("lost race"))

        service.startMigration(migrationId)

        verify(documentDefinitionService, never()).findByBlueprintId(any())
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

        // The critical invariant: a dry run leaves no real-run trace, so it can never make a later
        // real run skip a case, and it never records a migration on the audit trail.
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
        // The failing case is recorded with its full stacktrace (a @Lob column), so match on content.
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

        verify(documentDefinitionService, never()).findByBlueprintId(any())
        verify(executor, never()).execute(any(), any(), any())
    }
}
