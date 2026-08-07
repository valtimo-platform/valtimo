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
import com.ritense.case_.domain.migration.CaseDefinitionMigration
import com.ritense.case_.domain.migration.CaseMigrationCase
import com.ritense.case_.repository.CaseDefinitionMigrationRepository
import com.ritense.case_.repository.CaseMigrationCaseRepository
import com.ritense.case_.service.migration.MigrationPlanApplier
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.semver4j.Semver
import org.springframework.beans.factory.ObjectProvider
import java.util.UUID

class BuildingBlockVersionAlignmentExecutorTest {

    private lateinit var ownershipResolver: BuildingBlockOwnershipResolver
    private lateinit var linkedVersionResolver: LinkedBuildingBlockVersionResolver
    private lateinit var pathResolver: BuildingBlockMigrationPathResolver
    private lateinit var processVersionChecker: BuildingBlockProcessVersionChecker
    private lateinit var migrationRepository: CaseDefinitionMigrationRepository
    private lateinit var caseMigrationCaseRepository: CaseMigrationCaseRepository
    private lateinit var planApplier: MigrationPlanApplier
    private lateinit var executor: BuildingBlockVersionAlignmentExecutor

    private val caseDefinitionId = CaseDefinitionId("verhuizing", "1.0.2")
    private val casePlanId = BlueprintMigrationId.from(caseDefinitionId, "verhuizing-gegevens")
    private val caseDocumentId = UUID.randomUUID()
    private val blockDocumentId = UUID.randomUUID()
    private val bbKey = "verhuizing-inspectie"

    @BeforeEach
    fun setUp() {
        ownershipResolver = mock()
        linkedVersionResolver = mock()
        pathResolver = mock()
        processVersionChecker = mock()
        migrationRepository = mock()
        caseMigrationCaseRepository = mock()
        planApplier = mock()

        val applierProvider = mock<ObjectProvider<MigrationPlanApplier>>()
        whenever(applierProvider.getObject()).thenReturn(planApplier)

        executor = BuildingBlockVersionAlignmentExecutor(
            ownershipResolver,
            linkedVersionResolver,
            pathResolver,
            processVersionChecker,
            migrationRepository,
            caseMigrationCaseRepository,
            applierProvider,
        )

        // By default nothing owns anything and no version carries a plan.
        whenever(ownershipResolver.directChildrenOf(any())).thenReturn(emptyList())
        whenever(migrationRepository.findAllByIdBlueprintTypeAndIdKeyAndIdVersionTag(any(), any(), any()))
            .thenReturn(emptyList())
    }

    @Test
    fun `should apply the plan of each version on the way to the linked version`() {
        val block = block("1.0.0")
        caseOwns(block)
        linked(block, "1.0.2")
        whenever(pathResolver.resolvePath(bbKey, Semver("1.0.0"), Semver("1.0.2")))
            .thenReturn(listOf(Semver("1.0.1"), Semver("1.0.2")))
        val plan101 = bbPlan("1.0.1", "herinspectie")
        val plan102 = bbPlan("1.0.2", "afronding")

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        verify(planApplier).apply(plan101.id, BuildingBlockDefinitionId.of(bbKey, "1.0.1"), blockDocumentId)
        verify(planApplier).apply(plan102.id, BuildingBlockDefinitionId.of(bbKey, "1.0.2"), blockDocumentId)
    }

    @Test
    fun `should record each applied plan against the instance it was applied to`() {
        val block = block("1.0.0")
        caseOwns(block)
        linked(block, "1.0.1")
        whenever(pathResolver.resolvePath(bbKey, Semver("1.0.0"), Semver("1.0.1")))
            .thenReturn(listOf(Semver("1.0.1")))
        val plan = bbPlan("1.0.1", "herinspectie")

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        val captor = argumentCaptor<CaseMigrationCase>()
        verify(caseMigrationCaseRepository).save(captor.capture())
        assertThat(captor.firstValue.id.migrationId).isEqualTo(plan.id)
        assertThat(captor.firstValue.id.caseId).isEqualTo(blockDocumentId.toString())
    }

