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
import com.ritense.buildingblock.service.migration.BuildingBlockMigrationPathResolver.MigrationStep
import com.ritense.case_.domain.migration.CaseMigrationCase
import com.ritense.case_.repository.CaseMigrationCaseRepository
import com.ritense.case_.service.migration.MigrationPlanApplier
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationWarnings
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.inOrder
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.ObjectProvider
import java.util.UUID

class BuildingBlockVersionAlignmentExecutorTest {

    private lateinit var ownershipResolver: BuildingBlockOwnershipResolver
    private lateinit var linkedVersionResolver: LinkedBuildingBlockVersionResolver
    private lateinit var pathResolver: BuildingBlockMigrationPathResolver
    private lateinit var processVersionChecker: BuildingBlockProcessVersionChecker
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
        caseMigrationCaseRepository = mock()
        planApplier = mock()

        val applierProvider = mock<ObjectProvider<MigrationPlanApplier>>()
        whenever(applierProvider.getObject()).thenReturn(planApplier)

        executor = BuildingBlockVersionAlignmentExecutor(
            ownershipResolver,
            linkedVersionResolver,
            pathResolver,
            processVersionChecker,
            caseMigrationCaseRepository,
            applierProvider,
        )

        // By default nothing owns anything.
        whenever(ownershipResolver.directChildrenOf(any())).thenReturn(emptyList())
        // ...and by default the owner's own version is what governs its blocks. The redirection to a
        // declaring blueprint is the exception (G33) and is set up per test.
        whenever(linkedVersionResolver.resolveGoverningBlueprint(any(), any())).thenAnswer { it.getArgument(0) }
    }

    @Test
    fun `should apply every plan on the way to the linked version, in order`() {
        val block = block("1.0.0")
        caseOwns(block)
        linked(block, bb("1.0.2"))
        val first = step("herinspectie", bb("1.0.1"))
        val second = step("afronding", bb("1.0.2"))
        whenever(pathResolver.resolvePath(bb("1.0.0"), bb("1.0.2"))).thenReturn(listOf(first, second))

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        inOrder(planApplier) {
            verify(planApplier).apply(first.planId, bb("1.0.1"), blockDocumentId)
            verify(planApplier).apply(second.planId, bb("1.0.2"), blockDocumentId)
        }
    }

    @Test
    fun `should apply one plan that declares the whole jump, without visiting the versions in between`() {
        val block = block("1.0.0")
        caseOwns(block)
        linked(block, bb("1.0.2"))
        val jump = step("versiesprong", bb("1.0.2"))
        whenever(pathResolver.resolvePath(bb("1.0.0"), bb("1.0.2"))).thenReturn(listOf(jump))

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        verify(planApplier).apply(jump.planId, bb("1.0.2"), blockDocumentId)
        verify(processVersionChecker).assertProcessOnVersion(blockDocumentId, bb("1.0.2"))
        // 1.0.1 is skipped entirely: the plan says it is not a stop on this instance's way.
        verify(planApplier, never()).apply(any(), eq(bb("1.0.1")), any())
        verify(processVersionChecker, never()).assertProcessOnVersion(any(), eq(bb("1.0.1")))
    }

    @Test
    fun `should migrate a block onto a different building block key when that is what the owner links`() {
        val block = block("1.0.1")
        caseOwns(block)
        val dossier = BuildingBlockDefinitionId.of("inspectie-dossier", "1.0.0")
        linked(block, dossier)
        val crossKey = step("dossier-uit-fotos", dossier)
        whenever(pathResolver.resolvePath(bb("1.0.1"), dossier)).thenReturn(listOf(crossKey))

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        verify(planApplier).apply(crossKey.planId, dossier, blockDocumentId)
        verify(processVersionChecker).assertProcessOnVersion(blockDocumentId, dossier)
        // And the block's own children are re-checked against the version it landed on, not the old key.
        verify(ownershipResolver).directChildrenOf(blockDocumentId)
    }

    @Test
    fun `should record each applied plan against the instance it was applied to`() {
        val block = block("1.0.0")
        caseOwns(block)
        linked(block, bb("1.0.1"))
        val only = step("herinspectie", bb("1.0.1"))
        whenever(pathResolver.resolvePath(bb("1.0.0"), bb("1.0.1"))).thenReturn(listOf(only))

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        val captor = argumentCaptor<CaseMigrationCase>()
        verify(caseMigrationCaseRepository).save(captor.capture())
        assertThat(captor.firstValue.id.migrationId).isEqualTo(only.planId)
        assertThat(captor.firstValue.id.caseId).isEqualTo(blockDocumentId.toString())
    }

    @Test
    fun `should hold every applied step to having moved the process onto that version`() {
        val block = block("1.0.0")
        caseOwns(block)
        linked(block, bb("1.0.2"))
        whenever(pathResolver.resolvePath(bb("1.0.0"), bb("1.0.2")))
            .thenReturn(listOf(step("herinspectie", bb("1.0.1")), step("afronding", bb("1.0.2"))))

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        verify(processVersionChecker).assertProcessOnVersion(blockDocumentId, bb("1.0.1"))
        verify(processVersionChecker).assertProcessOnVersion(blockDocumentId, bb("1.0.2"))
    }

    @Test
    fun `should fail the migration when a plan left the process on the version it came from`() {
        val block = block("1.0.0")
        caseOwns(block)
        linked(block, bb("1.0.1"))
        whenever(pathResolver.resolvePath(bb("1.0.0"), bb("1.0.1")))
            .thenReturn(listOf(step("herinspectie", bb("1.0.1"))))
        whenever(processVersionChecker.assertProcessOnVersion(blockDocumentId, bb("1.0.1")))
            .thenThrow(IllegalStateException("its process is still running the old definition"))

        assertThatThrownBy { executor.execute(casePlanId, caseDefinitionId, caseDocumentId) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("its process is still running the old definition")
    }

    @Test
    fun `should leave a block alone when the target case version links the same version it is on`() {
        val block = block("1.0.1")
        caseOwns(block)
        linked(block, bb("1.0.1"))

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        verifyNothingMigrated()
    }

    @Test
    fun `should leave a block alone when the target case version no longer links it`() {
        val block = block("1.0.1")
        caseOwns(block)
        whenever(linkedVersionResolver.resolveTarget(caseDefinitionId, block)).thenReturn(null)

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        verifyNothingMigrated()
    }

    /**
     * G24: leaving it alone is right — dissolving deletes a document, so it is never inferred — but the
     * block keeps running under a version that does not declare it, and its call activity throws whenever
     * it next ends. This warning is the one moment an author can still act on that.
     */
    @Test
    fun `should warn about a block the target case version no longer links`() {
        val block = block("1.0.1")
        caseOwns(block)
        whenever(linkedVersionResolver.resolveTarget(caseDefinitionId, block)).thenReturn(null)

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        assertThat(MigrationWarnings.drain())
            .contains("is still running under")
            .contains("no longer links it")
            .contains("'removeBuildingBlock'")
    }

    @Test
    fun `should never downgrade a block whose linked version is older than the one it is on`() {
        val block = block("2.0.0")
        caseOwns(block)
        linked(block, bb("1.0.1"))

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        verifyNothingMigrated()
    }

    @Test
    fun `should not treat a lower version of another building block key as a downgrade`() {
        // Versions of different building blocks are not comparable, so the plans decide — not the
        // numbers. 1.0.0 of another block is a perfectly good destination for 2.0.0 of this one.
        val block = block("2.0.0")
        caseOwns(block)
        val dossier = BuildingBlockDefinitionId.of("inspectie-dossier", "1.0.0")
        linked(block, dossier)
        val crossKey = step("dossier-uit-fotos", dossier)
        whenever(pathResolver.resolvePath(bb("2.0.0"), dossier)).thenReturn(listOf(crossKey))

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        verify(planApplier).apply(crossKey.planId, dossier, blockDocumentId)
    }

    @Test
    fun `should fail the migration when no chain of plans reaches the linked version`() {
        val block = block("1.0.0")
        caseOwns(block)
        linked(block, bb("3.0.0"))
        whenever(pathResolver.resolvePath(bb("1.0.0"), bb("3.0.0")))
            .thenThrow(IllegalStateException("No migration plan connects building block version"))

        assertThatThrownBy { executor.execute(casePlanId, caseDefinitionId, caseDocumentId) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("No migration plan connects building block version")
        verify(planApplier, never()).apply(any(), any(), any())
    }

    @Test
    fun `should fail the migration when more than one chain of plans reaches the linked version`() {
        val block = block("1.0.0")
        caseOwns(block)
        linked(block, bb("1.0.2"))
        whenever(pathResolver.resolvePath(bb("1.0.0"), bb("1.0.2")))
            .thenThrow(IllegalStateException("more than one chain of migration plans"))

        assertThatThrownBy { executor.execute(casePlanId, caseDefinitionId, caseDocumentId) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("more than one chain of migration plans")
        verify(planApplier, never()).apply(any(), any(), any())
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
        val parentTarget = bb("2.0.0")
        val childTarget = BuildingBlockDefinitionId.of("photo-upload", "1.0.1")
        whenever(ownershipResolver.directChildrenOf(blockDocumentId)).thenReturn(listOf(child))
        whenever(linkedVersionResolver.resolveTarget(parentTarget, child)).thenReturn(childTarget)
        val childStep = step("photo-controle", childTarget)
        whenever(pathResolver.resolvePath(BuildingBlockDefinitionId.of("photo-upload", "1.0.0"), childTarget))
            .thenReturn(listOf(childStep))

        executor.execute(BlueprintMigrationId.from(parentTarget, "plan"), parentTarget, blockDocumentId)

        verify(planApplier).apply(childStep.planId, childTarget, childDocumentId)
        verify(processVersionChecker).assertProcessOnVersion(childDocumentId, childTarget)
    }

    /**
     * G33. A block the adoption walk took over from under a hop the plan left as a plain sub-process hangs
     * directly off the case, while the call activity that declares it belongs to the skipped block's BPMN.
     * Asking the case gets "I link nothing of the sort" — the same answer as a withdrawn link — so the
     * block would be warned about and never upgraded again. The declarer has to be asked instead.
     */
    @Test
    fun `should ask the blueprint that declares the call activity rather than the owner`() {
        val block = block("1.0.0", activityId = "BesluitCallActivity")
        caseOwns(block)
        val declarer = BuildingBlockDefinitionId.of("skipped-hop", "1.0.0")
        whenever(linkedVersionResolver.resolveGoverningBlueprint(caseDefinitionId, block)).thenReturn(declarer)
        whenever(linkedVersionResolver.resolveTarget(declarer, block)).thenReturn(bb("1.0.0"))

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        // The declarer says it is already on the right version, so nothing moves and nothing is warned about.
        verifyNothingMigrated()
        assertThat(MigrationWarnings.drain()).isNull()
        // And the case was never asked, which is the whole point: its answer would have been "no link".
        verify(linkedVersionResolver, never()).resolveTarget(eq(caseDefinitionId), any())
    }

    @Test
    fun `should upgrade an adopted block when its declaring blueprint links a newer version`() {
        val block = block("1.0.0", activityId = "BesluitCallActivity")
        caseOwns(block)
        val declarer = BuildingBlockDefinitionId.of("skipped-hop", "1.0.0")
        whenever(linkedVersionResolver.resolveGoverningBlueprint(caseDefinitionId, block)).thenReturn(declarer)
        whenever(linkedVersionResolver.resolveTarget(declarer, block)).thenReturn(bb("1.0.1"))
        val step = step("herinspectie", bb("1.0.1"))
        whenever(pathResolver.resolvePath(bb("1.0.0"), bb("1.0.1"))).thenReturn(listOf(step))

        executor.execute(casePlanId, caseDefinitionId, caseDocumentId)

        // Such a block used to be frozen on the version it was adopted on, forever.
        verify(planApplier).apply(step.planId, bb("1.0.1"), blockDocumentId)
        verify(processVersionChecker).assertProcessOnVersion(blockDocumentId, bb("1.0.1"))
    }

    private fun verifyNothingMigrated() {
        verify(planApplier, never()).apply(any(), any(), any())
        verify(processVersionChecker, never()).assertProcessOnVersion(any(), any())
    }

    private fun bb(versionTag: String) = BuildingBlockDefinitionId.of(bbKey, versionTag)

    private fun step(migrationKey: String, target: BuildingBlockDefinitionId) =
        MigrationStep(BlueprintMigrationId.from(target, migrationKey), target)

    private fun block(versionTag: String, activityId: String? = null) = BuildingBlockInstance(
        documentId = blockDocumentId,
        caseDocumentId = caseDocumentId,
        activityId = activityId,
        definition = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId.of(bbKey, versionTag),
            name = bbKey,
        ),
    )

    private fun caseOwns(block: BuildingBlockInstance) {
        whenever(ownershipResolver.directChildrenOf(caseDocumentId)).thenReturn(listOf(block))
    }

    private fun linked(block: BuildingBlockInstance, target: BuildingBlockDefinitionId) {
        whenever(linkedVersionResolver.resolveTarget(caseDefinitionId, block)).thenReturn(target)
    }
}
