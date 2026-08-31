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

package com.ritense.processdocument.migration

import com.ritense.valtimo.migration.domain.ProcessMigrationConfiguration
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.valtimo.migration.repository.ProcessMigrationConfigurationRepository
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationWarnings
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.operaton.bpm.engine.runtime.ProcessInstanceQuery
import java.util.Optional
import java.util.UUID

/** What the component reports when its instructions match nothing. One instruction matching nothing is ordinary and only logged; the component matching nothing at all is the wrong-key plan D13 catches. */
class ProcessMigrationComponentExecutorTest {

    private lateinit var configurationRepository: ProcessMigrationConfigurationRepository
    private lateinit var processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository
    private lateinit var runtimeService: RuntimeService
    private lateinit var query: ProcessInstanceQuery
    private lateinit var executor: ProcessMigrationComponentExecutor

    private val target = CaseDefinitionId("verhuizing", "1.0.1")
    private val migrationId = BlueprintMigrationId.from(target, "verhuizing-gegevens")
    private val caseId: UUID = UUID.fromString("00000000-0000-0000-0000-0000000000aa")

    @BeforeEach
    fun setUp() {
        MigrationWarnings.clear()
        configurationRepository = mock()
        processDefinitionCaseDefinitionRepository = mock()
        runtimeService = mock()

        query = mock()
        whenever(runtimeService.createProcessInstanceQuery()).thenReturn(query)
        whenever(query.processDefinitionKey(any())).thenReturn(query)
        whenever(query.processInstanceBusinessKey(any())).thenReturn(query)
        whenever(query.list()).thenReturn(emptyList<ProcessInstance>())

        executor = ProcessMigrationComponentExecutor(
            configurationRepository,
            processDefinitionCaseDefinitionRepository,
            runtimeService,
            mock<ProcessMigrationVariableResolver>(),
        )
    }

    @AfterEach
    fun tearDown() {
        MigrationWarnings.clear()
    }

    @Test
    fun `should warn once, naming every key, when no instruction matches a running process`() {
        deploy(
            ProcessMigrationInstruction("verhuizing-process", "verhuizing-process"),
            ProcessMigrationInstruction("verhuizing-nazorg", "verhuizing-nazorg"),
        )

        executor.execute(migrationId, target, caseId)

        val warnings = MigrationWarnings.drain()
        assertThat(warnings).isNotNull()
        assertThat(warnings!!.lines()).hasSize(1)
        assertThat(warnings)
            .contains("No process was migrated for '$caseId'")
            .contains("2 processMigration instruction(s)")
            .contains("'verhuizing-process'")
            .contains("'verhuizing-nazorg'")
    }

    @Test
    fun `should raise no warning when the plan has no process migration component at all`() {
        whenever(configurationRepository.findById(migrationId)).thenReturn(Optional.empty())

        executor.execute(migrationId, target, caseId)

        assertThat(MigrationWarnings.drain()).isNull()
    }

    private fun deploy(vararg instructions: ProcessMigrationInstruction) {
        whenever(configurationRepository.findById(migrationId))
            .thenReturn(Optional.of(ProcessMigrationConfiguration(migrationId, instructions.toList())))
    }
}
