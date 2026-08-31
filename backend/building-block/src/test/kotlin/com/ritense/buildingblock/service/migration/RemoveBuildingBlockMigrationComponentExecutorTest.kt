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
import com.ritense.buildingblock.domain.migration.RemoveBuildingBlockConfiguration
import com.ritense.buildingblock.domain.migration.RemoveBuildingBlockInstruction
import com.ritense.buildingblock.repository.RemoveBuildingBlockConfigurationRepository
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.case_.service.migration.MigrationDataPatchApplier
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinitionId
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.migration.ProcessMigrationVariableResolver
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationWarnings
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.assertj.core.api.Assertions.assertThatThrownBy
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
import org.springframework.jdbc.core.JdbcTemplate
import java.util.Optional
import java.util.UUID

/** The dissolve direction: which blocks an entry reaches and in what order (G25), plus the required version tag. The two running-process tests pin whether a hand-back happened, which nothing else covers. */
class RemoveBuildingBlockMigrationComponentExecutorTest {

    private lateinit var configurationRepository: RemoveBuildingBlockConfigurationRepository
    private lateinit var instanceService: BuildingBlockInstanceService
    private lateinit var ownershipResolver: BuildingBlockOwnershipResolver
    private lateinit var documentService: DocumentService
    private lateinit var dataPatchApplier: MigrationDataPatchApplier
    private lateinit var runtimeService: RuntimeService
    private lateinit var processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository
    private lateinit var executor: RemoveBuildingBlockMigrationComponentExecutor

    private val target = CaseDefinitionId("verhuizing", "1.0.8")
    private val migrationId = BlueprintMigrationId.from(target, "opruimen")
    private val caseDocumentId: UUID = UUID.randomUUID()

    /** Instance ids in the order they were deleted. */
    private val deleted = mutableListOf<UUID>()

    private val instructions = mutableListOf<RemoveBuildingBlockInstruction>()

    @BeforeEach
    fun setUp() {
        MigrationWarnings.clear()
        configurationRepository = mock()
        instanceService = mock()
        ownershipResolver = mock()
        documentService = mock()
        dataPatchApplier = mock()
        runtimeService = mock(defaultAnswer = RETURNS_DEEP_STUBS)
        processDefinitionCaseDefinitionRepository = mock()

        whenever(configurationRepository.findById(migrationId))
            .thenAnswer { Optional.of(RemoveBuildingBlockConfiguration(migrationId, instructions.toList())) }
        whenever(instanceService.delete(any())).thenAnswer { deleted += it.getArgument<UUID>(0); null }
        whenever(ownershipResolver.subtreeOf(any())).thenReturn(emptyList())

        executor = RemoveBuildingBlockMigrationComponentExecutor(
            configurationRepository,
            instanceService,
            ownershipResolver,
            processDefinitionCaseDefinitionRepository,
            mock(),
            documentService,
            runtimeService,
            mock<ProcessMigrationVariableResolver>(),
            mock<ProcessDocumentAssociationService>(defaultAnswer = RETURNS_DEEP_STUBS),
            dataPatchApplier,
            mock<JdbcTemplate>(),
        )
    }

    @Test
    fun `should dissolve a nested block an entry names, not only direct children`() {
        val parent = block("verhuizing-inspectie", "1.0.0")
        val child = block("inspectie-dossier", "1.0.0", parent = parent)
        givenSubtree(owned(child, parent, 1), owned(parent, null, 0))
        instructions += entry("inspectie-dossier", "1.0.0")

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(deleted).containsExactly(child.id)
    }

    @Test
    fun `should dissolve deepest first, across separate entries`() {
        val parent = block("verhuizing-inspectie", "1.0.0")
        val child = block("inspectie-dossier", "1.0.0", parent = parent)
        givenSubtree(owned(child, parent, 1), owned(parent, null, 0))
        // Parent named first: the order must come from the tree, not from the entry list.
        instructions += entry("verhuizing-inspectie", "1.0.0")
        instructions += entry("inspectie-dossier", "1.0.0")

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(deleted).containsExactly(child.id, parent.id)
    }

