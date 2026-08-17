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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.domain.migration.AddBuildingBlockInstruction
import com.ritense.buildingblock.repository.AddBuildingBlockConfigurationRepository
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.case_.service.migration.MigrationDataPatchApplier
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.processdocument.migration.ProcessMigrationVariableResolver
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
import com.ritense.valtimo.contract.buildingblock.BuildingBlockConstants.Companion.BUILDING_BLOCK_DOCUMENT_ID_VARIABLE
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import com.ritense.valtimo.operaton.repository.OperatonExecutionRepository
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.migration.MigrationPlan
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.springframework.core.annotation.Order
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Executes the `addBuildingBlock` component for a single migrating instance (its owner — a case, or
 * a parent building block, identified by [caseId] = the owner document id). For each configured
 * entry, in this fixed order:
 *
 * 1. **create** the building block's JSON document (empty) and a [BuildingBlockInstance] linked to
 *    the owner (a case → `caseDocumentId`; a parent building block → parent + inherited case);
 * 2. **fill** the new document from the owner via the entry's `dataMigration`
 *    (`source` read against the owner, `target` written into the new building block document);
 * 3. **hijack** the owner's running process(es) named by `sourceProcessDefinitionKey`: migrate them
 *    (Operaton) to the added building block's process definition, set the process business key to
 *    the new building block document id, and point the instance's `processInstanceId` at it.
 *
 * Runs synchronously in the caller's transaction, so it commits/rolls back with the whole case.
 */
