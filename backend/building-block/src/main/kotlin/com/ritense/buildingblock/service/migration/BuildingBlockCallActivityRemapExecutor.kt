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
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.processdocument.migration.ProcessDefinitionBlueprintResolver
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
import com.ritense.valtimo.migration.ProcessMigrationComponentDeployer
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import com.ritense.valtimo.migration.repository.ProcessMigrationConfigurationRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RepositoryService
import org.springframework.core.annotation.Order
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Keeps the call activity a building block was started from pointing at something that still exists,
 * after the calling process has been migrated.
 *
 * A building block started from a call activity records which activity of which process definition
 * started it. The `processMigration` component then moves the calling process onto a new definition
 * and may rename its activities, at which point both recorded values are stale — they name a
 * definition the process no longer runs on, and possibly an activity that no longer exists. Two
 * things break when that happens:
 *
 * - [LinkedBuildingBlockVersionResolver] can no longer tell which call activity's link governs the
 *   block, so it falls back to the highest linked version instead of the version that call activity
 *   actually names;
 * - `DefaultBuildingBlockPluginConfigurationResolver` cannot resolve plugin configuration through the
 *   call-activity mapping and silently falls back to the case-link mapping.
 *
 * Only the migrating instance's *direct* blocks are remapped. A nested block is called from its
 * parent block's process, which this same component handles when that block's own plan migrates it.
 */
// Order 250 — after the process migration (200) that invalidates these references, and before blocks
// are added (300), removed (400) or version-aligned (500), all of which read them.
@Order(250)
@Transactional
class BuildingBlockCallActivityRemapExecutor(
    private val processMigrationConfigurationRepository: ProcessMigrationConfigurationRepository,
    private val buildingBlockOwnershipResolver: BuildingBlockOwnershipResolver,
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val processDefinitionBlueprintResolvers: List<ProcessDefinitionBlueprintResolver>,
    private val repositoryService: RepositoryService,
) : MigrationComponentExecutor {

    override fun componentKey() = ProcessMigrationComponentDeployer.PROCESS_MIGRATION_COMPONENT_KEY

    override fun execute(migrationId: BlueprintMigrationId, target: BlueprintId, caseId: UUID) {
        val instructions = processMigrationConfigurationRepository.findById(migrationId)
            .map { it.instructions }
            .orElse(emptyList())
        if (instructions.isEmpty()) {
            return
        }

        val children = buildingBlockOwnershipResolver.directChildrenOf(caseId)
            .filter { it.callerProcessDefinitionId != null }
        if (children.isEmpty()) {
            return
        }

        val targetProcessDefinitions = processDefinitionBlueprintResolvers
            .firstOrNull { it.supports(target.blueprintType()) }
            ?.resolveProcessDefinitions(target)
            ?: return

        children.forEach { child -> remap(child, instructions, targetProcessDefinitions, target) }
    }

    private fun remap(
        instance: BuildingBlockInstance,
        instructions: List<ProcessMigrationInstruction>,
        targetProcessDefinitions: Map<String, String>,
        target: BlueprintId,
    ) {
        val callerKey = processDefinitionKeyOf(instance.callerProcessDefinitionId!!) ?: return
        // Only the instruction that migrated *this* block's calling process may repoint it.
        val instruction = instructions.firstOrNull { it.sourceProcessDefinitionKey == callerKey } ?: return

        val newCallerProcessDefinitionId = targetProcessDefinitions[instruction.targetProcessDefinitionKey]
            ?: throw NoSuchElementException(
                "No process definition '${instruction.targetProcessDefinitionKey}' found for '$target' " +
                    "while repointing building block instance '${instance.id}' at its migrated call activity"
            )
        val newActivityId = instance.activityId?.let { instruction.mapActivities[it] ?: it }

        if (instance.callerProcessDefinitionId == newCallerProcessDefinitionId && instance.activityId == newActivityId) {
            return
        }

        logger.debug {
            "Repointing building block instance '${instance.id}' from call activity " +
                "'${instance.activityId}' on '${instance.callerProcessDefinitionId}' to " +
                "'$newActivityId' on '$newCallerProcessDefinitionId'"
        }
        instance.callerProcessDefinitionId = newCallerProcessDefinitionId
        instance.activityId = newActivityId
        buildingBlockInstanceRepository.save(instance)
    }

    /** The key of a deployed process definition, or null when it is no longer deployed. */
    private fun processDefinitionKeyOf(processDefinitionId: String): String? {
        return try {
            repositoryService.getProcessDefinition(processDefinitionId)?.key
        } catch (e: Exception) {
            logger.debug(e) { "Could not resolve process definition '$processDefinitionId'" }
            null
        }
    }

    private companion object {
        val logger = KotlinLogging.logger {}
    }
}
