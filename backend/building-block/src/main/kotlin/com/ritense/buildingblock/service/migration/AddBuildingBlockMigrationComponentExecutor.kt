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

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.domain.migration.AddBuildingBlockInstruction
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.AddBuildingBlockConfigurationRepository
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.case_.service.migration.MigrationDataPatchApplier
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.processdocument.migration.ProcessMigrationVariableResolver
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
import com.ritense.valtimo.contract.blueprint.migration.MigrationWarnings
import com.ritense.valtimo.contract.buildingblock.BuildingBlockConstants.Companion.BUILDING_BLOCK_DOCUMENT_ID_VARIABLE
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import com.ritense.valtimo.operaton.findProcessDefinitionOrNull
import com.ritense.valtimo.operaton.repository.OperatonExecutionRepository
import com.ritense.valueresolver.ValueResolverService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.springframework.core.annotation.Order
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** Executes `addBuildingBlock`: hijacks the owner's own processes by business key, then walks the running tree adopting declared call activities. */
// Order 300 — after processMigration (@200) puts the owner on the target version, before removeBuildingBlock (@400) and alignment (@500).
@Order(300)
@Transactional
class AddBuildingBlockMigrationComponentExecutor(
    private val objectMapper: ObjectMapper,
    private val addBuildingBlockConfigurationRepository: AddBuildingBlockConfigurationRepository,
    private val buildingBlockInstanceService: BuildingBlockInstanceService,
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val processLinkService: ProcessLinkService,
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
    private val runtimeService: RuntimeService,
    private val repositoryService: RepositoryService,
    private val operatonExecutionRepository: OperatonExecutionRepository,
    private val processMigrationVariableResolver: ProcessMigrationVariableResolver,
    private val processDocumentAssociationService: ProcessDocumentAssociationService,
    private val valueResolverService: ValueResolverService,
    private val dataPatchApplier: MigrationDataPatchApplier,
    private val addBuildingBlockLinkChecker: AddBuildingBlockLinkChecker,
    private val addBuildingBlockProcessChecker: AddBuildingBlockProcessChecker,
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

        // Resolved once and shared by both checks below — the walk behind it is the dominant cost per instance.
        val adoptable = linkedBuildingBlockVersionResolver.resolveCallActivityReachable(target)

        // Also checked here: a plan deployed from a file never passes the save path.
        addBuildingBlockLinkChecker.assertLinked(target, instructions, adoptable)

        addBuildingBlockProcessChecker.assertHijacksSomething(target, instructions, adoptable)

        // Owner is a case (no block for its document id) or a parent block.
        val parent = buildingBlockInstanceRepository.findByDocumentId(ownerDocumentId)
        val caseDocumentId = parent?.caseDocumentId ?: ownerDocumentId
        val parentBuildingBlockInstanceId = parent?.id

        // Whole index in one walk — resolving per hop re-walked the tree each time.
        val callActivityLinks = linkedBuildingBlockVersionResolver.resolveCallActivityLinkIndex(target)

        // Entries that produced a block; pass 1 stays quiet for what pass 2 may take.
        val satisfied = mutableSetOf<BuildingBlockDefinitionId>()

        // Pass 1 — the owner's own processes, by business key.
        instructions.forEach { instruction ->
            hijack(instruction, ownerDocumentId, caseDocumentId, parentBuildingBlockInstanceId, adoptable, satisfied)
        }

        // Pass 2 — the running tree.
        takeOverTreeBelow(
            target = target,
            parentProcessInstanceIds = topProcessInstancesOf(ownerDocumentId),
            ownerDocumentId = ownerDocumentId,
            parentBuildingBlockInstanceId = parentBuildingBlockInstanceId,
            caseDocumentId = caseDocumentId,
            instructions = instructions,
            satisfied = satisfied,
            callActivityLinks = callActivityLinks,
            depth = 0,
        )

        reportEntriesNeitherPassReached(instructions, ownerDocumentId, adoptable, satisfied)
    }

    /** Warns once when the component created nothing at all; per-entry misses go to the log only (D13). */
    private fun reportEntriesNeitherPassReached(
        instructions: List<AddBuildingBlockInstruction>,
        ownerDocumentId: UUID,
        adoptable: Set<BuildingBlockDefinitionId>,
        satisfied: Set<BuildingBlockDefinitionId>,
    ) {
        val unreached = instructions
            .map { BuildingBlockDefinitionId.of(it.buildingBlockKey, it.buildingBlockVersionTag) }
            .distinct()
            .filter { it in adoptable && it !in satisfied }

        unreached.forEach { block ->
            logger.info {
                "Building block '$block' was not added to '$ownerDocumentId': the plan authorises it and " +
                    "the target declares it on a call activity, but no running process was reached that " +
                    "the declaring call activity had started. Either this owner is not (or no longer) " +
                    "running that work, or a call activity above it was left a plain sub-process — a " +
                    "process left behind keeps running the old deployment, and the link declaring this " +
                    "block sits on the building block's deployment, where the walk does not look. " +
                    "Authorising the level above as well is what makes this one reachable."
            }
        }

        if (unreached.isEmpty() || satisfied.isNotEmpty()) {
            return
        }

        val message = "No building block was added to '$ownerDocumentId': the plan authorises " +
            "${unreached.size} block(s) that '$ownerDocumentId' does not run, and none of them could be " +
            "reached (" + unreached.sortedBy { it.toString() }.joinToString { "'$it'" } + "). Either this " +
            "owner is not (or no longer) running any of that work, or a call activity above them was left " +
            "a plain sub-process, which keeps its process on the old deployment and hides everything below " +
            "it from the walk — authorising that level as well is what makes these reachable."
        logger.warn { message }
        MigrationWarnings.warn(message)
    }

    // Pass 1: by business key

    private fun hijack(
        instruction: AddBuildingBlockInstruction,
        ownerDocumentId: UUID,
        caseDocumentId: UUID,
        parentBuildingBlockInstanceId: UUID?,
        adoptable: Set<BuildingBlockDefinitionId>,
        satisfied: MutableSet<BuildingBlockDefinitionId>,
    ) {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(
            instruction.buildingBlockKey, instruction.buildingBlockVersionTag
        )

        // No match is a skip, not a failure — but never silent: a wrong process key looks identical.
        val processMigrations = instruction.processMigration
            .map { instruction ->
                instruction to findHijackableProcesses(instruction, ownerDocumentId)
                    .filterNot { ownedByTheWalk(it, buildingBlockDefinitionId, adoptable) }
            }
            .filter { (_, processInstances) -> processInstances.isNotEmpty() }
        if (processMigrations.isEmpty()) {
            if (buildingBlockDefinitionId in adoptable) {
                logger.debug {
                    "Building block '$buildingBlockDefinitionId' was not hijacked for '$ownerDocumentId'; " +
                        "the target declares it on a call activity, so the tree walk will resolve it."
                }
                return
            }
            val skipped = "Building block '$buildingBlockDefinitionId' was not added to '$ownerDocumentId': " +
                "none of its processMigration entries (" +
                instruction.processMigration.joinToString { "'${it.sourceProcessDefinitionKey}'" } +
                ") matched a running process with business key '$ownerDocumentId'. Adding a building " +
                "block takes over a process the owner is already running; there is nothing to take over."
            logger.warn { skipped }
            MigrationWarnings.warn(skipped)
            return
        }

        // Pre-populated so validation passes when the block's schema has required fields.
        val initialContent = dataPatchApplier.resolveToContent(
            instruction.dataMigration,
            ownerDocumentId,
            instruction.buildingBlockKey
        )
        val instance = runWithoutAuthorization {
            buildingBlockInstanceService.create(
                newDocumentRequest = NewDocumentRequest(
                    instruction.buildingBlockKey,
                    null,
                    null,
                    instruction.buildingBlockKey,
                    instruction.buildingBlockVersionTag,
                    initialContent,
                ),
                caseDocumentId = caseDocumentId,
                parentBuildingBlockInstanceId = parentBuildingBlockInstanceId,
            )
        }
        dataPatchApplier.apply(instruction.dataMigration, ownerDocumentId, instance.documentId)

        processMigrations.forEach { (processInstruction, processInstances) ->
            hijackProcesses(processInstruction, processInstances, buildingBlockDefinitionId, instance, satisfied)
        }
    }

    /** Links decide the route, never whether the plan names a process key — a child inherits the owner's business key. */
    private fun ownedByTheWalk(
        processInstance: ProcessInstance,
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        adoptable: Set<BuildingBlockDefinitionId>,
    ): Boolean = buildingBlockDefinitionId in adoptable &&
        callingExecutionOf(processInstance.processInstanceId) != null

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
        satisfied: MutableSet<BuildingBlockDefinitionId>,
    ) {
        val targetDefinitionId = findTargetProcessDefinitionId(
            buildingBlockDefinitionId, instruction.targetProcessDefinitionKey
        ) ?: throw NoSuchElementException(
            "No process definition '${instruction.targetProcessDefinitionKey}' " +
                "found for building block definition '$buildingBlockDefinitionId'"
        )

        processInstances.forEach { processInstance ->
            takeOver(
                processInstanceId = processInstance.processInstanceId,
                sourceDefinitionId = processInstance.processDefinitionId,
                targetDefinitionId = targetDefinitionId,
                processMigration = instruction,
                buildingBlockDocumentId = instance.documentId,
            )
        }

        // Not the absolute root: the owner's process sits above with its own business key.
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
        satisfied += buildingBlockDefinitionId
    }

    /** Mirrors [BuildingBlockCallActivityListener] so a hijacked call-activity block behaves like a natively started one. */
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

    // Pass 2: by walking the running tree

    /** The owner's own running processes; descendants inherited the business key and are reached by the walk itself. */
    private fun topProcessInstancesOf(ownerDocumentId: UUID): List<String> {
        val own = runtimeService.createProcessInstanceQuery()
            .processInstanceBusinessKey(ownerDocumentId.toString())
            .list()
            .map { it.processInstanceId }
            .toSet()
        return own.filter { superProcessInstanceIdOf(it) !in own }
    }

    private fun takeOverTreeBelow(
        target: BlueprintId,
        parentProcessInstanceIds: List<String>,
        ownerDocumentId: UUID,
        parentBuildingBlockInstanceId: UUID?,
        caseDocumentId: UUID,
        instructions: List<AddBuildingBlockInstruction>,
        satisfied: MutableSet<BuildingBlockDefinitionId>,
        /** [target]'s call activities by (process definition key, activity id) — resolved once per instance. */
        callActivityLinks: Map<Pair<String, String>, BuildingBlockProcessLink>,
        depth: Int,
    ) {
        if (parentProcessInstanceIds.isEmpty()) {
            return
        }
        check(depth <= MAX_DEPTH) {
            "Refusing to take over building blocks more than $MAX_DEPTH levels below '$caseDocumentId'; " +
                "the running process tree is either cyclic or deeper than any blueprint should be."
        }

        parentProcessInstanceIds.forEach { parentProcessInstanceId ->
            childProcessInstancesOf(parentProcessInstanceId).forEach { childProcessInstanceId ->
                val callingExecution = callingExecutionOf(childProcessInstanceId)
                    ?: return@forEach // not started by a call activity; nothing declares it

                val existing = buildingBlockInstanceRepository.findByProcessInstanceId(childProcessInstanceId)
                    ?: instanceRecordedOn(callingExecution.id)
                if (existing?.processInstanceId != null) {
                    // Already a block with a process — an entry naming it has been honoured (G30).
                    satisfied += existing.definition.id
                    takeOverTreeBelow(
                        target, listOf(childProcessInstanceId), existing.documentId, existing.id, caseDocumentId,
                        instructions, satisfied, callActivityLinks, depth + 1,
                    )
                    return@forEach
                }

                val callerActivityId = callingExecution.activityId
                val callerDefinitionId = callingExecution.getProcessDefinitionId()
                // A caller left as a plain sub-process still runs the old deployment; fall back to the target model by caller key (G23/G30).
                val link = callerActivityId?.let { activityId ->
                    buildingBlockLinkOf(callerDefinitionId, activityId)
                        ?: keyOfDefinition(callerDefinitionId)?.let { callerProcessDefinitionKey ->
                            callActivityLinks[callerProcessDefinitionKey to activityId]
                        }
                }
                if (link == null) {
                    // Plain sub-process in the target too — but a call activity further down may still be declared.
                    takeOverTreeBelow(
                        target,
                        listOf(childProcessInstanceId),
                        ownerDocumentId,
                        parentBuildingBlockInstanceId,
                        caseDocumentId,
                        instructions,
                        satisfied,
                        callActivityLinks,
                        depth + 1,
                    )
                    return@forEach
                }

                val adopted = adopt(
                    childProcessInstanceId = childProcessInstanceId,
                    link = link,
                    existing = existing,
                    ownerDocumentId = ownerDocumentId,
                    parentBuildingBlockInstanceId = parentBuildingBlockInstanceId,
                    caseDocumentId = caseDocumentId,
                    callingExecutionId = callingExecution.id,
                    callerActivityId = callerActivityId,
                    callerProcessDefinitionId = callingExecution.getProcessDefinitionId(),
                    instructions = instructions,
                )
                if (adopted != null) {
                    satisfied += link.buildingBlockDefinitionId
                }
                takeOverTreeBelow(
                    target,
                    listOf(childProcessInstanceId),
                    adopted?.documentId ?: ownerDocumentId,
                    adopted?.id ?: parentBuildingBlockInstanceId,
                    caseDocumentId,
                    instructions,
                    satisfied,
                    callActivityLinks,
                    depth + 1,
                )
            }
        }
    }

    /** Gives [childProcessInstanceId] the identity of the block [link] declares, or null having said why. */
    private fun adopt(
        childProcessInstanceId: String,
        link: BuildingBlockProcessLink,
        existing: BuildingBlockInstance?,
        ownerDocumentId: UUID,
        parentBuildingBlockInstanceId: UUID?,
        caseDocumentId: UUID,
        callingExecutionId: String,
        callerActivityId: String,
        callerProcessDefinitionId: String,
        instructions: List<AddBuildingBlockInstruction>,
    ): BuildingBlockInstance? {
        val buildingBlockDefinitionId = link.buildingBlockDefinitionId
        val processDefinitionKey = processDefinitionKeyOf(childProcessInstanceId)

        // An unauthorised block is left as it is — said out loud, since a case started on this version would have one.
        val instruction = instructions.firstOrNull {
            BuildingBlockDefinitionId.of(it.buildingBlockKey, it.buildingBlockVersionTag) == buildingBlockDefinitionId
        }
        if (instruction == null) {
            val skipped = "Left the running process '$processDefinitionKey' of '$ownerDocumentId' as a plain " +
                "sub-process: activity '$callerActivityId' declares building block " +
                "'$buildingBlockDefinitionId', but the plan has no 'addBuildingBlock' entry for it. A case " +
                "started on this version would have that block, so this one now differs. Add an entry for " +
                "'$buildingBlockDefinitionId', or drop the building-block link from the call activity."
            logger.warn { skipped }
            MigrationWarnings.warn(skipped)
            return null
        }

        val targetDefinitionId = findTargetProcessDefinitionId(buildingBlockDefinitionId, processDefinitionKey)
        if (targetDefinitionId == null) {
            val skipped = "Left the running process '$processDefinitionKey' of '$ownerDocumentId' as a plain " +
                "sub-process: activity '$callerActivityId' declares building block " +
                "'$buildingBlockDefinitionId', but that version does not deploy '$processDefinitionKey', so " +
                "there is nothing to migrate the running process onto."
            logger.warn { skipped }
            MigrationWarnings.warn(skipped)
            return null
        }

        val instance = when {
            existing == null -> createAdoptedInstance(
                link, instruction, ownerDocumentId, caseDocumentId, parentBuildingBlockInstanceId,
                childProcessInstanceId, callerActivityId, callerProcessDefinitionId,
            )

            // Listener-created block with no process: a link attaches to every deployment sharing the key (G21).
            existing.definition.id == buildingBlockDefinitionId -> {
                existing.processInstanceId = childProcessInstanceId
                existing.activityId = callerActivityId
                existing.callerProcessDefinitionId = callerProcessDefinitionId
                // Re-home it: the listener had no parent block to find, this pass does.
                existing.parentBuildingBlockInstanceId = parentBuildingBlockInstanceId
                existing.rootBuildingBlockInstanceId = parentBuildingBlockInstanceId?.let {
                    buildingBlockInstanceRepository.findById(it).orElse(null)?.rootBuildingBlockInstanceId ?: it
                }
                buildingBlockInstanceService.save(existing)
            }

            else -> {
                val skipped = "Left the running process '$processDefinitionKey' of '$ownerDocumentId' alone: " +
                    "activity '$callerActivityId' declares '$buildingBlockDefinitionId', but a building block " +
                    "'${existing.definition.id}' already exists for it. Upgrading it is version alignment's " +
                    "job, and it needs a plan from '${existing.definition.id}' to '$buildingBlockDefinitionId'."
                logger.warn { skipped }
                MigrationWarnings.warn(skipped)
                return null
            }
        }

        takeOver(
            processInstanceId = childProcessInstanceId,
            sourceDefinitionId = processDefinitionIdOf(childProcessInstanceId),
            targetDefinitionId = targetDefinitionId,
            processMigration = processMigrationFor(instruction, processDefinitionKey),
            buildingBlockDocumentId = instance.documentId,
        )

        // Backs the call activity's `#{buildingBlockDocumentId}` and the listener's END output mappings.
        runtimeService.setVariableLocal(
            callingExecutionId, BUILDING_BLOCK_DOCUMENT_ID_VARIABLE, instance.documentId.toString()
        )

        logger.info {
            "Took over running process '$processDefinitionKey' ('$childProcessInstanceId') of " +
                "'$ownerDocumentId' as building block '$buildingBlockDefinitionId' " +
                "(document '${instance.documentId}')"
        }
        return instance
    }

    /** Creates the block's document from the link's inputMappings plus the entry's dataMigration; `pv:` sources are reported, not dropped. */
    private fun createAdoptedInstance(
        link: BuildingBlockProcessLink,
        instruction: AddBuildingBlockInstruction,
        ownerDocumentId: UUID,
        caseDocumentId: UUID,
        parentBuildingBlockInstanceId: UUID?,
        childProcessInstanceId: String,
        callerActivityId: String,
        callerProcessDefinitionId: String,
    ): BuildingBlockInstance {
        val (resolvable, unresolvable) = link.inputMappings.partition { !it.source.startsWith(PROCESS_VARIABLE_PREFIX) }
        if (unresolvable.isNotEmpty()) {
            val message = "Building block '${link.buildingBlockDefinitionId}' was taken over without " +
                unresolvable.joinToString { "'${it.source}'" } +
                ": a process-variable source cannot be read while migrating, only when the call activity runs."
            logger.warn { message }
            MigrationWarnings.warn(message)
        }

        val resolvedValues = valueResolverService.resolveValues(
            ownerDocumentId.toString(), resolvable.map { it.source }
        )
        val valuesToHandle = resolvable.associate { it.getPrefixedTarget() to resolvedValues[it.source] }
        val preProcessValues = valueResolverService.preProcessValuesForNewDocument(
            valuesToHandle, link.buildingBlockDefinitionId.key
        )
        val documentContent = objectMapper.valueToTree<JsonNode>(preProcessValues[DOC_PREFIX])

        val instance = runWithoutAuthorization {
            buildingBlockInstanceService.create(
                newDocumentRequest = NewDocumentRequest(
                    null,
                    null,
                    null,
                    link.buildingBlockDefinitionId.key,
                    link.buildingBlockDefinitionId.versionTag.toString(),
                    documentContent,
                ),
                caseDocumentId = caseDocumentId,
                activityId = callerActivityId,
                parentBuildingBlockInstanceId = parentBuildingBlockInstanceId,
                processInstanceId = childProcessInstanceId,
                callerProcessDefinitionId = callerProcessDefinitionId,
            )
        }

        val nonDocumentValues = preProcessValues.filterKeys { !it.startsWith(DOC_PREFIX) }
        if (nonDocumentValues.isNotEmpty()) {
            valueResolverService.handleValues(instance.documentId, nonDocumentValues)
        }

        dataPatchApplier.apply(instruction.dataMigration, ownerDocumentId, instance.documentId)
        return instance
    }

    private fun processMigrationFor(
        instruction: AddBuildingBlockInstruction,
        processDefinitionKey: String,
    ): ProcessMigrationInstruction? =
        instruction.processMigration.firstOrNull {
            it.targetProcessDefinitionKey == processDefinitionKey ||
                it.sourceProcessDefinitionKey == processDefinitionKey
        }

    // Shared: everything after "which process?"

    /** Migrates the process onto the block's deployment and moves both business key and process-document association (G17). */
    private fun takeOver(
        processInstanceId: String,
        sourceDefinitionId: String,
        targetDefinitionId: String,
        processMigration: ProcessMigrationInstruction?,
        buildingBlockDocumentId: UUID,
    ) {
        migrate(processInstanceId, sourceDefinitionId, targetDefinitionId, processMigration)
        processMigrationVariableResolver.apply(processInstanceId, processMigration?.setProcessVariables.orEmpty())
        updateBusinessKey(processInstanceId, buildingBlockDocumentId.toString())
        associateWithBuildingBlockDocument(processInstanceId, buildingBlockDocumentId)
    }

    private fun migrate(
        processInstanceId: String,
        sourceDefinitionId: String,
        targetDefinitionId: String,
        processMigration: ProcessMigrationInstruction?,
    ) {
        if (sourceDefinitionId == targetDefinitionId) {
            return // already on the block's deployment; only its identity was missing
        }
        val plan = runtimeService.createMigrationPlan(sourceDefinitionId, targetDefinitionId)
            .mapEqualActivities()
            .also { builder ->
                processMigration?.mapActivities?.forEach { (source, target) ->
                    builder.mapActivities(source, target)
                }
            }
            .build()

        var builder = runtimeService.newMigration(plan).processInstanceIds(listOf(processInstanceId))
        if (processMigration?.skipCustomListeners == true) {
            builder = builder.skipCustomListeners()
        }
        if (processMigration?.skipIoMappings == true) {
            builder = builder.skipIoMappings()
        }
        builder.execute() // synchronous — joins the current transaction
    }

    private fun updateBusinessKey(processInstanceId: String, businessKey: String) {
        jdbcTemplate.update(
            "UPDATE ACT_RU_EXECUTION SET BUSINESS_KEY_ = ? WHERE ID_ = ?",
            businessKey, processInstanceId
        )
    }

    /** Repoints the association — the stale one is removed first, and the label must survive the delete/recreate (G43). */
    private fun associateWithBuildingBlockDocument(processInstanceId: String, buildingBlockDocumentId: UUID) {
        runWithoutAuthorization {
            val operatonProcessInstanceId = OperatonProcessInstanceId(processInstanceId)
            val existing = processDocumentAssociationService
                .findProcessDocumentInstance(operatonProcessInstanceId)
                .orElse(null)
            val processName = existing?.processName()?.takeIf { it.isNotBlank() }
                ?: nameOfRunningProcess(processInstanceId)?.takeIf { it.isNotBlank() }
            if (existing != null) {
                processDocumentAssociationService.deleteProcessDocumentInstance(existing.processDocumentInstanceId())
            }
            processDocumentAssociationService.createProcessDocumentInstance(
                processInstanceId, buildingBlockDocumentId, processName
            )
        }
    }

    private fun findTargetProcessDefinitionId(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        processDefinitionKey: String,
    ): String? =
        processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(buildingBlockDefinitionId)
            .filter { it.processDefinitionKey == processDefinitionKey }
            // Several deployed versions can be linked; target the current main one.
            .let { matches -> matches.firstOrNull { it.main } ?: matches.firstOrNull() }
            ?.id
            ?.processDefinitionId
            ?.id

    // Running-tree lookups

    private fun childProcessInstancesOf(processInstanceId: String): List<String> =
        runtimeService.createProcessInstanceQuery()
            .superProcessInstanceId(processInstanceId)
            .list()
            .map { it.processInstanceId }

    private fun superProcessInstanceIdOf(processInstanceId: String): String? =
        runtimeService.createProcessInstanceQuery()
            .subProcessInstanceId(processInstanceId)
            .singleResult()
            ?.processInstanceId

    private fun callingExecutionOf(processInstanceId: String) =
        operatonExecutionRepository.findById(processInstanceId).orElse(null)?.superExecution

    /** The block recorded on the call activity execution — the only handle on one whose processInstanceId was never filled in. */
    private fun instanceRecordedOn(callingExecutionId: String): BuildingBlockInstance? {
        val documentId = runtimeService.getVariableLocal(callingExecutionId, BUILDING_BLOCK_DOCUMENT_ID_VARIABLE)
            as? String ?: return null
        return runCatching { UUID.fromString(documentId) }.getOrNull()
            ?.let { buildingBlockInstanceRepository.findByDocumentId(it) }
    }

    private fun buildingBlockLinkOf(processDefinitionId: String, activityId: String): BuildingBlockProcessLink? =
        processLinkService.getProcessLinks(processDefinitionId, activityId)
            .filterIsInstance<BuildingBlockProcessLink>()
            .firstOrNull()

    /** Fallback only: an association that already carries a name keeps it. */
    private fun nameOfRunningProcess(processInstanceId: String): String? =
        runtimeService.createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .singleResult()
            ?.processDefinitionId
            ?.let { repositoryService.findProcessDefinitionOrNull(it)?.name }

    private fun processDefinitionIdOf(processInstanceId: String): String =
        runtimeService.createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .singleResult()
            .processDefinitionId

    private fun processDefinitionKeyOf(processInstanceId: String): String =
        repositoryService.getProcessDefinition(processDefinitionIdOf(processInstanceId)).key

    /** Null once the deployment is gone — not a reason to fail the case. */
    private fun keyOfDefinition(processDefinitionId: String): String? =
        repositoryService.findProcessDefinitionOrNull(processDefinitionId)?.key

    private companion object {
        private const val DOC_PREFIX = "doc"
        private const val PROCESS_VARIABLE_PREFIX = "pv:"

        /** Runaway backstop for the tree walk. */
        private const val MAX_DEPTH = 20
        val logger = KotlinLogging.logger {}
    }
}