    @Test
    fun `should fail the migration when a version in the chain has no plan deployed`() {
        val block = block("1.0.0")
        caseOwns(block)
        linked(block, "1.0.1")
        whenever(pathResolver.resolvePath(bbKey, Semver("1.0.0"), Semver("1.0.1")))
            .thenReturn(listOf(Semver("1.0.1")))

        assertThatThrownBy { executor.execute(casePlanId, caseDefinitionId, caseDocumentId) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("No migration plan is deployed")
            .hasMessageContaining("1.0.1")
        verify(planApplier, never()).apply(any(), any(), any())
    }

    @Test
    fun `should fail on the plan-less version of a chain without applying the versions after it`() {
        val block = block("1.0.0")
        caseOwns(block)
        linked(block, "1.0.2")
        whenever(pathResolver.resolvePath(bbKey, Semver("1.0.0"), Semver("1.0.2")))
            .thenReturn(listOf(Semver("1.0.1"), Semver("1.0.2")))
        val plan102 = bbPlan("1.0.2", "afronding") // 1.0.1 has none

        assertThatThrownBy { executor.execute(casePlanId, caseDefinitionId, caseDocumentId) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("1.0.1")
        verify(planApplier, never()).apply(eq(plan102.id), any(), any())
    }

    @Test
    fun `should hold every applied step to having moved the process onto that version`() {
        val block = block("1.0.0")
        caseOwns(block)
        linked(block, "1.0.2")
        whenever(pathResolver.resolvePath(bbKey, Semver("1.0.0"), Semver("1.0.2")))
            .thenReturn(listOf(Semver("1.0.1"), Semver("1.0.2")))
        bbPlan("1.0.1", "herinspectie")
        bbPlan("1.0.2", "afronding")

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        verify(processVersionChecker).assertProcessOnVersion(blockDocumentId, BuildingBlockDefinitionId.of(bbKey, "1.0.1"))
        verify(processVersionChecker).assertProcessOnVersion(blockDocumentId, BuildingBlockDefinitionId.of(bbKey, "1.0.2"))
    }

    @Test
    fun `should fail the migration when a plan left the process on the version it came from`() {
        val block = block("1.0.0")
        caseOwns(block)
        linked(block, "1.0.1")
        whenever(pathResolver.resolvePath(bbKey, Semver("1.0.0"), Semver("1.0.1")))
            .thenReturn(listOf(Semver("1.0.1")))
        bbPlan("1.0.1", "herinspectie")
        whenever(
            processVersionChecker.assertProcessOnVersion(
                blockDocumentId, BuildingBlockDefinitionId.of(bbKey, "1.0.1")
            )
        ).thenThrow(IllegalStateException("its process is still running the old definition"))

        assertThatThrownBy { executor.execute(casePlanId, caseDefinitionId, caseDocumentId) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("its process is still running the old definition")
    }

    @Test
    fun `should leave a block alone when the target case version links the same version it is on`() {
        val block = block("1.0.1")
        caseOwns(block)
        linked(block, "1.0.1")

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        verifyNothingMigrated()
    }

    @Test
    fun `should leave a block alone when the target case version no longer links it`() {
        val block = block("1.0.1")
        caseOwns(block)
        whenever(linkedVersionResolver.resolveTargetVersion(caseDefinitionId, block)).thenReturn(null)

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        verifyNothingMigrated()
    }

    @Test
    fun `should never downgrade a block whose linked version is older than the one it is on`() {
        val block = block("2.0.0")
        caseOwns(block)
        linked(block, "1.0.1")

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        verifyNothingMigrated()
    }

    @Test
    fun `should fail the migration when a block has no upgrade path`() {
        val block = block("1.0.0")
        caseOwns(block)
        linked(block, "3.0.0")
        whenever(pathResolver.resolvePath(bbKey, Semver("1.0.0"), Semver("3.0.0")))
            .thenThrow(IllegalStateException("no upgrade path"))

        assertThatThrownBy { executor.execute(casePlanId, caseDefinitionId, caseDocumentId) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("no upgrade path")
    }

    @Test
    fun `should align the nested blocks of a building block owner`() {
        // A building block plan is being applied to the parent block; its own child must follow.
        val parent = block("2.0.0")
        val childDocumentId = UUID.randomUUID()
        val child = BuildingBlockInstance(
            documentId = childDocumentId,
            caseDocumentId = caseDocumentId,
            parentBuildingBlockInstanceId = parent.id,
            definition = BuildingBlockDefinition(
                id = BuildingBlockDefinitionId.of("photo-upload", "1.0.0"),
                name = "photo-upload",
            ),
        )
        val parentTarget = BuildingBlockDefinitionId.of(bbKey, "2.0.0")
        whenever(ownershipResolver.directChildrenOf(blockDocumentId)).thenReturn(listOf(child))
        whenever(linkedVersionResolver.resolveTargetVersion(parentTarget, child)).thenReturn(Semver("1.0.1"))
        whenever(pathResolver.resolvePath("photo-upload", Semver("1.0.0"), Semver("1.0.1")))
            .thenReturn(listOf(Semver("1.0.1")))
        val childTarget = BuildingBlockDefinitionId.of("photo-upload", "1.0.1")
        val childPlan = CaseDefinitionMigration(BlueprintMigrationId.from(childTarget, "photo-controle"))
        whenever(
            migrationRepository.findAllByIdBlueprintTypeAndIdKeyAndIdVersionTag(
                BlueprintType.BUILDING_BLOCK, "photo-upload", Semver("1.0.1")
            )
        ).thenReturn(listOf(childPlan))

        executor.execute(BlueprintMigrationId.from(parentTarget, "plan"), parentTarget, blockDocumentId)

        verify(planApplier).apply(childPlan.id, childTarget, childDocumentId)
        verify(processVersionChecker).assertProcessOnVersion(childDocumentId, childTarget)
    }

    @Test
    fun `should apply every plan on a version in key order when there is more than one`() {
        val block = block("1.0.0")
        caseOwns(block)
        linked(block, "1.0.1")
        whenever(pathResolver.resolvePath(bbKey, Semver("1.0.0"), Semver("1.0.1")))
            .thenReturn(listOf(Semver("1.0.1")))
        val stepTarget = BuildingBlockDefinitionId.of(bbKey, "1.0.1")
        val zebra = CaseDefinitionMigration(BlueprintMigrationId.from(stepTarget, "zebra"))
        val alpha = CaseDefinitionMigration(BlueprintMigrationId.from(stepTarget, "alpha"))
        whenever(
            migrationRepository.findAllByIdBlueprintTypeAndIdKeyAndIdVersionTag(
                BlueprintType.BUILDING_BLOCK, bbKey, Semver("1.0.1")
            )
        ).thenReturn(listOf(zebra, alpha))

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        val applied = argumentCaptorOfAppliedKeys()
        assertThat(applied).containsExactly("alpha", "zebra")
    }

    private fun argumentCaptorOfAppliedKeys(): List<String> {
        val captor = argumentCaptor<BlueprintMigrationId>()
        verify(planApplier, times(2)).apply(captor.capture(), any(), eq(blockDocumentId))
        return captor.allValues.map { it.migrationKey }
    }

    private fun verifyNothingMigrated() {
        verify(planApplier, never()).apply(any(), any(), any())
        verify(processVersionChecker, never()).assertProcessOnVersion(any(), any())
    }

    private fun block(versionTag: String) = BuildingBlockInstance(
        documentId = blockDocumentId,
        caseDocumentId = caseDocumentId,
        definition = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId.of(bbKey, versionTag),
            name = bbKey,
        ),
    )

    private fun caseOwns(block: BuildingBlockInstance) {
        whenever(ownershipResolver.directChildrenOf(caseDocumentId)).thenReturn(listOf(block))
    }

    private fun linked(block: BuildingBlockInstance, versionTag: String) {
        whenever(linkedVersionResolver.resolveTargetVersion(caseDefinitionId, block))
            .thenReturn(Semver(versionTag))
    }

    private fun bbPlan(versionTag: String, migrationKey: String): CaseDefinitionMigration {
        val stepTarget = BuildingBlockDefinitionId.of(bbKey, versionTag)
        val plan = CaseDefinitionMigration(BlueprintMigrationId.from(stepTarget, migrationKey))
        whenever(
            migrationRepository.findAllByIdBlueprintTypeAndIdKeyAndIdVersionTag(
                BlueprintType.BUILDING_BLOCK, bbKey, Semver(versionTag)
            )
        ).thenReturn(listOf(plan))
        return plan
    }
}
