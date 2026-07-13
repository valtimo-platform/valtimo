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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.domain.migration.RemoveBuildingBlockInstruction
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.RemoveBuildingBlockConfigurationRepository
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.case_.service.migration.MigrationDataPatchApplier
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.migration.ProcessMigrationVariableResolver
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.migration.MigrationPlan
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Executes the `removeBuildingBlock` component for a single migrating instance (its owner — a case,
 * or a parent building block, identified by [caseId] = the owner document id). For each entry, the
 * building block(s) of `buildingBlockKey` **directly linked** to the owner are dissolved, in this
 * fixed order (so nothing is lost before it is transferred back):
 *
 * 1. **hand back** the building block's process(es) to the owner: migrate them (Operaton) to the
 *    owner's target process definition, and set the process business key back to the owner document
 *    id — processes are never deleted;
 * 2. **transfer data back** via the entry's `dataMigration` (`source` read against the building
 *    block document, `target` written into the owner document);
 * 3. **delete** the building block's JSON document (last) and its instance.
 *
 * Runs synchronously in the caller's transaction, so it commits/rolls back with the whole case.
 */
@Transactional
class RemoveBuildingBlockMigrationComponentExecutor(
    private val removeBuildingBlockConfigurationRepository: RemoveBuildingBlockConfigurationRepository,
    private val buildingBlockInstanceService: BuildingBlockInstanceService,
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val documentService: DocumentService,
    private val runtimeService: RuntimeService,
    private val processMigrationVariableResolver: ProcessMigrationVariableResolver,
    private val dataPatchApplier: MigrationDataPatchApplier,
    private val jdbcTemplate: JdbcTemplate,
) : MigrationComponentExecutor {

    override fun componentKey() = RemoveBuildingBlockMigrationComponentDeployer.REMOVE_BUILDING_BLOCK_COMPONENT_KEY

    override fun execute(migrationId: BlueprintMigrationId, target: BlueprintId, ownerDocumentId: UUID) {
        val instructions = removeBuildingBlockConfigurationRepository.findById(migrationId)
            .map { it.instructions }
            .orElse(emptyList())
        if (instructions.isEmpty()) {
            return
        }

        val directlyLinked = buildingBlockInstanceRepository.findAllByCaseDocumentId(ownerDocumentId)
        instructions.forEach { instruction ->
            directlyLinked
                .filter { it.definition.id.key == instruction.buildingBlockKey }
                .forEach { instance -> removeBuildingBlock(instruction, target, ownerDocumentId, instance) }
        }
    }

    private fun removeBuildingBlock(
        instruction: RemoveBuildingBlockInstruction,
        target: BlueprintId,
        ownerDocumentId: UUID,
        instance: BuildingBlockInstance,
    ) {
        // 1. Hand the process(es) back to the owner (business key → owner document id).
        instruction.processMigration.forEach { processInstruction ->
            handBackProcesses(processInstruction, target, ownerDocumentId, instance)
        }

        // 2. Transfer data back: read from the building block, write into the owner.
        dataPatchApplier.apply(instruction.dataMigration, instance.documentId, ownerDocumentId)

        // 3. Delete the building block instance, then its JSON document (last).
        val documentId = instance.documentId
        buildingBlockInstanceService.delete(instance.id)
        runWithoutAuthorization {
            documentService.deleteDocument(JsonSchemaDocumentId.existingId(documentId))
        }
    }

    private fun handBackProcesses(
        instruction: ProcessMigrationInstruction,
        target: BlueprintId,
        ownerDocumentId: UUID,
        instance: BuildingBlockInstance,
    ) {
        val processInstanceId = instance.processInstanceId ?: return
        val processInstances = runtimeService.createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .processDefinitionKey(instruction.sourceProcessDefinitionKey)
            .list()
        if (processInstances.isEmpty()) {
            return
        }

        val targetDefinitionId = findOwnerTargetProcessDefinitionId(target, instruction.targetProcessDefinitionKey)
            ?: throw NoSuchElementException(
                "No process definition '${instruction.targetProcessDefinitionKey}' found for owner '$target'"
            )

        processInstances.forEach { processInstance ->
            migrate(instruction, processInstance.processDefinitionId, targetDefinitionId, processInstance.processInstanceId)
            processMigrationVariableResolver.apply(processInstance.processInstanceId, instruction.setProcessVariables)
            // Ownership returns to the owner: business key becomes the owner document id.
            updateBusinessKey(processInstance.processInstanceId, ownerDocumentId.toString())
        }
    }

    private fun findOwnerTargetProcessDefinitionId(target: BlueprintId, processDefinitionKey: String): String? {
        return when (target) {
            is CaseDefinitionId -> processDefinitionCaseDefinitionRepository.findByIdCaseDefinitionId(target)
                .firstOrNull { it.processDefinitionKey == processDefinitionKey }
                ?.id?.processDefinitionId?.id

            is BuildingBlockDefinitionId -> processDefinitionBuildingBlockDefinitionRepository
                .findAllByIdBuildingBlockDefinitionId(target)
                .firstOrNull { it.processDefinitionKey == processDefinitionKey }
                ?.id?.processDefinitionId?.id

            else -> null
        }
    }

    private fun migrate(
        instruction: ProcessMigrationInstruction,
        sourceDefinitionId: String,
        targetDefinitionId: String,
        processInstanceId: String,
    ) {
        val plan = buildMigrationPlan(instruction, sourceDefinitionId, targetDefinitionId)

        var builder = runtimeService.newMigration(plan).processInstanceIds(listOf(processInstanceId))
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
            .mapEqualActivities()
        instruction.mapActivities.forEach { (source, target) -> builder.mapActivities(source, target) }
        return builder.build()
    }

    private fun updateBusinessKey(processInstanceId: String, businessKey: String) {
        jdbcTemplate.update(
            "UPDATE ACT_RU_EXECUTION SET BUSINESS_KEY_ = ? WHERE ID_ = ?",
            businessKey, processInstanceId
        )
    }
}
