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

/** Brings a migrated instance's building blocks onto the versions its new blueprint version links, applying each block's own plans as a chain, recursively. A missing chain fails only a running block (G49). */
// Order 500 — last. Dissolved blocks (@400) are gone; blocks just added (@300) are already aligned.
@Order(500)
@Transactional
class BuildingBlockVersionAlignmentExecutor(
    private val buildingBlockOwnershipResolver: BuildingBlockOwnershipResolver,
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
    private val buildingBlockMigrationPathResolver: BuildingBlockMigrationPathResolver,
    private val buildingBlockProcessVersionChecker: BuildingBlockProcessVersionChecker,
    private val caseMigrationCaseRepository: CaseMigrationCaseRepository,
    private val runtimeService: RuntimeService,
    // Lazy: the applier owns the executor list this belongs to — resolving it up front is a bean cycle.
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
        // Normally the owner's target version, but a block adopted from under a plain sub-process is governed by the blueprint declaring its call activity (G33).
        val governing = linkedBuildingBlockVersionResolver.resolveGoverningBlueprint(ownerTarget, instance)
        val linked = linkedBuildingBlockVersionResolver.resolveTarget(governing, instance)

        if (linked == null) {
            // The link is gone: never dissolve on inference — that is `removeBuildingBlock`'s job — but say so, because the failure would otherwise surface weeks later (G24).
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
        // Only meaningful within one key: across keys the deployed plans are the only authority.
        if (linked.key == current.key && linked.versionTag.isLowerThan(current.versionTag)) {
            logger.warn {
                "'$governing' links building block '$linked', which is older than the '$current' " +
                    "that instance '${instance.id}' is on; not downgrading"
            }
            return
        }

        logger.debug { "Migrating building block instance '${instance.id}' from '$current' to '$linked'" }
        // An ambiguous chain fails either way — two chains reaching one version is wrong for every instance, running or not.
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

        // Normally just re-confirms each child, but also catches a child the last plan's own components moved or added.
        alignChildrenOf(linked, instance.documentId)
    }

    /** Whether anything is actually running under [instance] — nothing deletes an instance row when its process ends, so a finished block looks live unless the runtime is asked (G49). */
    private fun hasRunningProcess(instance: BuildingBlockInstance): Boolean {
        val processInstanceId = instance.processInstanceId ?: return false
        return runtimeService.createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .singleResult() != null
    }

    /** A dormant block no plan can move: left where it is, with a warning, and nothing below it visited. */
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

    /** Move one building block document one hop along its chain; [BuildingBlockMigrationPathResolver] has already settled that there is exactly one thing to do. */
    private fun applyStep(step: BuildingBlockMigrationPathResolver.MigrationStep, documentId: UUID) {
        migrationPlanApplier.getObject().apply(step.planId, step.target, documentId)
        recordApplied(step.planId, documentId)

        // Hold the plan to having moved the process too, rather than leaving the block claiming a version whose BPMN it is not executing.
        buildingBlockProcessVersionChecker.assertProcessOnVersion(documentId, step.target)
    }

    /** Record that [planId] was applied to [documentId] — the only account a building block plan has, written in the case's transaction. */
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
