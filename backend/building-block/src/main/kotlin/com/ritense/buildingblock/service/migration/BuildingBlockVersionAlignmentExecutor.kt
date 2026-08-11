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
import io.github.oshai.kotlinlogging.KotlinLogging
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
 * key to an entirely different one. What no plan connects, nothing here will bridge by inference: it
 * fails the migration.
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
    // Lazy: the applier owns the list of component executors, of which this is one. Resolving it up
    // front would be a circular bean dependency.
    private val migrationPlanApplier: ObjectProvider<MigrationPlanApplier>,
) : MigrationComponentExecutor {

    override fun componentKey() = COMPONENT_KEY

    override fun execute(migrationId: BlueprintMigrationId, target: BlueprintId, caseId: UUID) {
        alignChildrenOf(target, caseId)
    }

    /** Align every building block [ownerDocumentId] owns *directly* against the owner's [ownerTarget] version. */
    private fun alignChildrenOf(ownerTarget: BlueprintId, ownerDocumentId: UUID) {
        buildingBlockOwnershipResolver.directChildrenOf(ownerDocumentId)
            .forEach { child -> align(ownerTarget, child) }
    }

    private fun align(ownerTarget: BlueprintId, instance: BuildingBlockInstance) {
        val current = instance.definition.id
        val linked = linkedBuildingBlockVersionResolver.resolveTarget(ownerTarget, instance)

        if (linked == null) {
            // The owner's new version no longer links this building block. Leaving it alone is
            // deliberate: dissolving a running block is what a plan's `removeBuildingBlock` is for.
            logger.debug {
                "Building block '$current' (instance '${instance.id}') is not linked by '$ownerTarget'; leaving it as is"
            }
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
                "'$ownerTarget' links building block '$linked', which is older than the '$current' " +
                    "that instance '${instance.id}' is on; not downgrading"
            }
            return
        }

        logger.debug { "Migrating building block instance '${instance.id}' from '$current' to '$linked'" }
        buildingBlockMigrationPathResolver.resolvePath(current, linked).forEach { step ->
            applyStep(step, instance.documentId)
        }

        // Descend. Applying the last step's plan already ran this executor for the block itself, so this
        // re-walk normally just re-confirms each child is on its linked version — a cheap resolve and
        // version compare. It is kept because that is not something to depend on silently: it also
        // catches a child the last plan's own components moved or added.
        alignChildrenOf(linked, instance.documentId)
    }

    /**
     * Move one building block document one hop along its upgrade chain: apply [step]'s plan and land the
     * document on the version that plan targets.
     *
     * Which plans exist and in what order they run is settled by [BuildingBlockMigrationPathResolver]
     * before anything is applied — including the refusals for "nothing connects these versions" and
     * "more than one chain does" — so by the time a step gets here there is exactly one thing to do.
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
