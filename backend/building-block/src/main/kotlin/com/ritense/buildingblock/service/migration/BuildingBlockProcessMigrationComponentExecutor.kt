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
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.migration.ProcessMigrationComponentDeployer
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import com.ritense.valtimo.migration.repository.ProcessMigrationConfigurationRepository
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.migration.MigrationPlan
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Executes the `processMigration` component for a single building block instance: migrates the
 * instance's running process to the process definition tied to the *target* building block
 * definition version, via a synchronous Operaton MigrationPlan.
 *
 * The candidate id is the instance's own document id; from it the running process instance is
 * resolved. The target process definition is resolved from the building block ↔ process-definition
 * link (`process_definition_building_block_definition`); the source is whatever version the process
 * instance is actually running on.
 *
 * Runs **synchronously** (`.execute()`) in the caller's transaction so it commits or rolls back
 * together with the instance's data migration. Only acts on building block migration plans; case
 * plans are handled by the `process-document` executor.
 */
@Transactional
class BuildingBlockProcessMigrationComponentExecutor(
    private val processMigrationConfigurationRepository: ProcessMigrationConfigurationRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val runtimeService: RuntimeService,
    private val processMigrationVariableResolver: ProcessMigrationVariableResolver,
) : MigrationComponentExecutor {

    override fun componentKey() = ProcessMigrationComponentDeployer.PROCESS_MIGRATION_COMPONENT_KEY

    override fun execute(migrationId: BlueprintMigrationId, target: BlueprintId, caseId: UUID) {
        if (target.blueprintType() != BlueprintType.BUILDING_BLOCK) {
            return
        }

        val instructions = processMigrationConfigurationRepository.findById(migrationId)
            .map { it.instructions }
            .orElse(emptyList())
        if (instructions.isEmpty()) {
            return
        }

        val instance = buildingBlockInstanceRepository.findByDocumentId(caseId)
            ?: throw NoSuchElementException("No building block instance found for document '$caseId'")
        // A building block instance without a running process has nothing to migrate here.
        val processInstanceId = instance.processInstanceId ?: return
        val targetBuildingBlockDefinitionId = target as BuildingBlockDefinitionId

        instructions.forEach { instruction ->
            migrateInstruction(instruction, targetBuildingBlockDefinitionId, processInstanceId)
        }
    }

    private fun migrateInstruction(
        instruction: ProcessMigrationInstruction,
        targetBuildingBlockDefinitionId: BuildingBlockDefinitionId,
        processInstanceId: String,
    ) {
        val instances = runtimeService.createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .processDefinitionKey(instruction.sourceProcessDefinitionKey)
            .list()
        if (instances.isEmpty()) {
            return
        }

        val targetDefinitionId = findTargetProcessDefinitionId(
            targetBuildingBlockDefinitionId,
            instruction.targetProcessDefinitionKey,
        ) ?: throw NoSuchElementException(
            "No process definition '${instruction.targetProcessDefinitionKey}' " +
                "found for building block definition '$targetBuildingBlockDefinitionId'"
        )

        // Migrate each instance from the definition it actually runs on, then set its process
        // variables (resolved against that specific, now-migrated instance).
        instances.forEach { instance ->
            migrate(instruction, instance.processDefinitionId, targetDefinitionId, listOf(instance.processInstanceId))
            processMigrationVariableResolver.apply(instance.processInstanceId, instruction.setProcessVariables)
        }
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

    private fun buildMigrationPlan(
        instruction: ProcessMigrationInstruction,
        sourceDefinitionId: String,
        targetDefinitionId: String,
    ): MigrationPlan {
        val builder = runtimeService.createMigrationPlan(sourceDefinitionId, targetDefinitionId)
        instruction.mapActivities.forEach { (source, target) -> builder.mapActivities(source, target) }
        return builder.build()
    }
}