// Order 300 — runs after the process migration: an added block hijacks the now-migrated process, so
// the process must already be on its target version.
@Order(300)
@Transactional
class AddBuildingBlockMigrationComponentExecutor(
    private val objectMapper: ObjectMapper,
    private val addBuildingBlockConfigurationRepository: AddBuildingBlockConfigurationRepository,
    private val buildingBlockInstanceService: BuildingBlockInstanceService,
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val runtimeService: RuntimeService,
    private val operatonExecutionRepository: OperatonExecutionRepository,
    private val processMigrationVariableResolver: ProcessMigrationVariableResolver,
    private val processDocumentAssociationService: ProcessDocumentAssociationService,
    private val dataPatchApplier: MigrationDataPatchApplier,
    private val addBuildingBlockLinkChecker: AddBuildingBlockLinkChecker,
    private val jdbcTemplate: JdbcTemplate,
) : MigrationComponentExecutor {

    override fun componentKey() = AddBuildingBlockMigrationComponentDeployer.ADD_BUILDING_BLOCK_COMPONENT_KEY

    override fun execute(migrationId: BlueprintMigrationId, target: BlueprintId, ownerDocumentId: UUID) {
        val instructions = addBuildingBlockConfigurationRepository.findById(migrationId)
            .map { it.instructions }
            .orElse(emptyList())
        if (instructions.isEmpty()) {
            return
        }

        // Refuse before creating anything: a block whose version the target does not link is invisible
        // to every later migration (R2). Checked here as well as on the save path because a plan
        // deployed from a file never passes the save path; on a dry run this surfaces as WOULD_FAIL.
        // Deliberately ahead of the "nothing to hijack" skip below — the plan is wrong either way.
        addBuildingBlockLinkChecker.assertLinked(target, instructions)

        // The owner is whatever instance the plan migrates: a case (no building block for its
        // document id) or a parent building block (in which case the new block nests under it).
        val parent = buildingBlockInstanceRepository.findByDocumentId(ownerDocumentId)
        val caseDocumentId = parent?.caseDocumentId ?: ownerDocumentId
        val parentBuildingBlockInstanceId = parent?.id

        instructions.forEach { instruction ->
            addBuildingBlock(instruction, ownerDocumentId, caseDocumentId, parentBuildingBlockInstanceId)
        }
    }

    private fun addBuildingBlock(
        instruction: AddBuildingBlockInstruction,
        ownerDocumentId: UUID,
        caseDocumentId: UUID,
        parentBuildingBlockInstanceId: UUID?,
    ) {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(
            instruction.buildingBlockKey, instruction.buildingBlockVersionTag
        )

        // Resolve the process(es) to hijack up front, per migration entry, dropping entries with no
        // match. A building block only exists to take ownership of a running process, so if there is
        // nothing to hijack we skip it entirely — no document, no instance — instead of leaving an
        // orphan block behind. This is a skip, not a failure: the rest of the migration continues.
        val processMigrations = instruction.processMigration
            .map { it to findHijackableProcesses(it, ownerDocumentId) }
            .filter { (_, processInstances) -> processInstances.isNotEmpty() }
        if (processMigrations.isEmpty()) {
            return
        }

        // 1. Create the building block's document + instance, linked to the owner. The document is
        // created already populated from the entry's dataMigration (read from the owner), so schema
        // validation at creation succeeds even when the building block's schema has required fields.
        // Step 2 still re-applies the full patch list against the persisted document (idempotent for
        // doc targets, and the path that handles any non-`doc:` targets).
        val initialContent = dataPatchApplier.resolveToContent(
            instruction.dataMigration,
            ownerDocumentId,
            instruction.buildingBlockKey
        )
        val request = NewDocumentRequest(
            instruction.buildingBlockKey,
            null,
            null,
            instruction.buildingBlockKey,
            instruction.buildingBlockVersionTag,
            initialContent,
        )
        val instance = runWithoutAuthorization {
            buildingBlockInstanceService.create(
                newDocumentRequest = request,
                caseDocumentId = caseDocumentId,
                parentBuildingBlockInstanceId = parentBuildingBlockInstanceId,
            )
        }

        // 2. Fill the new (empty) document: read from the owner, write into the building block.
        dataPatchApplier.apply(instruction.dataMigration, ownerDocumentId, instance.documentId)

        // 3. Hijack the resolved process(es) into the building block.
        processMigrations.forEach { (processInstruction, processInstances) ->
            hijackProcesses(processInstruction, processInstances, buildingBlockDefinitionId, instance)
        }
    }

    private fun findHijackableProcesses(
        instruction: ProcessMigrationInstruction,
        ownerDocumentId: UUID,
    ): List<ProcessInstance> =
        runtimeService.createProcessInstanceQuery()
            .processDefinitionKey(instruction.sourceProcessDefinitionKey)
            .processInstanceBusinessKey(ownerDocumentId.toString())
            .list()

    private fun hijackProcesses(
        instruction: ProcessMigrationInstruction,
        processInstances: List<ProcessInstance>,
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        instance: BuildingBlockInstance,
    ) {
        val targetDefinitionId = findTargetProcessDefinitionId(
            buildingBlockDefinitionId, instruction.targetProcessDefinitionKey
        ) ?: throw NoSuchElementException(
            "No process definition '${instruction.targetProcessDefinitionKey}' " +
                "found for building block definition '$buildingBlockDefinitionId'"
        )

        processInstances.forEach { processInstance ->
            migrate(instruction, processInstance.processDefinitionId, targetDefinitionId, processInstance.processInstanceId)
            processMigrationVariableResolver.apply(processInstance.processInstanceId, instruction.setProcessVariables)
            // The building block takes ownership: business key AND the process-document association both
            // repoint from the owner to the new building block document. The association must move too —
            // ProcessDocumentService.getDocumentId prefers the association over the business key, so
            // leaving it on the owner document would silently break the BB's end-event result sync.
            updateBusinessKey(processInstance.processInstanceId, instance.documentId.toString())
            associateWithBuildingBlockDocument(processInstance.processInstanceId, instance.documentId)
        }

        // The building block is driven by the highest process in the call-activity hierarchy that now
        // carries its document id as business key. That is NOT the absolute root process instance: the
        // owner's case/parent process sits above and keeps its own business key. The processes carrying
        // the building block's business key are exactly the ones just re-keyed above, so the top is the
        // hijacked instance whose super (calling) process instance is not itself hijacked.
        val hijackedIds = processInstances.map { it.processInstanceId }.toSet()
        val topProcessInstanceId = processInstances
            .map { it.processInstanceId }
            .filter { superProcessInstanceIdOf(it) !in hijackedIds }
            .distinct()
            .singleOrNull()
            ?: throw IllegalStateException(
                "Expected a single top-level hijacked process for building block '${instance.documentId}', " +
                    "but found none or multiple for '${instruction.sourceProcessDefinitionKey}'."
            )
        instance.processInstanceId = topProcessInstanceId
        recordCallActivityOrigin(instance, topProcessInstanceId)
        buildingBlockInstanceService.save(instance)
    }

    /** The super (calling) process instance id of [processInstanceId], or null if it is top-level. */
    private fun superProcessInstanceIdOf(processInstanceId: String): String? =
        runtimeService.createProcessInstanceQuery()
            .subProcessInstanceId(processInstanceId)
            .singleResult()
            ?.processInstanceId

    /**
     * When the top process was started by a call activity, mirror what [BuildingBlockCallActivityListener]
     * does for a natively-started building block, so a hijacked call-activity block behaves identically:
     *
     * 1. Record the caller's process definition and the call activity id. [DefaultBuildingBlockPluginConfigurationResolver]
     *    needs both to resolve plugin configuration via the call-activity mapping; without them it would
     *    wrongly fall back to the case-link mapping.
     * 2. Set the building block document id as a local variable on the call activity execution. This backs
     *    the call activity's `#{buildingBlockDocumentId}` expression and lets [BuildingBlockCallActivityListener]'s
     *    `onCallActivityEnd` run the END output mappings — the sync path that owns this block now that
     *    `callerProcessDefinitionId` is set (which makes `BuildingBlockEndEventListener` skip it).
     *
     * A top-level process (no super execution) leaves everything untouched, which is the case-link scenario.
     */
    private fun recordCallActivityOrigin(instance: BuildingBlockInstance, topProcessInstanceId: String) {
        val superExecution = operatonExecutionRepository.findById(topProcessInstanceId)
            .orElse(null)
            ?.superExecution
            ?: return
        instance.activityId = superExecution.activityId
        instance.callerProcessDefinitionId = superExecution.getProcessDefinitionId()
        runtimeService.setVariableLocal(
            superExecution.id, BUILDING_BLOCK_DOCUMENT_ID_VARIABLE, instance.documentId.toString()
        )
    }

    /**
     * Repoints the process-document association of [processInstanceId] to the building block document.
     * A hijacked process still carries the owner's association; [ProcessDocumentAssociationService.createProcessDocumentInstance]
     * refuses to overwrite an association pointing at a different document, so the stale one is removed first.
     */
    private fun associateWithBuildingBlockDocument(processInstanceId: String, buildingBlockDocumentId: UUID) {
        runWithoutAuthorization {
            val operatonProcessInstanceId = OperatonProcessInstanceId(processInstanceId)
            processDocumentAssociationService.findProcessDocumentInstance(operatonProcessInstanceId)
                .ifPresent { existing ->
                    processDocumentAssociationService.deleteProcessDocumentInstance(existing.processDocumentInstanceId())
                }
            processDocumentAssociationService.createProcessDocumentInstance(
                processInstanceId, buildingBlockDocumentId, null
            )
        }
    }

    private fun findTargetProcessDefinitionId(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        processDefinitionKey: String,
    ): String? {
        return processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(buildingBlockDefinitionId)
            .filter { it.processDefinitionKey == processDefinitionKey }
            // A building block can have several deployed versions of a process definition linked
            // (each redeploy adds one); target the current `main` version, not an arbitrary/older one.
            .let { matches -> matches.firstOrNull { it.main } ?: matches.firstOrNull() }
            ?.id
            ?.processDefinitionId
            ?.id
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
