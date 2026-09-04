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
import com.ritense.valtimo.operaton.findProcessDefinitionOrNull
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RepositoryService
import org.springframework.core.annotation.Order
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** Repoints the call activity a block was started from after its calling process migrated — stale values leave the version resolver and the plugin configuration resolver both falling back wrongly. Direct blocks only. */
// Order 250 — after the process migration (200) that invalidates these, before 300/400/500 read them.
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

    override fun execute(migrationId: BlueprintMigrationId, target: BlueprintId, ownerDocumentId: UUID) {
        val instructions = processMigrationConfigurationRepository.findById(migrationId)
            .map { it.instructions }
            .orElse(emptyList())
        if (instructions.isEmpty()) {
            return
        }

        val children = buildingBlockOwnershipResolver.directChildrenOf(ownerDocumentId)
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

    /** The key of a deployed process definition, or null once it is gone. Asked so that it answers rather than throws — see [findProcessDefinitionOrNull]. */
    private fun processDefinitionKeyOf(processDefinitionId: String): String? =
        repositoryService.findProcessDefinitionOrNull(processDefinitionId)?.key

    private companion object {
        val logger = KotlinLogging.logger {}
    }
}
