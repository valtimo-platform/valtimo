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

/**
 * Executes the `removeBuildingBlock` component for a single migrating instance (its owner — a case,
 * or a parent building block, identified by `ownerDocumentId`). Every building block an entry names
 * **anywhere below** that owner is dissolved — at any depth, **deepest first**, walked by
 * [BuildingBlockOwnershipResolver.subtreeOf].
 *
 * An entry names a building block **key and version** (both required), so the walk either finds exactly
 * what an entry describes or finds something the plan did not describe. The second case is never passed
 * over: a block on an unnamed version of a named key fails the case
 * ([assertNoOtherVersionIsStranded]), and an entry that dissolved nothing warns
 * ([warnEntriesThatDissolvedNothing]).
 *
 * Depth-first matters twice over. Dissolving deletes one instance row and no cascade, so a parent taken
 * out before its children leaves them pointing at a deleted instance and a document that no longer
 * exists (G25); and the ordering has to hold across the whole entry list, not within one entry, which is
 * why instances are iterated on the outside and matched to entries on the inside. Each block's state goes
 * back to **its own** owner at that owner's own version — for a nested block that is the parent block, not
 * the migrating case, which sits a level or more above and deploys different processes.
 *
 * Per block, in this fixed order (so nothing is lost before it is transferred back):
 *
 * 1. **hand back** the building block's process(es) to the owner: migrate them (Operaton) to the
 *    owner's target process definition, and set both the process business key *and* the
 *    process-document association back to the owner document — processes are never deleted;
 * 2. **transfer data back** via the entry's `dataMigration` (`source` read against the building
 *    block document, `target` written into the owner document);
 * 3. **delete** the building block's JSON document (last) and its instance.
 *
 * Runs synchronously in the caller's transaction, so it commits/rolls back with the whole case.
 */
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

        // A blank version can only come from a row stored before the field was required (G29). Refused
        // ahead of everything else: every rule below reads the version an entry names.
        assertEveryEntryNamesAVersion(migrationId, instructions)

        val ownedBlocks = buildingBlockOwnershipResolver.subtreeOf(ownerDocumentId)

        // Before anything is deleted, so the failure below names the tree the author has to fix rather
        // than whatever half of it a partial run had reached.
        assertNoOtherVersionIsStranded(migrationId, instructions, ownedBlocks)

        // Dissolving a block dissolves what it owns. A child whose parent is gone has no owner left to
        // hand its state back to, and nothing cascades in the persistence layer: its document, its
        // instance row and its process's business key would all survive, pointing at an instance that no
        // longer exists (G25). The plan does not have to name every level — the tree is runtime state,
        // and an author writing a plan cannot know how deep a given case nested — but every level it did
        // not name is dissolved as part of its parent and reported.
        val cascaded = cascadedFrom(instructions, ownedBlocks)

        // Deepest first, and instances in the outer loop: ordering has to hold across the whole entry list,
        // not within each entry. One entry naming a parent and another naming its child would otherwise
        // dissolve the parent first and orphan the child (G25).
        val dissolved = mutableSetOf<BuildingBlockDefinitionId>()
        ownedBlocks.forEach { owned ->
            val instruction = instructions.firstOrNull { matches(it, owned) }
                ?: cascaded[owned.instance.id]
                ?: return@forEach
            dissolved += owned.instance.definition.id
            removeBuildingBlock(
                instruction = instruction,
                // A nested block hands its state back to its parent block, at the parent's own version —
                // not to the migrating case, which is a level or more above and deploys different
                // processes. For a direct child the two are the same thing.
                ownerBlueprint = owned.parent?.definition?.id ?: target,
                ownerDocumentId = owned.parent?.documentId ?: ownerDocumentId,
                instance = owned.instance,
            )
        }

        warnEntriesThatDissolvedNothing(migrationId, instructions, dissolved, ownerDocumentId)
    }

    /**
     * The blocks that go because something above them goes: every owned block with a dissolved ancestor
     * that no entry names itself, mapped to the bare instruction that dissolves it.
     *
     * Bare because there is nothing for it to carry: an unnamed block has no `dataMigration` to hand its
     * fields back with and no `processMigration` to return its process by, so it is dissolved as it
     * stands — the document deleted, the process handed back to the nearest surviving owner. That is a
     * real loss of the block's own data, and the only alternative is worse: leaving a row pointing at a
     * deleted parent, which breaks the next migration *and* the running process. It is warned about per
     * block, naming the entry that took it down, so an author who wanted the data can add an entry.
     */
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

    /**
     * Fails the case when an entry names no version, which only a plan stored before the field was required
     * can do (G29 — every path that stores one refuses it, see [RemoveBuildingBlockVersionChecker]).
     *
     * Dissolving on the key alone is what this component stopped doing on purpose, so the entry cannot run;
     * and the version is not derivable, so nothing can fill it in on the author's behalf. What is left is to
     * say so, name the plan and the key, and point at the repair — which is now possible, because the plan
     * can be opened again ([RemoveBuildingBlockInstruction]).
     */
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

    /**
     * Fails the case when a building block below the owner is on a version of a key the plan *does* name,
     * at a version none of its entries do.
     *
     * The plan has declared authority over that key: it is dissolving it because the owner's new version
     * stopped modelling it. A block of that key left behind is therefore one nothing links any more —
     * alignment (R2) will find no candidate for it and leave it alone, forever and silently, which is the
     * G24 shape. The instance is left running against a blueprint that does not know it exists.
     *
     * Fatal rather than a warning, because the outcome is not repairable later: unlike a plan, an orphaned
     * instance cannot be re-sourced, and by the time anyone notices, the owner has migrated. The case
     * rolls back whole, and a dry run reports it as `WOULD_FAIL` — before anything is committed, which is
     * exactly where an author should learn that their fleet holds a version their plan does not mention.
     *
     * The fix is always in the plan: add an entry for the version that is actually there (with the data
     * and process mapping *that* version needs), or point this entry at it. Note the deliberate
     * consequence — an owner that legitimately keeps a second version of the same key alive cannot be
     * expressed while the plan dissolves the first, since there is no way to say "leave that one". That
     * needs one blueprint version linking two versions of one key, which is a configuration smell in its
     * own right; §10.2 records it.
     *
     * Only blocks that would **survive** the run can be stranded, so one below a block an entry names is
     * not one: it goes with its parent ([cascadedFrom]) and is warned about there. Checked here rather
     * than after that call so the case fails before any cascade warning has been recorded for work that
     * is not going to happen.
     */
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

    /**
     * Warns per entry that dissolved nothing (D13). Legitimate — a case may never have had this block, or
     * an earlier migration may already have dissolved it — so it cannot fail the case; but a plan that
     * dissolves nothing has to be distinguishable from one that did its work, which it was not: the walk
     * simply found no match and moved on. A version an entry names but the fleet never had reads exactly
     * like a plan doing its job, and this is what says otherwise.
     */
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
        // 1. Hand the process(es) back to the owner (business key → owner document id).
        instruction.processMigration.forEach { processInstruction ->
            handBackProcesses(processInstruction, ownerBlueprint, ownerDocumentId, instance)
        }

        // 2. Transfer data back: read from the building block, write into the owner.
        dataPatchApplier.apply(instruction.dataMigration, instance.documentId, ownerDocumentId)

        // 3. Delete the building block instance, then its JSON document (last).
        val documentId = instance.documentId
        assertNothingIsStillRunningOn(instruction, instance)
        buildingBlockInstanceService.delete(instance.id)
        runWithoutAuthorization {
            documentService.deleteDocument(JsonSchemaDocumentId.existingId(documentId))
        }
    }

    /**
     * Refuses to delete a building block document while its process is **still running**, naming the entry
     * that would have handed it back.
     *
     * Deleting the document makes `ProcessDocumentDeletedEventListener` walk its process-document
     * associations and delete the *historic* process instance of each, which Operaton refuses for a running
     * process (`BadUserRequestException: instance.getEndTime() is null`). The case fails either way, so
     * this changes no outcome — it changes the message. Without it the author gets a raw engine stack trace
     * naming an internal history entity; with it they get the entry, the block and the missing
     * `processMigration`, which is the actual mistake. The same shape is legitimate on the way *in* (an
     * entry with no `processMigration` is how a block gets adopted from the tree, see
     * [AddBuildingBlockProcessChecker]), so authors will reasonably write it here too and need telling why
     * it does not work in this direction.
     *
     * Not a save-path check: whether a block still has a running process is a per-case runtime fact, so an
     * entry with no `processMigration` is perfectly valid for a block whose work has finished.
     */
    private fun assertNothingIsStillRunningOn(
        instruction: RemoveBuildingBlockInstruction,
        instance: BuildingBlockInstance,
    ) {
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

    private fun handBackProcesses(
        instruction: ProcessMigrationInstruction,
        ownerBlueprint: BlueprintId,
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

        val targetDefinitionId = findOwnerTargetProcessDefinitionId(
            ownerBlueprint, instruction.targetProcessDefinitionKey
        ) ?: throw NoSuchElementException(
            "No process definition '${instruction.targetProcessDefinitionKey}' found for owner " +
                "'$ownerBlueprint'"
        )

        processInstances.forEach { processInstance ->
            migrate(instruction, processInstance.processDefinitionId, targetDefinitionId, processInstance.processInstanceId)
            processMigrationVariableResolver.apply(processInstance.processInstanceId, instruction.setProcessVariables)
            // Ownership returns to the owner: business key AND the process-document association both
            // repoint from the building block to the owner document — the exact mirror of what
            // AddBuildingBlockMigrationComponentExecutor does on the way in.
            updateBusinessKey(processInstance.processInstanceId, ownerDocumentId.toString())
            associateWithOwnerDocument(processInstance.processInstanceId, ownerDocumentId)
        }
    }

    /**
     * Repoints the process-document association of [processInstanceId] from the building block back to
     * [ownerDocumentId].
     *
     * Leaving it on the building block document breaks two things. `ProcessDocumentService.getDocumentId`
     * prefers the association over the business key, so the handed-back process would still resolve to a
     * document that is about to be deleted. Worse, deleting the building block document (step 3) makes
     * `ProcessDocumentDeletedEventListener` walk that document's associations and delete the *historic*
     * process instance of each — which Operaton refuses for a process that is still running, failing the
     * whole case. A handed-back process is exactly that: still running.
     *
     * The process name rides along, the same way it does on the way in: it is the label the progress tab
     * puts on the process, and handing a process back does not rename it (G43).
     */
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
