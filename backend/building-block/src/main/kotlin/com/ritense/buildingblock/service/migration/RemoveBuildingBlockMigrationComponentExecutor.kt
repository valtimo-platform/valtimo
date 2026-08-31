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
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.RemoveBuildingBlockConfigurationRepository
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.case_.service.migration.MigrationDataPatchApplier
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.processdocument.migration.ProcessMigrationVariableResolver
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
import com.ritense.valtimo.contract.blueprint.migration.MigrationWarnings
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import io.github.oshai.kotlinlogging.KotlinLogging
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.migration.MigrationPlan
import org.springframework.core.annotation.Order
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** Dissolves every block an entry names below the owner, deepest first: hand the processes back, transfer data back, then delete document and instance. Runs in the case's transaction. */
// Order 400 — runs last: blocks are removed only after data and process migration and any additions.
@Order(400)
@Transactional
class RemoveBuildingBlockMigrationComponentExecutor(
    private val removeBuildingBlockConfigurationRepository: RemoveBuildingBlockConfigurationRepository,
    private val buildingBlockInstanceService: BuildingBlockInstanceService,
    private val buildingBlockOwnershipResolver: BuildingBlockOwnershipResolver,
    private val processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val documentService: DocumentService,
    private val runtimeService: RuntimeService,
    private val processMigrationVariableResolver: ProcessMigrationVariableResolver,
    private val processDocumentAssociationService: ProcessDocumentAssociationService,
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

        // A blank version can only come from a row stored before the field was required (G29); every rule below reads it.
        assertEveryEntryNamesAVersion(migrationId, instructions)

        val ownedBlocks = buildingBlockOwnershipResolver.subtreeOf(ownerDocumentId)

        // Before anything is deleted, so the failure names the whole tree rather than whatever half a partial run reached.
        assertNoOtherVersionIsStranded(migrationId, instructions, ownedBlocks)

        // Dissolving a block dissolves what it owns: nothing cascades in the persistence layer, so an unnamed child would survive pointing at a deleted parent (G25).
        val cascaded = cascadedFrom(instructions, ownedBlocks)

        // Deepest first, instances outside entries: one entry naming a parent and another its child would otherwise orphan the child (G25).
        val dissolved = mutableSetOf<BuildingBlockDefinitionId>()
        ownedBlocks.forEach { owned ->
            val instruction = instructions.firstOrNull { matches(it, owned) }
                ?: cascaded[owned.instance.id]
                ?: return@forEach
            dissolved += owned.instance.definition.id
            removeBuildingBlock(
                instruction = instruction,
                // A nested block hands back to its parent block at the parent's own version, not to the migrating case.
                ownerBlueprint = owned.parent?.definition?.id ?: target,
                ownerDocumentId = owned.parent?.documentId ?: ownerDocumentId,
                instance = owned.instance,
            )
        }

        warnEntriesThatDissolvedNothing(migrationId, instructions, dissolved, ownerDocumentId)
    }

    /** Blocks that go because an ancestor goes. Bare instructions — an unnamed block has nothing to hand its state back with — so each is warned about, naming the entry that took it down. */
    private fun cascadedFrom(
        instructions: List<RemoveBuildingBlockInstruction>,
        ownedBlocks: List<BuildingBlockOwnershipResolver.OwnedBuildingBlock>,
    ): Map<UUID, RemoveBuildingBlockInstruction> {
        val named = ownedBlocks.filter { owned -> instructions.any { matches(it, owned) } }
            .map { it.instance.id }
            .toSet()
        if (named.isEmpty()) {
            return emptyMap()
        }
        val byInstanceId = ownedBlocks.associateBy { it.instance.id }

        return ownedBlocks
            .filter { it.instance.id !in named && hasNamedAncestor(it, byInstanceId, named) }
            .associate { owned ->
                val definitionId = owned.instance.definition.id
                logger.warn {
                    "Building block '$definitionId' ('${owned.instance.documentId}') is dissolved along with " +
                        "the block above it, which the plan names; no entry names it, so its own data is not " +
                        "handed back anywhere. Add a 'removeBuildingBlock' entry for '$definitionId' to keep it."
                }
                MigrationWarnings.warn(
                    "Building block '$definitionId' was dissolved because the block above it was, and the plan " +
                        "has no 'removeBuildingBlock' entry for it — so its fields were not handed back to its " +
                        "owner. Add an entry for '$definitionId' with a 'dataMigration' to keep them."
                )
                owned.instance.id to RemoveBuildingBlockInstruction(
                    buildingBlockKey = definitionId.key,
                    buildingBlockVersionTag = definitionId.versionTag.toString(),
                )
            }
    }

    private fun hasNamedAncestor(
        owned: BuildingBlockOwnershipResolver.OwnedBuildingBlock,
        byInstanceId: Map<UUID, BuildingBlockOwnershipResolver.OwnedBuildingBlock>,
        named: Set<UUID>,
    ): Boolean {
        var parentId = owned.parent?.id
        while (parentId != null) {
            if (parentId in named) {
                return true
            }
            parentId = byInstanceId[parentId]?.parent?.id
        }
        return false
    }

    /** Fails the case when an entry names no version, which only a plan stored before the field was required can do (G29). The version is not derivable, so the repair is the author's. */
    private fun assertEveryEntryNamesAVersion(
        migrationId: BlueprintMigrationId,
        instructions: List<RemoveBuildingBlockInstruction>,
    ) {
        val versionless = instructions.filter { it.buildingBlockVersionTag.isBlank() }
        check(versionless.isEmpty()) {
            "Migration plan '$migrationId' has ${versionless.size} 'removeBuildingBlock' " +
                "${if (versionless.size == 1) "entry" else "entries"} naming no building block version " +
                "(${versionless.joinToString { "'${it.buildingBlockKey}'" }}). The entry was stored before a " +
                "version was required, and which version it meant cannot be recovered — dissolving whichever " +
                "version happens to be there is exactly what it may not do. Open the plan and save it again " +
                "with the version its instances are on."
        }
    }

    /** Whether [instruction] names exactly the building block version [owned] is on. */
    private fun matches(
        instruction: RemoveBuildingBlockInstruction,
        owned: BuildingBlockOwnershipResolver.OwnedBuildingBlock,
    ): Boolean = owned.instance.definition.id == idOf(instruction)

    /** Fails the case when a block sits on an unnamed version of a named key: nothing would link it afterwards, and unlike a plan an orphaned instance cannot be re-sourced (G24). */
    private fun assertNoOtherVersionIsStranded(
        migrationId: BlueprintMigrationId,
        instructions: List<RemoveBuildingBlockInstruction>,
        owned: List<BuildingBlockOwnershipResolver.OwnedBuildingBlock>,
    ) {
        val named = instructions.map { idOf(it) }
        val namedInstanceIds = owned.filter { block -> instructions.any { matches(it, block) } }
            .map { it.instance.id }
            .toSet()
        val byInstanceId = owned.associateBy { it.instance.id }
        owned.forEach { block ->
            val id = block.instance.definition.id
            if (named.contains(id) || hasNamedAncestor(block, byInstanceId, namedInstanceIds)) {
                return@forEach
            }
            val sameKey = named.filter { it.key == id.key }
            check(sameKey.isEmpty()) {
                "Migration plan '$migrationId' dissolves " +
                    "${sameKey.sortedBy { it.toString() }.joinToString { "'$it'" }}, but building block " +
                    "'${block.instance.documentId}' below this instance is on '$id', which no " +
                    "removeBuildingBlock entry names. Migrating past it would leave a building block the " +
                    "owner's new version no longer models, which no later migration can see or correct. " +
                    "Add a removeBuildingBlock entry for '$id' — with the dataMigration and " +
                    "processMigration that version needs — or point an existing entry at it."
            }
        }
    }

    /** Warns per entry that dissolved nothing (D13) — legitimate, so not fatal, but a plan dissolving nothing must be distinguishable from one that did its work. */
    private fun warnEntriesThatDissolvedNothing(
        migrationId: BlueprintMigrationId,
        instructions: List<RemoveBuildingBlockInstruction>,
        dissolved: Set<BuildingBlockDefinitionId>,
        ownerDocumentId: UUID,
    ) {
        instructions.map { idOf(it) }.distinct().filterNot { dissolved.contains(it) }.forEach { id ->
            MigrationWarnings.warn(
                "Migration plan '$migrationId' has a 'removeBuildingBlock' entry for '$id', but no such " +
                    "building block exists below '$ownerDocumentId', so the entry dissolved nothing for it."
            )
        }
    }

    private fun idOf(instruction: RemoveBuildingBlockInstruction) =
        BuildingBlockDefinitionId.of(instruction.buildingBlockKey, instruction.buildingBlockVersionTag)

    private fun removeBuildingBlock(
        instruction: RemoveBuildingBlockInstruction,
        ownerBlueprint: BlueprintId,
        ownerDocumentId: UUID,
        instance: BuildingBlockInstance,
    ) {
        // 1. Hand the process(es) back. `map` not `forEach`: every instruction has to run, the answer is read by step 3.
        val handedBack = instruction.processMigration
            .map { handBackProcesses(it, ownerBlueprint, ownerDocumentId, instance) }
            .any { it }

        // 2. Transfer data back: read from the building block, write into the owner.
        dataPatchApplier.apply(instruction.dataMigration, instance.documentId, ownerDocumentId)

        // 3. Delete the building block instance, then its JSON document (last).
        val documentId = instance.documentId
        assertNothingIsStillRunningOn(instruction, instance, handedBack)
        buildingBlockInstanceService.delete(instance.id)
        runWithoutAuthorization {
            documentService.deleteDocument(JsonSchemaDocumentId.existingId(documentId))
        }
    }

    /** Refuses to delete the document while its process still runs, naming the entry that should have handed it back — otherwise the author gets a raw engine stack trace. [handedBack] is what keeps a successful hand-back from tripping it. */
    private fun assertNothingIsStillRunningOn(
        instruction: RemoveBuildingBlockInstruction,
        instance: BuildingBlockInstance,
        handedBack: Boolean,
    ) {
        if (handedBack) {
            return
        }
        val processInstanceId = instance.processInstanceId ?: return
        val stillRunning = runtimeService.createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .singleResult() != null
        check(!stillRunning) {
            val named = instruction.processMigration
                .joinToString { "'${it.sourceProcessDefinitionKey}' -> '${it.targetProcessDefinitionKey}'" }
                .ifEmpty { "none" }
            "Cannot dissolve building block '${instance.definition.id}' of '${instance.documentId}': its " +
                "process '$processInstanceId' is still running and was not handed back, so deleting the " +
                "block's document would try to delete the history of a live process. The entry's " +
                "processMigration named $named. Add a processMigration handing that process back to the " +
                "owner's own process definition — an entry without one only works for a block whose " +
                "process has already finished."
        }
    }

    /** @return whether this instruction moved the block's process back to the owner — read by [assertNothingIsStillRunningOn]. */
    private fun handBackProcesses(
        instruction: ProcessMigrationInstruction,
        ownerBlueprint: BlueprintId,
        ownerDocumentId: UUID,
        instance: BuildingBlockInstance,
    ): Boolean {
        val processInstanceId = instance.processInstanceId ?: return false
        val processInstances = runtimeService.createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .processDefinitionKey(instruction.sourceProcessDefinitionKey)
            .list()
        if (processInstances.isEmpty()) {
            return false
        }

        val targetDefinitionId = findOwnerTargetProcessDefinitionId(
            ownerBlueprint, instruction.targetProcessDefinitionKey
        ) ?: throw NoSuchElementException(
            "No process definition '${instruction.targetProcessDefinitionKey}' found for owner " +
                "'$ownerBlueprint'"
        )

        processInstances.forEach { processInstance ->
            migrate(instruction, processInstance.processDefinitionId, targetDefinitionId, processInstance.processInstanceId)
            processMigrationVariableResolver.apply(processInstance.processInstanceId, instruction.setProcessVariables)
            // Business key and process-document association both repoint to the owner — the mirror of the way in.
            updateBusinessKey(processInstance.processInstanceId, ownerDocumentId.toString())
            associateWithOwnerDocument(processInstance.processInstanceId, ownerDocumentId)
        }
        return true
    }

    /** Repoints the association back to [ownerDocumentId]; leaving it would make deleting the block document try to delete a running process instance. The process name rides along (G43). */
    private fun associateWithOwnerDocument(processInstanceId: String, ownerDocumentId: UUID) {
        runWithoutAuthorization {
            val operatonProcessInstanceId = OperatonProcessInstanceId(processInstanceId)
            val existing = processDocumentAssociationService
                .findProcessDocumentInstance(operatonProcessInstanceId)
                .orElse(null)
            val processName = existing?.processName()?.takeIf { it.isNotBlank() }
            if (existing != null) {
                processDocumentAssociationService.deleteProcessDocumentInstance(existing.processDocumentInstanceId())
            }
            processDocumentAssociationService.createProcessDocumentInstance(
                processInstanceId, ownerDocumentId, processName
            )
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

    private companion object {
        val logger = KotlinLogging.logger {}
    }

}
