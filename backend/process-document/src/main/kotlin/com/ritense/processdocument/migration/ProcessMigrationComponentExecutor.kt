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

package com.ritense.processdocument.migration

import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.case_.migration.CaseDefinitionMigrationId
import com.ritense.valtimo.contract.case_.migration.MigrationComponentExecutor
import com.ritense.valtimo.migration.ProcessMigrationComponentDeployer
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import com.ritense.valtimo.migration.repository.ProcessMigrationConfigurationRepository
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.migration.MigrationPlan
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Executes the `processMigration` component for a single case: for each instruction, migrates the
 * case's running process instances (found by business key == case id) to the process definition
 * tied to the *target* case definition version, via a synchronous Operaton MigrationPlan.
 *
 * Lives in `process-document` because it needs the `case-definition ↔ process-definition` link
 * (`process_definition_case_definition`) to resolve the target version. The source definition is
 * whatever version each process instance is actually running on (so mixed versions are handled and
 * it always matches the case's current state); the target is resolved from the target case
 * definition version — never "the latest deployed version".
 *
 * Runs **synchronously** (`.execute()`, not `.executeAsync()`) in the caller's transaction so the
 * process migration commits or rolls back together with the case's data migration. Because the
 * engine shares the application's transaction manager and datasource, no XA/2PC is required.
 */
@Transactional
class ProcessMigrationComponentExecutor(
    private val processMigrationConfigurationRepository: ProcessMigrationConfigurationRepository,
    private val processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository,
    private val runtimeService: RuntimeService,
) : MigrationComponentExecutor {

    override fun componentKey() = ProcessMigrationComponentDeployer.PROCESS_MIGRATION_COMPONENT_KEY

    override fun execute(migrationId: CaseDefinitionMigrationId, caseId: UUID) {
        val instructions = processMigrationConfigurationRepository.findById(migrationId)
            .map { it.instructions }
            .orElse(emptyList())

        instructions.forEach { instruction ->
            migrateInstruction(instruction, migrationId.caseDefinitionId, caseId)
        }
    }

    private fun migrateInstruction(
        instruction: ProcessMigrationInstruction,
        targetCaseDefinitionId: CaseDefinitionId,
        caseId: UUID,
    ) {
        val instances = runtimeService.createProcessInstanceQuery()
            .processDefinitionKey(instruction.sourceProcessDefinitionKey)
            .processInstanceBusinessKey(caseId.toString())
            .list()
        if (instances.isEmpty()) {
            return
        }

        val targetDefinitionId = findTargetProcessDefinitionId(
            targetCaseDefinitionId,
            instruction.targetProcessDefinitionKey,
        ) ?: throw NoSuchElementException(
            "No process definition '${instruction.targetProcessDefinitionKey}' " +
                "found for case definition '$targetCaseDefinitionId'"
        )

        // Migrate from the definition each instance actually runs on (grouped, so instances on
        // different source versions are each migrated with a matching plan).
        instances.groupBy { it.processDefinitionId }
            .forEach { (sourceDefinitionId, group) ->
                migrate(instruction, sourceDefinitionId, targetDefinitionId, group.map { it.processInstanceId })
            }
    }

    private fun findTargetProcessDefinitionId(
        targetCaseDefinitionId: CaseDefinitionId,
        processDefinitionKey: String,
    ): String? {
        return processDefinitionCaseDefinitionRepository.findByIdCaseDefinitionId(targetCaseDefinitionId)
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
            .mapEqualActivities()
        instruction.mapActivities.forEach { (source, target) -> builder.mapActivities(source, target) }
        if (instruction.newProcessVariables.isNotEmpty()) {
            // GZAC-layer addition, applied as part of the migration command itself.
            builder.setVariables(instruction.newProcessVariables)
        }
        return builder.build()
    }
}