    /** G25: nothing cascades in the persistence layer, so a child goes with its parent and is reported — without an entry it has no `dataMigration` to hand its fields back with. */
    @Test
    fun `should dissolve a child no entry names along with the parent that is named`() {
        val parent = block("verhuizing-inspectie", "1.0.0")
        val child = block("inspectie-dossier", "1.0.0", parent = parent)
        givenSubtree(owned(child, parent, 1), owned(parent, null, 0))
        instructions += entry("verhuizing-inspectie", "1.0.0") // the child is named by nothing

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(deleted).containsExactly(child.id, parent.id)
        assertThat(MigrationWarnings.drain())
            .contains("inspectie-dossier:1.0.0")
            .contains("dissolved because the block above it was")
    }

    @Test
    fun `should leave a block alone when nothing above it is dissolved`() {
        val parent = block("verhuizing-inspectie", "1.0.0")
        val child = block("inspectie-dossier", "1.0.0", parent = parent)
        givenSubtree(owned(child, parent, 1), owned(parent, null, 0))
        instructions += entry("inspectie-dossier", "1.0.0") // only the child

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(deleted).containsExactly(child.id)
    }

    @Test
    fun `should hand a nested block's data back to its parent, not to the migrating case`() {
        val parent = block("verhuizing-inspectie", "1.0.0")
        val child = block("inspectie-dossier", "1.0.0", parent = parent)
        givenSubtree(owned(child, parent, 1))
        instructions += entry("inspectie-dossier", "1.0.0")

        executor.execute(migrationId, target, caseDocumentId)

        verify(dataPatchApplier).apply(any(), eq(child.documentId), eq(parent.documentId))
        verify(dataPatchApplier, never()).apply(any(), any(), eq(caseDocumentId))
    }

    @Test
    fun `should dissolve one version per entry when a fleet holds two`() {
        val onOldVersion = block("inspectie-dossier", "1.0.0")
        val onNewVersion = block("inspectie-dossier", "2.0.0")
        givenSubtree(owned(onOldVersion, null, 0), owned(onNewVersion, null, 0))
        // One entry per version: each carries the data and process mapping its own version needs.
        instructions += entry("inspectie-dossier", "1.0.0")
        instructions += entry("inspectie-dossier", "2.0.0")

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(deleted).containsExactly(onOldVersion.id, onNewVersion.id)
    }

