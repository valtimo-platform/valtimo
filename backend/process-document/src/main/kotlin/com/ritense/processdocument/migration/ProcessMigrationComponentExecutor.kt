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
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
import com.ritense.valtimo.contract.blueprint.migration.MigrationWarnings
import com.ritense.valtimo.migration.ProcessMigrationComponentDeployer
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import com.ritense.valtimo.migration.repository.ProcessMigrationConfigurationRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.migration.MigrationPlan
import org.springframework.core.annotation.Order
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
// Order 200 — runs after the case data migration, before building blocks are added/removed.
@Order(200)
@Transactional
class ProcessMigrationComponentExecutor(
    private val processMigrationConfigurationRepository: ProcessMigrationConfigurationRepository,
    private val processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository,
    private val runtimeService: RuntimeService,
    private val processMigrationVariableResolver: ProcessMigrationVariableResolver,
) : MigrationComponentExecutor {

    override fun componentKey() = ProcessMigrationComponentDeployer.PROCESS_MIGRATION_COMPONENT_KEY

    override fun execute(migrationId: BlueprintMigrationId, target: BlueprintId, caseId: UUID) {
        // Case-only path: building block process migration is handled by its own executor
        // (it resolves the target process via the building-block ↔ process-definition link).
        if (target.blueprintType() != BlueprintType.CASE) {
            return
        }

        val instructions = processMigrationConfigurationRepository.findById(migrationId)
            .map { it.instructions }
            .orElse(emptyList())!!

        val targetCaseDefinitionId = target as CaseDefinitionId
        val unmatched = instructions.filterNot { migrateInstruction(it, targetCaseDefinitionId, caseId) }

        // A single instruction that matched nothing is normal and is not reported per case (see
        // [migrateInstruction]). The component as a whole matching nothing is not: it is the shape of a
        // plan whose process keys are wrong, which migrates no process on any case while reporting
        // success. One line, naming every key that was tried, instead of one line per instruction.
        if (instructions.isNotEmpty() && unmatched.size == instructions.size) {
            val message = "No process was migrated for '$caseId': none of the plan's " +
                "${instructions.size} processMigration instruction(s) (" +
                unmatched.joinToString { "'${it.sourceProcessDefinitionKey}'" } +
                ") matched a running process with business key '$caseId'. Either this case is not (or no " +
                "longer) running any of them, or the instructions name process keys this case never runs."
            logger.warn { message }
            MigrationWarnings.warn(message)
        }
    }

    /** True when the instruction found instances to migrate, false when it matched nothing. */
    private fun migrateInstruction(
        instruction: ProcessMigrationInstruction,
        targetCaseDefinitionId: CaseDefinitionId,
        caseId: UUID,
    ): Boolean {
        val instances = runtimeService.createProcessInstanceQuery()
            .processDefinitionKey(instruction.sourceProcessDefinitionKey)
            .processInstanceBusinessKey(caseId.toString())
            .list()
        if (instances.isEmpty()) {
            // Not a failure, and deliberately **not** a per-case warning. Whether this case runs this
            // particular process is ordinary runtime variation: a plan covering every process a case
            // version owns is correct, and most cases run a handful of them, so warning per instruction
            // produced one line per process the case happens not to be running — on the configuration
            // this was built for, 12 non-actionable lines per case, which buries the ones that matter.
            //
            // What is worth reporting is the component doing nothing *at all*, which is the wrong-key
            // plan D13 exists to catch. [execute] reports that once, from the collected result.
            logger.info {
                "No running process '${instruction.sourceProcessDefinitionKey}' with business key " +
                    "'$caseId' was found, so it was not migrated to " +
                    "'${instruction.targetProcessDefinitionKey}' on '$targetCaseDefinitionId'."
            }
            return false
        }

        val targetDefinitionId = findTargetProcessDefinitionId(
            targetCaseDefinitionId,
            instruction.targetProcessDefinitionKey,
        ) ?: throw NoSuchElementException(
            "No process definition '${instruction.targetProcessDefinitionKey}' " +
                "found for case definition '$targetCaseDefinitionId'"
        )

        // Migrate each instance from the definition it actually runs on, then set its process
        // variables (resolved against that specific, now-migrated instance).
        instances.forEach { instance ->
            migrate(instruction, instance.processDefinitionId, targetDefinitionId, listOf(instance.processInstanceId))
            processMigrationVariableResolver.apply(instance.processInstanceId, instruction.setProcessVariables)
        }
        return true
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
        return builder.build()
    }

    private companion object {
        val logger = KotlinLogging.logger {}
    }
}
