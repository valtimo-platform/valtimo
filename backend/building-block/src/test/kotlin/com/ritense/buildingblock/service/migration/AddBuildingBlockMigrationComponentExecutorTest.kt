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

package com.ritense.buildingblock.service.migration

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.domain.migration.AddBuildingBlockConfiguration
import com.ritense.buildingblock.domain.migration.AddBuildingBlockInstruction
import com.ritense.buildingblock.repository.AddBuildingBlockConfigurationRepository
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.case_.service.migration.MigrationDataPatchApplier
import com.ritense.processdocument.migration.ProcessMigrationVariableResolver
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationWarnings
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import com.ritense.valtimo.operaton.repository.OperatonExecutionRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.operaton.bpm.engine.runtime.ProcessInstanceQuery
import org.springframework.jdbc.core.JdbcTemplate
import java.util.Optional
import java.util.UUID

/**
 * The two ways `addBuildingBlock` can end up creating nothing. Both used to be a bare `return`, and
 * a plan in either state migrated every case and reported success.
 */
class AddBuildingBlockMigrationComponentExecutorTest {

    private lateinit var configurationRepository: AddBuildingBlockConfigurationRepository
    private lateinit var instanceService: BuildingBlockInstanceService
    private lateinit var instanceRepository: BuildingBlockInstanceRepository
    private lateinit var runtimeService: RuntimeService
    private lateinit var linkChecker: AddBuildingBlockLinkChecker
    private lateinit var processChecker: AddBuildingBlockProcessChecker
    private lateinit var executor: AddBuildingBlockMigrationComponentExecutor

    private val target = CaseDefinitionId("verhuizing", "1.0.1")
    private val migrationId = BlueprintMigrationId.from(target, "verhuizing-gegevens")
    private val ownerDocumentId: UUID = UUID.fromString("00000000-0000-0000-0000-0000000000aa")

    @BeforeEach
    fun setUp() {
        MigrationWarnings.clear()
        configurationRepository = mock()
        instanceService = mock()
        instanceRepository = mock()
        runtimeService = mock()
        linkChecker = mock()
        processChecker = mock()

        whenever(instanceRepository.findByDocumentId(ownerDocumentId)).thenReturn(null)
        noRunningProcesses()

        executor = AddBuildingBlockMigrationComponentExecutor(
            ObjectMapper(),
            configurationRepository,
            instanceService,
            instanceRepository,
            mock<ProcessDefinitionBuildingBlockDefinitionRepository>(),
            runtimeService,
            mock<OperatonExecutionRepository>(),
            mock<ProcessMigrationVariableResolver>(),
            mock<ProcessDocumentAssociationService>(),
            mock<MigrationDataPatchApplier>(),
            linkChecker,
            processChecker,
            mock<JdbcTemplate>(),
        )
    }

    @AfterEach
    fun tearDown() {
        MigrationWarnings.clear()
    }

    @Test
    fun `should warn and create nothing when no running process matches the entry`() {
        deploy(instruction(ProcessMigrationInstruction("verhuizing-process", "income-check-process")))

        executor.execute(migrationId, target, ownerDocumentId)

        verify(instanceService, never()).create(any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull())
        assertThat(MigrationWarnings.drain())
            .contains("Building block 'income-check:1.0.0' was not added to '$ownerDocumentId'")
            .contains("'verhuizing-process'")
            .contains("business key '$ownerDocumentId'")
    }

    @Test
    fun `should refuse an entry with no process migration before looking at anything else`() {
        deploy(instruction())
        whenever(processChecker.assertHijacksSomething(any(), any()))
            .thenThrow(IllegalStateException("adds building block 'income-check:1.0.0' without a 'processMigration'"))

        assertThatThrownBy { executor.execute(migrationId, target, ownerDocumentId) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("without a 'processMigration'")

        verify(instanceService, never()).create(any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull())
    }

    @Test
    fun `should raise no warning when the plan has no addBuildingBlock component at all`() {
        whenever(configurationRepository.findById(migrationId)).thenReturn(Optional.empty())

        executor.execute(migrationId, target, ownerDocumentId)

        assertThat(MigrationWarnings.drain()).isNull()
    }

    private fun deploy(vararg instructions: AddBuildingBlockInstruction) {
        whenever(configurationRepository.findById(migrationId))
            .thenReturn(Optional.of(AddBuildingBlockConfiguration(migrationId, instructions.toList())))
    }

    private fun instruction(vararg processMigration: ProcessMigrationInstruction) =
        AddBuildingBlockInstruction(
            buildingBlockKey = "income-check",
            buildingBlockVersionTag = "1.0.0",
            processMigration = processMigration.toList(),
        )

    private fun noRunningProcesses() {
        val query = mock<ProcessInstanceQuery>()
        whenever(runtimeService.createProcessInstanceQuery()).thenReturn(query)
        whenever(query.processDefinitionKey(any())).thenReturn(query)
        whenever(query.processInstanceBusinessKey(any())).thenReturn(query)
        whenever(query.list()).thenReturn(emptyList<ProcessInstance>())
    }
}