    @Test
    fun `should fail the case when a block is on a version no entry names`() {
        // The version the plan was not told about would be stranded: alignment would never find a candidate for it again (G24).
        val named = block("inspectie-dossier", "1.0.0")
        val unnamed = block("inspectie-dossier", "2.0.0")
        givenSubtree(owned(named, null, 0), owned(unnamed, null, 0))
        instructions += entry("inspectie-dossier", "1.0.0")

        assertThatThrownBy { executor.execute(migrationId, target, caseDocumentId) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("dissolves 'inspectie-dossier:1.0.0'")
            .hasMessageContaining("is on 'inspectie-dossier:2.0.0', which no removeBuildingBlock entry names")

        // Refused before anything was dissolved, including the block the plan did name.
        assertThat(deleted).isEmpty()
        verify(documentService, never()).deleteDocument(any())
    }

    @Test
    fun `should not call an unnamed version stranded when it goes with the block above it`() {
        // Only a block that survives the run can be stranded; this one goes with its parent and is warned about there.
        val parent = block("verhuizing-inspectie", "1.0.0")
        val childOnAnotherVersion = block("verhuizing-inspectie", "2.0.0", parent = parent)
        givenSubtree(owned(childOnAnotherVersion, parent, 1), owned(parent, null, 0))
        instructions += entry("verhuizing-inspectie", "1.0.0")

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(deleted).containsExactly(childOnAnotherVersion.id, parent.id)
    }

    @Test
    fun `should refuse an entry that names no version instead of dissolving on the key`() {
        // Only reachable from a row stored before the version was required (G29). Dissolving whatever is there is what it may not do.
        val onOldVersion = block("inspectie-dossier", "1.0.0")
        givenSubtree(owned(onOldVersion, null, 0))
        instructions += RemoveBuildingBlockInstruction(buildingBlockKey = "inspectie-dossier")

        assertThatThrownBy { executor.execute(migrationId, target, caseDocumentId) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("naming no building block version ('inspectie-dossier')")
            .hasMessageContaining("Open the plan and save it again")

        assertThat(deleted).isEmpty()
        verify(documentService, never()).deleteDocument(any())
    }

    @Test
    fun `should warn when an entry dissolved nothing`() {
        // Legitimate: this case may never have had the block. But it must not read like a plan that worked.
        givenSubtree(owned(block("verhuizing-inspectie", "1.0.0"), null, 0))
        instructions += entry("verhuizing-inspectie", "1.0.0")
        instructions += entry("inspectie-dossier", "1.0.0")

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(MigrationWarnings.drain())
            .contains("'removeBuildingBlock' entry for 'inspectie-dossier:1.0.0'")
            .contains("dissolved nothing")
            .doesNotContain("verhuizing-inspectie")
    }

    @Test
    fun `should refuse readably when the block's process is still running and was not handed back`() {
        // Verified live: without this Operaton fails with "cannot delete historic process instance ... getEndTime() is null".
        val block = block("inspectie-dossier", "1.0.0", processInstanceId = "still-running")
        givenSubtree(owned(block, null, 0))
        givenStillRunning("still-running")
        instructions += entry("inspectie-dossier", "1.0.0")

        assertThatThrownBy { executor.execute(migrationId, target, caseDocumentId) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("its process 'still-running' is still running and was not handed back")
            .hasMessageContaining("The entry's processMigration named none")

        assertThat(deleted).isEmpty()
        verify(documentService, never()).deleteDocument(any())
    }

    @Test
    fun `should dissolve a block whose still-running process the entry handed back`() {
        // A hand-back leaves the token where it is, so "still running" describes one that worked as well as one that never happened. Found on the verhuizing 1.0.8 fixture.
        val processInstanceId = UUID.randomUUID().toString()
        val block = block("case-notification", "1.0.0", processInstanceId = processInstanceId)
        givenSubtree(owned(block, null, 0))
        givenHandedBack(processInstanceId, sourceProcessKey = "case-notification-process", targetProcessKey = "verhuizing")
        instructions += RemoveBuildingBlockInstruction(
            buildingBlockKey = "case-notification",
            buildingBlockVersionTag = "1.0.0",
            processMigration = listOf(
                ProcessMigrationInstruction(
                    sourceProcessDefinitionKey = "case-notification-process",
                    targetProcessDefinitionKey = "verhuizing",
                )
            ),
        )

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(deleted).containsExactly(block.id)
        verify(documentService).deleteDocument(any())
    }

    @Test
    fun `should dissolve a block whose process has already finished without a processMigration`() {
        // The same entry shape is legitimate here: nothing is running, so nothing needs handing back.
        val block = block("inspectie-dossier", "1.0.0", processInstanceId = "finished")
        givenSubtree(owned(block, null, 0))
        givenNotRunning("finished")
        instructions += entry("inspectie-dossier", "1.0.0")

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(deleted).containsExactly(block.id)
    }

    @Test
    fun `should dissolve every level of a recursive block from one entry, deepest first`() {
        // A self-calling process gives a chain of instances on one definition id; one entry names them all, and the walk orders them (G25).
        val level1 = block("herhaling", "1.0.0")
        val level2 = block("herhaling", "1.0.0", parent = level1)
        val level3 = block("herhaling", "1.0.0", parent = level2)
        givenSubtree(owned(level3, level2, 2), owned(level2, level1, 1), owned(level1, null, 0))
        instructions += RemoveBuildingBlockInstruction(
            buildingBlockKey = "herhaling",
            buildingBlockVersionTag = "1.0.0",
        )

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(deleted).containsExactly(level3.id, level2.id, level1.id)
        // Each level hands its state back to the level above, not to the case.
        verify(dataPatchApplier).apply(any(), eq(level3.documentId), eq(level2.documentId))
        verify(dataPatchApplier).apply(any(), eq(level2.documentId), eq(level1.documentId))
        verify(dataPatchApplier).apply(any(), eq(level1.documentId), eq(caseDocumentId))
    }

    @Test
    fun `should do nothing when the plan has no removeBuildingBlock section`() {
        whenever(configurationRepository.findById(migrationId)).thenReturn(Optional.empty())

        executor.execute(migrationId, target, caseDocumentId)

        assertThat(deleted).isEmpty()
        verify(ownershipResolver, never()).subtreeOf(any())
    }

    private fun entry(key: String, versionTag: String) = RemoveBuildingBlockInstruction(
        buildingBlockKey = key,
        buildingBlockVersionTag = versionTag,
    )

    private fun givenSubtree(vararg owned: BuildingBlockOwnershipResolver.OwnedBuildingBlock) {
        whenever(ownershipResolver.subtreeOf(caseDocumentId)).thenReturn(owned.toList())
    }

    private fun owned(
        instance: BuildingBlockInstance,
        parent: BuildingBlockInstance?,
        depth: Int,
    ) = BuildingBlockOwnershipResolver.OwnedBuildingBlock(instance, parent, depth)

    private fun givenStillRunning(processInstanceId: String) = stubRunningQuery(processInstanceId, running = true)

    /** The entry's `processMigration` matches, so the hand-back goes through — leaving the process running, on the owner's definition. */
    private fun givenHandedBack(processInstanceId: String, sourceProcessKey: String, targetProcessKey: String) {
        val query = mock<ProcessInstanceQuery>()
        whenever(runtimeService.createProcessInstanceQuery()).thenReturn(query)
        whenever(query.processInstanceId(processInstanceId)).thenReturn(query)
        whenever(query.processDefinitionKey(sourceProcessKey)).thenReturn(query)
        val processInstance = mock<ProcessInstance>()
        whenever(processInstance.processInstanceId).thenReturn(processInstanceId)
        whenever(processInstance.processDefinitionId).thenReturn("$sourceProcessKey:1:src")
        whenever(query.list()).thenReturn(listOf(processInstance))
        whenever(query.singleResult()).thenReturn(processInstance)

        whenever(processDefinitionCaseDefinitionRepository.findByIdCaseDefinitionId(target)).thenReturn(
            listOf(
                ProcessDefinitionCaseDefinition(
                    ProcessDefinitionCaseDefinitionId(ProcessDefinitionId("$targetProcessKey:1:tgt"), target)
                ).apply { processDefinitionKey = targetProcessKey }
            )
        )
    }

    private fun givenNotRunning(processInstanceId: String) = stubRunningQuery(processInstanceId, running = false)

    private fun stubRunningQuery(processInstanceId: String, running: Boolean) {
        val query = mock<ProcessInstanceQuery>()
        whenever(runtimeService.createProcessInstanceQuery()).thenReturn(query)
        whenever(query.processInstanceId(processInstanceId)).thenReturn(query)
        whenever(query.processDefinitionKey(any())).thenReturn(query)
        whenever(query.list()).thenReturn(emptyList())
        whenever(query.singleResult()).thenReturn(if (running) mock<ProcessInstance>() else null)
    }

    private fun block(
        key: String,
        versionTag: String,
        parent: BuildingBlockInstance? = null,
        processInstanceId: String? = null,
    ) = BuildingBlockInstance(
        documentId = UUID.randomUUID(),
        caseDocumentId = caseDocumentId,
        definition = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId.of(key, versionTag),
            name = key,
        ),
        parentBuildingBlockInstanceId = parent?.id,
    ).also { it.processInstanceId = processInstanceId }
}
