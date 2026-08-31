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

import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.case_.domain.migration.CaseMigrationCase
import com.ritense.case_.domain.migration.CaseMigrationCaseId
import com.ritense.case_.domain.migration.CaseMigrationCaseStatus
import com.ritense.case_.repository.CaseMigrationCaseRepository
import com.ritense.case_.service.migration.MigrationPlanApplier
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
import com.ritense.valtimo.contract.blueprint.migration.MigrationWarnings
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RuntimeService
import org.springframework.beans.factory.ObjectProvider
import org.springframework.core.annotation.Order
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Brings a migrated instance's building blocks onto the versions its new blueprint version links.
 *
 * This is what makes a building block migrate at all. A building block has no lifecycle of its own —
 * it exists inside a case — so it does not get its own triggers, conditions or run. Instead, when a
 * case migrates, the *target* case definition version is asked which building block versions it links
 * ([LinkedBuildingBlockVersionResolver]); any of the case's blocks sitting on an older version are
 * brought up to the linked one by applying that building block's own migration plans.
 *
 * The linked version may be several versions ahead (a case jumping straight to `3.0.0` while its block
 * is still on `1.0.0`), so the upgrade runs as a chain: [BuildingBlockMigrationPathResolver] works out
 * which plans lead from where the instance is to where it needs to be, and each is applied in turn.
 * Because every plan declares the version it migrates *from*, that chain is read off the deployed plans
 * themselves — so a single plan may declare the whole jump, and a plan may lead from one building block
 * key to an entirely different one. What no plan connects, nothing here will bridge by inference.
 *
 * Whether that is fatal depends on whether the block is **running** (G49). A block with a live process
 * holds a token in a process definition its own version owns exclusively, and no later migration will
 * ever move it, so a missing plan fails the case. A block that has finished, or never started, has no
 * token: the case migrates and the block is left where it is, with a warning. Failing a case over a
 * plan for a dormant block would refuse work that does not exist — and it is the state most cases are
 * in, because an instance row outlives its process.
 *
 * Because a building block's own new version may in turn link different versions of the blocks *it*
 * owns, the same treatment is applied to nested blocks, descending the tree one level at a time.
 *
 * Everything happens in the migrating case's transaction, so a building block that cannot migrate
 * fails its case rather than leaving the case half-migrated.
 */
