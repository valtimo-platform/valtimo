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

import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.migration.ProcessMigrationVariableResolver
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationWarnings
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.migration.domain.ProcessMigrationConfiguration
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import com.ritense.valtimo.migration.repository.ProcessMigrationConfigurationRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito.RETURNS_DEEP_STUBS
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.operaton.bpm.engine.runtime.ProcessInstanceQuery
import java.util.Optional
import java.util.UUID

/** G65: a block may own more than one process, and the instructions naming the others were silent no-ops. */
class BuildingBlockProcessMigrationComponentExecutorTest {

    private lateinit var configurationRepository: ProcessMigrationConfigurationRepository
    private lateinit var processDefinitionLinkRepository: ProcessDefinitionBuildingBlockDefinitionRepository
    private lateinit var instanceRepository: BuildingBlockInstanceRepository
    private lateinit var runtimeService: RuntimeService
    private lateinit var query: ProcessInstanceQuery
    private lateinit var executor: BuildingBlockProcessMigrationComponentExecutor

    private val target = BuildingBlockDefinitionId.of("verhuizing-inspectie", "1.0.4")
    private val migrationId = BlueprintMigrationId.from(target, "nieuwe-versie")
    private val documentId: UUID = UUID.randomUUID()

    // The block's own process, and a second one its own BPMN calls — a different process instance.
    private val mainKey = "verhuizing-inspectie-process"
    private val calledKey = "verhuizing-inspectie-controle"
    private val mainOldId = "$mainKey:3:old"
    private val calledOldId = "$calledKey:3:old"
    private val mainNewId = "$mainKey:4:new"
    private val calledNewId = "$calledKey:4:new"

    private val instructions = mutableListOf<ProcessMigrationInstruction>()
    private val running = mutableMapOf<String, ProcessInstance>()

    @BeforeEach
    fun setUp() {
        MigrationWarnings.clear()
        configurationRepository = mock()
        processDefinitionLinkRepository = mock()
        instanceRepository = mock()
        runtimeService = mock(defaultAnswer = RETURNS_DEEP_STUBS)
        query = mock()

        whenever(configurationRepository.findById(migrationId))
            .thenAnswer { Optional.of(ProcessMigrationConfiguration(migrationId, instructions.toList())) }
        whenever(instanceRepository.findByDocumentId(documentId)).thenReturn(
            BuildingBlockInstance(
                documentId = documentId,
                caseDocumentId = UUID.randomUUID(),
                processInstanceId = "pi-main",
                definition = BuildingBlockDefinition(id = target, name = target.key),
            )
        )
        whenever(runtimeService.createProcessInstanceQuery()).thenReturn(query)
        whenever(query.processDefinitionKey(any())).thenAnswer { invocation ->
            currentKey = invocation.getArgument(0)
            query
        }
        whenever(query.processInstanceBusinessKey(any())).thenReturn(query)
        whenever(query.list()).thenAnswer { listOfNotNull(running[currentKey]) }

        linkedProcesses(mainKey to mainNewId, calledKey to calledNewId)

        executor = BuildingBlockProcessMigrationComponentExecutor(
            configurationRepository,
            processDefinitionLinkRepository,
            instanceRepository,
            runtimeService,
            mock<ProcessMigrationVariableResolver>(),
        )
    }

    private var currentKey: String = ""

    @Test
    fun `should migrate a process the block owns but did not start itself`() {
        // The heart of G65: matched by business key, so a called process is reachable. Pinned to the block's own instance it was not, and nothing said so.
        givenRunning(calledKey, "pi-called", calledOldId)
        instructions += instruction(calledKey, calledKey)

        executor.execute(migrationId, target, documentId)

        verify(runtimeService).createMigrationPlan(calledOldId, calledNewId)
    }

    @Test
    fun `should migrate every process the plan names, not only the block's own`() {
        givenRunning(mainKey, "pi-main", mainOldId)
        givenRunning(calledKey, "pi-called", calledOldId)
        instructions += instruction(mainKey, mainKey)
        instructions += instruction(calledKey, calledKey)

        executor.execute(migrationId, target, documentId)

        verify(runtimeService).createMigrationPlan(mainOldId, mainNewId)
        verify(runtimeService).createMigrationPlan(calledOldId, calledNewId)
        assertThat(MigrationWarnings.drain()).isNull()
    }

    @Test
    fun `should warn when not one instruction matched a running process`() {
        // The D13 warning the case-side executor has and this one did not, which is what made the miss silent.
        instructions += instruction(calledKey, calledKey)

        executor.execute(migrationId, target, documentId)

        assertThat(MigrationWarnings.drain())
            .contains("No process was migrated for building block '$documentId'")
            .contains("'$calledKey'")
    }

    @Test
    fun `should stay quiet when one instruction matched and another did not`() {
        // Ordinary variation: whether a block is running its second process is not a defect.
        givenRunning(mainKey, "pi-main", mainOldId)
        instructions += instruction(mainKey, mainKey)
        instructions += instruction(calledKey, calledKey)

        executor.execute(migrationId, target, documentId)

        assertThat(MigrationWarnings.drain()).isNull()
    }

    @Test
    fun `should do nothing for a plan that is not a building block's`() {
        givenRunning(mainKey, "pi-main", mainOldId)
        instructions += instruction(mainKey, mainKey)

        executor.execute(migrationId, CaseDefinitionId("verhuizing", "1.0.8"), documentId)

        verify(runtimeService, never()).createMigrationPlan(any(), any())
        assertThat(MigrationWarnings.drain()).isNull()
    }

    @Test
    fun `should stay quiet for a block that never started a process`() {
        whenever(instanceRepository.findByDocumentId(documentId)).thenReturn(
            BuildingBlockInstance(
                documentId = documentId,
                caseDocumentId = UUID.randomUUID(),
                processInstanceId = null,
                definition = BuildingBlockDefinition(id = target, name = target.key),
            )
        )
        instructions += instruction(mainKey, mainKey)

        executor.execute(migrationId, target, documentId)

        verify(runtimeService, never()).createMigrationPlan(any(), any())
        assertThat(MigrationWarnings.drain()).isNull()
    }

    private fun instruction(sourceKey: String, targetKey: String) =
        ProcessMigrationInstruction(sourceProcessDefinitionKey = sourceKey, targetProcessDefinitionKey = targetKey)

    private fun givenRunning(processDefinitionKey: String, processInstanceId: String, processDefinitionId: String) {
        val instance = mock<ProcessInstance>()
        whenever(instance.processInstanceId).thenReturn(processInstanceId)
        whenever(instance.processDefinitionId).thenReturn(processDefinitionId)
        running[processDefinitionKey] = instance
    }

    private fun linkedProcesses(vararg keysToDefinitionIds: Pair<String, String>) {
        val links = keysToDefinitionIds.map { (key, definitionId) ->
            ProcessDefinitionBuildingBlockDefinition(
                ProcessDefinitionBuildingBlockDefinitionId(ProcessDefinitionId(definitionId), target)
            ).apply { processDefinitionKey = key }
        }
        whenever(processDefinitionLinkRepository.findAllByIdBuildingBlockDefinitionId(eq(target))).thenReturn(links)
    }
}
