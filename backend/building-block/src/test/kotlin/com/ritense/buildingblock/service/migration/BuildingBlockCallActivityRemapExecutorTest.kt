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

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.processdocument.migration.ProcessDefinitionBlueprintResolver
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.migration.domain.ProcessMigrationConfiguration
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import com.ritense.valtimo.migration.repository.ProcessMigrationConfigurationRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.ProcessDefinition
import org.operaton.bpm.engine.repository.ProcessDefinitionQuery
import java.util.Optional
import java.util.UUID

class BuildingBlockCallActivityRemapExecutorTest {

    private lateinit var configurationRepository: ProcessMigrationConfigurationRepository
    private lateinit var ownershipResolver: BuildingBlockOwnershipResolver
    private lateinit var instanceRepository: BuildingBlockInstanceRepository
    private lateinit var blueprintResolver: ProcessDefinitionBlueprintResolver
    private lateinit var repositoryService: RepositoryService
    private lateinit var executor: BuildingBlockCallActivityRemapExecutor

    private val caseDefinitionId = CaseDefinitionId("verhuizing", "1.0.2")
    private val migrationId = BlueprintMigrationId.from(caseDefinitionId, "verhuizing-gegevens")
    private val caseDocumentId = UUID.randomUUID()

    private val oldProcessDefinitionId = "verhuizing:1:old"
    private val newProcessDefinitionId = "verhuizing:2:new"

    @BeforeEach
    fun setUp() {
        configurationRepository = mock()
        ownershipResolver = mock()
        instanceRepository = mock()
        blueprintResolver = mock()
        repositoryService = mock()
        executor = BuildingBlockCallActivityRemapExecutor(
            configurationRepository,
            ownershipResolver,
            instanceRepository,
            listOf(blueprintResolver),
            repositoryService,
        )

        whenever(blueprintResolver.supports(BlueprintType.CASE)).thenReturn(true)
        whenever(blueprintResolver.resolveProcessDefinitions(caseDefinitionId))
            .thenReturn(mapOf("verhuizing" to newProcessDefinitionId))
        // The block's recorded caller still names the pre-migration deployment of `verhuizing`. Asked with a
        // query, so an id nothing is deployed under answers null rather than throwing (findProcessDefinitionOrNull).
        val processDefinition = mock<ProcessDefinition>()
        whenever(processDefinition.key).thenReturn("verhuizing")
        val query = mock<ProcessDefinitionQuery>()
        whenever(query.singleResult()).thenReturn(processDefinition)
        val processDefinitionQuery = mock<ProcessDefinitionQuery>(defaultAnswer = Mockito.RETURNS_SELF)
        whenever(processDefinitionQuery.processDefinitionId(oldProcessDefinitionId)).thenReturn(query)
        whenever(repositoryService.createProcessDefinitionQuery()).thenReturn(processDefinitionQuery)
    }

    @Test
    fun `should repoint the caller definition and rename the activity that was remapped`() {
        instructions(ProcessMigrationInstruction("verhuizing", "verhuizing", mapOf("inspectie" to "inspectie_v2")))
        val block = block(activityId = "inspectie", callerProcessDefinitionId = oldProcessDefinitionId)
        caseOwns(block)

        executor.execute(migrationId, caseDefinitionId, caseDocumentId)

        assertThat(block.callerProcessDefinitionId).isEqualTo(newProcessDefinitionId)
        assertThat(block.activityId).isEqualTo("inspectie_v2")
        verify(instanceRepository).save(block)
    }

    @Test
    fun `should repoint the caller definition and keep an activity that was not remapped`() {
        instructions(ProcessMigrationInstruction("verhuizing", "verhuizing", mapOf("iets_anders" to "iets_anders_v2")))
        val block = block(activityId = "inspectie", callerProcessDefinitionId = oldProcessDefinitionId)
        caseOwns(block)

        executor.execute(migrationId, caseDefinitionId, caseDocumentId)

        assertThat(block.callerProcessDefinitionId).isEqualTo(newProcessDefinitionId)
        assertThat(block.activityId).isEqualTo("inspectie")
    }

    @Test
    fun `should follow a call activity that moved to a different process`() {
        instructions(ProcessMigrationInstruction("verhuizing", "verhuizing-v2", mapOf("inspectie" to "inspectie_v2")))
        whenever(blueprintResolver.resolveProcessDefinitions(caseDefinitionId))
            .thenReturn(mapOf("verhuizing-v2" to "verhuizing-v2:1:xyz"))
        val block = block(activityId = "inspectie", callerProcessDefinitionId = oldProcessDefinitionId)
        caseOwns(block)

        executor.execute(migrationId, caseDefinitionId, caseDocumentId)

        assertThat(block.callerProcessDefinitionId).isEqualTo("verhuizing-v2:1:xyz")
        assertThat(block.activityId).isEqualTo("inspectie_v2")
    }

    @Test
    fun `should leave a block alone when its calling process was not migrated by this plan`() {
        instructions(ProcessMigrationInstruction("een-ander-proces", "een-ander-proces"))
        val block = block(activityId = "inspectie", callerProcessDefinitionId = oldProcessDefinitionId)
        caseOwns(block)

        executor.execute(migrationId, caseDefinitionId, caseDocumentId)

        assertThat(block.callerProcessDefinitionId).isEqualTo(oldProcessDefinitionId)
        assertThat(block.activityId).isEqualTo("inspectie")
        verify(instanceRepository, never()).save(any())
    }

    @Test
    fun `should leave a block that was not started from a call activity alone`() {
        instructions(ProcessMigrationInstruction("verhuizing", "verhuizing", mapOf("inspectie" to "inspectie_v2")))
        caseOwns(block(activityId = null, callerProcessDefinitionId = null))

        executor.execute(migrationId, caseDefinitionId, caseDocumentId)

        verify(instanceRepository, never()).save(any())
    }

    @Test
    fun `should do nothing when the plan has no process migration`() {
        whenever(configurationRepository.findById(migrationId)).thenReturn(Optional.empty())

        executor.execute(migrationId, caseDefinitionId, caseDocumentId)

        verify(instanceRepository, never()).save(any())
    }

    @Test
    fun `should fail when the target process definition the call activity moved to does not exist`() {
        instructions(ProcessMigrationInstruction("verhuizing", "verdwenen-proces"))
        caseOwns(block(activityId = "inspectie", callerProcessDefinitionId = oldProcessDefinitionId))

        assertThatThrownBy { executor.execute(migrationId, caseDefinitionId, caseDocumentId) }
            .isInstanceOf(NoSuchElementException::class.java)
            .hasMessageContaining("verdwenen-proces")
    }

    private fun instructions(vararg instructions: ProcessMigrationInstruction) {
        whenever(configurationRepository.findById(migrationId)).thenReturn(
            Optional.of(ProcessMigrationConfiguration(migrationId, instructions.toList()))
        )
    }

    private fun caseOwns(block: BuildingBlockInstance) {
        whenever(ownershipResolver.directChildrenOf(caseDocumentId)).thenReturn(listOf(block))
    }

    private fun block(activityId: String?, callerProcessDefinitionId: String?) = BuildingBlockInstance(
        documentId = UUID.randomUUID(),
        caseDocumentId = caseDocumentId,
        activityId = activityId,
        callerProcessDefinitionId = callerProcessDefinitionId,
        definition = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId.of("verhuizing-inspectie", "1.0.0"),
            name = "verhuizing-inspectie",
        ),
    )
}