// Order 500 — last. Blocks the plan dissolves (removeBuildingBlock, order 400) are gone by now and are
// correctly never upgraded; blocks the plan just added (order 300) are already on their linked version
// and fall through as a no-op.
@Order(500)
@Transactional
class BuildingBlockVersionAlignmentExecutor(
    private val buildingBlockOwnershipResolver: BuildingBlockOwnershipResolver,
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
    private val buildingBlockMigrationPathResolver: BuildingBlockMigrationPathResolver,
    private val buildingBlockProcessVersionChecker: BuildingBlockProcessVersionChecker,
    private val caseMigrationCaseRepository: CaseMigrationCaseRepository,
    private val runtimeService: RuntimeService,
    // Lazy: the applier owns the list of component executors, of which this is one. Resolving it up
    // front would be a circular bean dependency.
    private val migrationPlanApplier: ObjectProvider<MigrationPlanApplier>,
) : MigrationComponentExecutor {

    override fun componentKey() = COMPONENT_KEY

    override fun execute(migrationId: BlueprintMigrationId, target: BlueprintId, ownerDocumentId: UUID) {
        alignChildrenOf(target, ownerDocumentId)
    }

    /** Align every building block [ownerDocumentId] owns *directly* against the owner's [ownerTarget] version. */
    private fun alignChildrenOf(ownerTarget: BlueprintId, ownerDocumentId: UUID) {
        buildingBlockOwnershipResolver.directChildrenOf(ownerDocumentId)
            .forEach { child -> align(ownerTarget, child) }
    }

    private fun align(ownerTarget: BlueprintId, instance: BuildingBlockInstance) {
        val current = instance.definition.id
        // Which blueprint's links govern this instance. Normally the owner's own target version, and for
        // a block the adoption walk took over from under a hop the plan left as a plain sub-process, the
        // blueprint that declares the call activity it came from — which is not the owner, because nothing
        // became a block at that level. Asking the owner there gets "I link nothing of the sort", which is
        // the same answer as a withdrawn link: the block would be left alone with a warning telling the
        // author to dissolve what their plan had just deliberately created, and no later migration would
        // ever upgrade it. The authorising check reaches such a block *through* its declarer, so the
        // declarer is what maintains it (G33).
        val governing = linkedBuildingBlockVersionResolver.resolveGoverningBlueprint(ownerTarget, instance)
        val linked = linkedBuildingBlockVersionResolver.resolveTarget(governing, instance)

        if (linked == null) {
            // The owner's new version no longer links this building block. Leaving it alone is
            // deliberate: dissolving a running block is what a plan's `removeBuildingBlock` is for, and
            // it deletes a document, so it is never done on inference alone.
            //
            // But it is not left *quietly*. This is the mirror of the warning the add side raises for a
            // call activity that declares a block no entry authorises, and it is the only moment anyone
            // is told: a block whose governing link is gone keeps running, and the failure surfaces
            // whenever its call activity next ends — possibly weeks after a run that reported COMPLETED
            // (G24). By the time alignment runs (@500) anything a `removeBuildingBlock` entry dissolved
            // (@400) is already gone, so every instance reaching this branch is one nothing asked about.
            val stale = "Building block '$current' (instance '${instance.id}') is still running under " +
                "'${instance.caseDocumentId ?: instance.documentId}', but '$governing' no longer links it, so it " +
                "was left as it is. A case started on this version would not have it. Add a " +
                "'removeBuildingBlock' entry for '$current' to dissolve it and hand its process back, or " +
                "restore the link on the call activity that used to declare it."
            logger.warn { stale }
            MigrationWarnings.warn(stale)
            return
        }
        if (linked == current) {
            return
        }
        // Only meaningful within one building block key: two versions of *different* building blocks are
        // not ordered relative to each other, so what counts as a downgrade across keys is not something
        // version numbers can answer. There the deployed plans are the only authority — a key change
        // happens if and only if a plan says how.
        if (linked.key == current.key && linked.versionTag.isLowerThan(current.versionTag)) {
            logger.warn {
                "'$governing' links building block '$linked', which is older than the '$current' " +
                    "that instance '${instance.id}' is on; not downgrading"
            }
            return
        }

        logger.debug { "Migrating building block instance '${instance.id}' from '$current' to '$linked'" }
        // A running block must have a chain of plans; a dormant one takes one if it exists. Only the
        // question differs — an ambiguous chain still fails either of them, because two chains reaching
        // one version is wrong for every instance on every run and decides which patches reach a
        // document whether or not a process is running.
        val steps = if (hasRunningProcess(instance)) {
            buildingBlockMigrationPathResolver.resolvePath(current, linked)
        } else {
            buildingBlockMigrationPathResolver.findPath(current, linked)
        }
        if (steps == null) {
            leaveDormantBlockBehind(instance, current, linked, governing)
            return
        }
        steps.forEach { step -> applyStep(step, instance.documentId) }

        // Descend. Applying the last step's plan already ran this executor for the block itself, so this
        // re-walk normally just re-confirms each child is on its linked version — a cheap resolve and
        // version compare. It is kept because that is not something to depend on silently: it also
        // catches a child the last plan's own components moved or added.
        alignChildrenOf(linked, instance.documentId)
    }

    /**
     * Whether anything is actually running under [instance] — which is what decides whether a missing
     * chain of plans is fatal (G49).
     *
     * Both halves matter and both are common. A block that has **never started** carries no process
     * instance id at all; a block that has **finished** still carries the id of a process instance that
     * is gone, because nothing deletes an instance row when its process ends — only deleting the
     * document does, or a `removeBuildingBlock` entry. So a case that ran a block once and closed it
     * years ago looks exactly like one running it right now unless the runtime is asked.
     *
     * The same reading [BuildingBlockProcessVersionChecker] already takes: it has nothing to check
     * without a live process, and this is the other side of that coin.
     */
    private fun hasRunningProcess(instance: BuildingBlockInstance): Boolean {
        val processInstanceId = instance.processInstanceId ?: return false
        return runtimeService.createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .singleResult() != null
    }

    /**
     * A dormant block no plan can move: leave it on the version it is on, and say so.
     *
     * Not silent, because something *is* now different: the block stays on a version its owner no
     * longer links, so this case differs from one freshly started on the target version, and — like
     * G24's stale block — no later migration will pick it up on its own. What it is not is a reason to
     * fail the case: with no process there is no token to strand, and the only work a plan would still
     * have done is fit the block's document to the new version's schema.
     *
     * Nothing below it is visited. The block did not move, so the version governing its children is the
     * one they were already aligned against.
     */
    private fun leaveDormantBlockBehind(
        instance: BuildingBlockInstance,
        current: BuildingBlockDefinitionId,
        linked: BuildingBlockDefinitionId,
        governing: BlueprintId,
    ) {
        val message = "Building block '$current' (instance '${instance.id}') under " +
            "'${instance.caseDocumentId ?: instance.documentId}' is not running a process, and no " +
            "migration plan connects it to '$linked', which '$governing' links. It was left on " +
            "'$current' rather than failing the case: with nothing running there is no token to move, " +
            "so the only thing a plan would still have done is fit its document to '$linked'. Deploy a " +
            "'*.building-block-migration.json' whose 'source' leads from '$current' to '$linked' if " +
            "that document should come along; until then this block keeps a shape a case started on " +
            "'$governing' would not have."
        logger.warn { message }
        MigrationWarnings.warn(message)
    }

    /**
     * Move one building block document one hop along its upgrade chain: apply [step]'s plan and land the
     * document on the version that plan targets.
     *
     * Which plans exist and in what order they run is settled by [BuildingBlockMigrationPathResolver]
     * before anything is applied — including the "more than one chain does" refusal, and whatever
     * "nothing connects these versions" turned out to mean for this instance — so by the time a step
     * gets here there is exactly one thing to do.
     */
    private fun applyStep(step: BuildingBlockMigrationPathResolver.MigrationStep, documentId: UUID) {
        migrationPlanApplier.getObject().apply(step.planId, step.target, documentId)
        recordApplied(step.planId, documentId)

        // The plan has run; hold it to having moved the process too, rather than leaving the block
        // claiming a version whose BPMN it is not executing.
        buildingBlockProcessVersionChecker.assertProcessOnVersion(documentId, step.target)
    }

    /**
     * Record that [planId] was applied to [documentId]. A building block plan has no run to report on,
     * so these rows are the only account of what it has done; they are written in the migrating case's
     * transaction, so a block that ends up rolled back leaves no trace of having migrated.
     */
    private fun recordApplied(planId: BlueprintMigrationId, documentId: UUID) {
        caseMigrationCaseRepository.save(
            CaseMigrationCase(CaseMigrationCaseId(planId, documentId.toString()), CaseMigrationCaseStatus.MIGRATED)
        )
    }

    companion object {
        const val COMPONENT_KEY = "buildingBlockVersionAlignment"

        private val logger = KotlinLogging.logger {}
    }
}
