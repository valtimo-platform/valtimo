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

import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.processdocument.migration.ProcessMigrationVariableResolver
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
import com.ritense.valtimo.contract.blueprint.migration.MigrationWarnings
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.migration.ProcessMigrationComponentDeployer
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import com.ritense.valtimo.migration.repository.ProcessMigrationConfigurationRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.migration.MigrationPlan
import org.springframework.core.annotation.Order
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** Migrates a building block instance's running process onto the target version's definition, resolved through the building block ↔ process-definition link. Synchronous, in the caller's transaction. Building block plans only. */
// Order 200 — the building block counterpart of the case process migration stage.
@Order(200)
@Transactional
class BuildingBlockProcessMigrationComponentExecutor(
    private val processMigrationConfigurationRepository: ProcessMigrationConfigurationRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val runtimeService: RuntimeService,
    private val processMigrationVariableResolver: ProcessMigrationVariableResolver,
) : MigrationComponentExecutor {

    override fun componentKey() = ProcessMigrationComponentDeployer.PROCESS_MIGRATION_COMPONENT_KEY

    override fun execute(migrationId: BlueprintMigrationId, target: BlueprintId, ownerDocumentId: UUID) {
        if (target.blueprintType() != BlueprintType.BUILDING_BLOCK) {
            return
        }

        val instructions = processMigrationConfigurationRepository.findById(migrationId)
            .map { it.instructions }
            .orElse(emptyList())
        if (instructions.isEmpty()) {
            return
        }

        val instance = buildingBlockInstanceRepository.findByDocumentId(ownerDocumentId)
            ?: throw NoSuchElementException("No building block instance found for document '$ownerDocumentId'")
        // A building block instance without a running process has nothing to migrate here.
        instance.processInstanceId ?: return
        val targetBuildingBlockDefinitionId = target as BuildingBlockDefinitionId

        val unmatched = instructions.filterNot {
            migrateInstruction(it, targetBuildingBlockDefinitionId, ownerDocumentId)
        }

        // One instruction matching nothing is normal; the component as a whole matching nothing is the wrong-key plan D13 exists to catch. Mirrors the case-side executor.
        if (unmatched.size == instructions.size) {
            val message = "No process was migrated for building block '$ownerDocumentId': none of the " +
                "plan's ${instructions.size} processMigration instruction(s) (" +
                unmatched.joinToString { "'${it.sourceProcessDefinitionKey}'" } +
                ") matched a running process with business key '$ownerDocumentId'. Either this block is not " +
                "(or no longer) running any of them, or the instructions name process keys it never runs."
            logger.warn { message }
            MigrationWarnings.warn(message)
        }
    }

    /**
     * True when the instruction found instances to migrate, false when it matched nothing.
     *
     * Matched by key **and business key**, as the case side is: a block may own more than one process, and one its
     * own BPMN calls is a different process instance from the block's, so pinning the query to the block's own
     * instance made every such instruction a silent no-op (G65). A process reached this way carries the block's
     * document id because its call activity maps the business key across — the same requirement
     * `BuildingBlockCallActivityBusinessKeyValidator` already states for a nested block, whose own document id
     * keeps it out of this query.
     */
    private fun migrateInstruction(
        instruction: ProcessMigrationInstruction,
        targetBuildingBlockDefinitionId: BuildingBlockDefinitionId,
        buildingBlockDocumentId: UUID,
    ): Boolean {
        val instances = runtimeService.createProcessInstanceQuery()
            .processDefinitionKey(instruction.sourceProcessDefinitionKey)
            .processInstanceBusinessKey(buildingBlockDocumentId.toString())
            .list()
        if (instances.isEmpty()) {
            // Per-instruction silence is deliberate, as on the case side: [execute] reports the component doing nothing at all.
            logger.info {
                "No running process '${instruction.sourceProcessDefinitionKey}' with business key " +
                    "'$buildingBlockDocumentId' was found, so it was not migrated to " +
                    "'${instruction.targetProcessDefinitionKey}' on '$targetBuildingBlockDefinitionId'."
            }
            return false
        }

        val targetDefinitionId = findTargetProcessDefinitionId(
            targetBuildingBlockDefinitionId,
            instruction.targetProcessDefinitionKey,
        ) ?: throw NoSuchElementException(
            "No process definition '${instruction.targetProcessDefinitionKey}' " +
                "found for building block definition '$targetBuildingBlockDefinitionId'"
        )

        // Migrate from the definition each instance actually runs on, then set variables against that migrated instance.
        instances.forEach { instance ->
            migrate(instruction, instance.processDefinitionId, targetDefinitionId, listOf(instance.processInstanceId))
            processMigrationVariableResolver.apply(instance.processInstanceId, instruction.setProcessVariables)
        }
        return true
    }

    private fun findTargetProcessDefinitionId(
        targetBuildingBlockDefinitionId: BuildingBlockDefinitionId,
        processDefinitionKey: String,
    ): String? {
        return processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(targetBuildingBlockDefinitionId)
            .firstOrNull { it.processDefinitionKey == processDefinitionKey }
            ?.id
            ?.processDefinitionId
            ?.id
    }

    private fun migrate(
        instruction: ProcessMigrationInstruction,
        sourceDefinitionId: String,
        targetDefinitionId: String,
        processInstanceIds: List<String>,
    ) {
        val plan = buildMigrationPlan(instruction, sourceDefinitionId, targetDefinitionId)

        var builder = runtimeService.newMigration(plan).processInstanceIds(processInstanceIds)
        if (instruction.skipCustomListeners) {
            builder = builder.skipCustomListeners()
        }
        if (instruction.skipIoMappings) {
            builder = builder.skipIoMappings()
        }
        builder.execute() // synchronous — joins the current transaction
    }

    private companion object {
        val logger = KotlinLogging.logger {}
    }

    private fun buildMigrationPlan(
        instruction: ProcessMigrationInstruction,
        sourceDefinitionId: String,
        targetDefinitionId: String,
    ): MigrationPlan {
        val builder = runtimeService.createMigrationPlan(sourceDefinitionId, targetDefinitionId)
            .mapEqualActivities()
        instruction.mapActivities.forEach { (source, target) -> builder.mapActivities(source, target) }
        return builder.build()
    }
}
