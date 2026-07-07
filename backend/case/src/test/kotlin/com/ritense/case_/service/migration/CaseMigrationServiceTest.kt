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
import com.ritense.case_.domain.migration.MigrationTriggers
import com.ritense.case_.repository.CaseDefinitionMigrationExecutionRepository
import com.ritense.case_.repository.CaseDefinitionMigrationRepository
import com.ritense.case_.repository.CaseMigrationCaseRepository
import com.ritense.document.domain.DocumentDefinition
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.service.DocumentDefinitionService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.case_.migration.CaseDefinitionMigrationId
import com.ritense.valtimo.contract.case_.migration.MigrationComponentExecutor
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Answers
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.junit.jupiter.MockitoSettings
import org.mockito.kotlin.any
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.mockito.quality.Strictness
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
    @Mock private val documentRepository: JsonSchemaDocumentRepository,
    @Mock private val documentDefinitionService: DocumentDefinitionService,
    @Mock private val conditionEvaluator: MigrationConditionEvaluator,
    @Mock private val executor: MigrationComponentExecutor,
    @Mock private val transactionManager: PlatformTransactionManager,
) {

    private lateinit var service: CaseMigrationService

    private val caseDefinitionId = CaseDefinitionId("bezwaar", "1.0.1")
    private val migrationId = CaseDefinitionMigrationId(caseDefinitionId, "plan")
    private val case1 = UUID.randomUUID()
    private val case2 = UUID.randomUUID()

    private lateinit var execution: CaseDefinitionMigrationExecution

    @BeforeEach
    fun setUp() {
        whenever(transactionManager.getTransaction(any())).thenReturn(SimpleTransactionStatus())
        val transactionTemplate = TransactionTemplate(transactionManager)

        service = CaseMigrationService(
            migrationRepository,
            executionRepository,
            caseRepository,
            documentRepository,
            documentDefinitionService,
            conditionEvaluator,
            listOf(executor),
            emptyList(),
            transactionTemplate,
            Duration.ofMinutes(5),
        )

        execution = CaseDefinitionMigrationExecution(migrationId)
        whenever(migrationRepository.findById(migrationId)).thenReturn(Optional.of(plan()))
        whenever(executionRepository.findById(migrationId)).thenReturn(Optional.of(execution))
        whenever(executionRepository.save(any())).thenAnswer { it.getArgument(0) }
        whenever(caseRepository.save(any())).thenAnswer { it.getArgument(0) }
        whenever(caseRepository.existsByIdAndStatus(any(), any())).thenReturn(false)
        whenever(caseRepository.countByIdMigrationIdAndStatus(any(), any())).thenReturn(0L)
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

        verify(executor).execute(migrationId, case1)
        verify(executor).execute(migrationId, case2)
        verify(caseRepository).save(CaseMigrationCase(caseRecordId(case1), CaseMigrationCaseStatus.MIGRATED))
        verify(caseRepository).save(CaseMigrationCase(caseRecordId(case2), CaseMigrationCaseStatus.MIGRATED))
        assertThat(result.casesToMigrate).isEqualTo(2)
        assertThat(result.status).isEqualTo(CaseMigrationStatus.COMPLETED)
        assertThat(result.finishedOn).isNotNull()
    }

    @Test
    fun `casesToMigrate should count only cases that satisfy the conditions`() {
        stubCandidates(case1, case2)
        whenever(conditionEvaluator.matches(eq(case1), any())).thenReturn(true)
        whenever(conditionEvaluator.matches(eq(case2), any())).thenReturn(false)

        val result = service.startMigration(migrationId)

        verify(executor).execute(migrationId, case1)
        verify(executor, never()).execute(migrationId, case2)
        verify(caseRepository, never()).save(CaseMigrationCase(caseRecordId(case2), CaseMigrationCaseStatus.MIGRATED))
        assertThat(result.casesToMigrate).isEqualTo(1)
        assertThat(result.status).isEqualTo(CaseMigrationStatus.COMPLETED)
    }

    @Test
    fun `should record a failed case and complete with errors`() {
        stubCandidates(case1, case2)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)
        whenever(executor.execute(migrationId, case2)).thenThrow(RuntimeException("boom"))
        whenever(caseRepository.countByIdMigrationIdAndStatus(migrationId, CaseMigrationCaseStatus.FAILED)).thenReturn(1L)

        val result = service.startMigration(migrationId)

        verify(caseRepository).save(CaseMigrationCase(caseRecordId(case1), CaseMigrationCaseStatus.MIGRATED))
        verify(caseRepository).save(CaseMigrationCase(caseRecordId(case2), CaseMigrationCaseStatus.FAILED, "boom"))
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

        verify(executor, never()).execute(migrationId, case1)
        verify(executor).execute(migrationId, case2)
        verify(caseRepository).save(CaseMigrationCase(caseRecordId(case2), CaseMigrationCaseStatus.MIGRATED))
        assertThat(result.status).isEqualTo(CaseMigrationStatus.COMPLETED)
    }

    @Test
    fun `should stop without recording failures when fenced by a takeover mid-run`() {
        stubCandidates(case1, case2)
        whenever(conditionEvaluator.matches(any(), any())).thenReturn(true)
        // Simulate another node taking the plan over (changing the fencing token) during case1.
        doAnswer { execution.runToken = "taken-over-by-another-node"; null }
            .whenever(executor).execute(migrationId, case1)

        val result = service.startMigration(migrationId)

        verify(executor).execute(migrationId, case1)
        verify(executor, never()).execute(migrationId, case2)
        verify(caseRepository, never()).save(CaseMigrationCase(caseRecordId(case2), CaseMigrationCaseStatus.FAILED))
        assertThat(result.status).isEqualTo(CaseMigrationStatus.RUNNING)
    }

    @Test
    fun `should not run when another node holds a live lease`() {
        execution.status = CaseMigrationStatus.RUNNING
        execution.leaseExpiresAt = LocalDateTime.now().plusMinutes(10)

        service.startMigration(migrationId)

        verify(documentDefinitionService, never()).findByBlueprintId(any())
        verify(executor, never()).execute(any(), any())
    }

    @Test
    fun `should not run when the claim loses the optimistic lock race`() {
        whenever(executionRepository.save(any())).thenThrow(OptimisticLockingFailureException("lost race"))

        service.startMigration(migrationId)

        verify(documentDefinitionService, never()).findByBlueprintId(any())
        verify(executor, never()).execute(any(), any())
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
}
