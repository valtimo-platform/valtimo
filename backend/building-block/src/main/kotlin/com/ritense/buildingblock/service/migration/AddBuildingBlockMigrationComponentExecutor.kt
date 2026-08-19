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

/**
 * Executes the `addBuildingBlock` component for a single migrating instance — its owner, a case or a
 * parent building block, identified by [ownerDocumentId].
 *
 * ### One mechanism, two ways of finding the process
 *
 * An entry names a building block and a version: *this plan may create that block*. It never says where
 * in the running tree it is, because depth is a property of the individual case rather than of the plan
 * (D14). So the backend finds the process to take over, two ways, and never asks the author which one
 * applied:
 *
 * - **by business key** — a process the owner is running directly, matched on the entry's
 *   `processMigration.sourceProcessDefinitionKey` plus `businessKey == ownerDocumentId`. This is the
 *   original hijack, and it is the only route for a block the owner offers as a *startable item*, where
 *   no call activity declares it and the process is top-level.
 * - **by walking the running tree** — parent/child executions from the owner's own processes downwards,
 *   adopting each child whose call activity declares exactly a block an entry authorises. Business keys
 *   are not consulted, which is what lets this reach any depth: a grandchild still carries the case's
 *   document id and no business-key query would ever attribute it to the block above it.
 *
 * Both routes end in the same operation — [takeOver]: migrate the process onto the block's deployment,
 * apply the entry's `setProcessVariables`, and move the business key *and* the process-document
 * association onto the block's document. Keeping that in one place is the point of this class: while the
 * two routes lived in separate executors they drifted, and `setProcessVariables`, `skipCustomListeners`
 * and `skipIoMappings` silently applied to a hijacked node and not to an adopted one — so which of an
 * author's fields took effect depended on which route happened to find the process.
 *
 * The two passes run in order, and that order matters: a block the first pass creates is an existing
 * block by the time the walk reaches it, so the walk descends *into* it and nests what it finds below
 * under it, rather than attributing those to the case.
 *
 * ### What the walk does per running child
 *
 * It is [com.ritense.buildingblock.processlink.service.BuildingBlockCallActivityListener] applied
 * retroactively — the listener creates a block when a declared call activity *starts*, this does the same
 * to call activities that already started — so a migrated case and a freshly-started one derive their
 * shape from the same authority, the links, and cannot disagree.
 *
 * 1. no calling execution → not started by a call activity; leave it;
 * 2. already a block **with a process** → descend into it, with it as the parent;
 * 3. its call activity carries no building-block link on the **caller's current** definition → the target
 *    version models this as a plain sub-process too; leave it, but keep walking, because a call activity
 *    further down may still be declared;
 * 4. a link, but no entry authorising that block → leave it, and **say so** (D13): a case started on this
 *    version would have the block, so this one now differs;
 * 5. otherwise take it over, and descend.
 *
 * Reading the link from the caller's *current* definition is what makes the recursion correct: by the
 * time a child is visited its caller has already been migrated — by the plan's own `processMigration`
 * (@200) for the first level, by this executor for every level below — so the links consulted are the
 * target version's. (The exception, and a live gap, is a child behind a hop that stays a plain
 * sub-process: its caller keeps running the old deployment. See G21/G23.)
 *
 * Only **running** processes are taken over. Work the case already finished keeps the flat shape in
 * history; there is no instance left to give an identity to.
 */
// Order 300 — after the case's own processMigration (@200), which puts the owner's processes on the
// target version so the links read from them are the target's; and before removeBuildingBlock (@400) and
// version alignment (@500). A block the target version dropped is declared by no call activity, so the
// walk cannot adopt one on its way to being dissolved, and a block taken over here is already on its
// linked version so alignment reads "linked == current" and no-ops.
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

        // Refuse before creating anything: a block whose version the target does not link is invisible
        // to every later migration (R2). Checked here as well as on the save path because a plan
        // deployed from a file never passes the save path; on a dry run this surfaces as WOULD_FAIL.
        // Deliberately ahead of the "nothing to take over" skips below — the plan is wrong either way.
        addBuildingBlockLinkChecker.assertLinked(target, instructions)

        // Same argument, same two call sites: an entry that can reach a process by neither route can
        // never create a building block — for any case, on any run. Refusing is the only way that
        // reaches the author; skipping it looks identical to a plan that worked.
        addBuildingBlockProcessChecker.assertHijacksSomething(target, instructions)

        // The owner is whatever instance the plan migrates: a case (no building block for its
        // document id) or a parent building block (in which case new blocks nest under it).
        val parent = buildingBlockInstanceRepository.findByDocumentId(ownerDocumentId)
        val caseDocumentId = parent?.caseDocumentId ?: ownerDocumentId
        val parentBuildingBlockInstanceId = parent?.id

        // Blocks this plan authorises that the target declares on a call activity, transitively: the
        // walk locates those from the running tree, so a business-key miss for one of them is not the
        // end of the story and must not be reported as one.
        val adoptable = linkedBuildingBlockVersionResolver.resolveCallActivityReachable(target)

        // Which entries actually produced a block. Pass 1 deliberately stays quiet for an entry the
        // target declares on a call activity, on the grounds that pass 2 will take it — so if pass 2
        // does not, nobody has spoken. This is what closes that gap.
        val satisfied = mutableSetOf<BuildingBlockDefinitionId>()

        // Pass 1 — the owner's own processes, by business key.
        instructions.forEach { instruction ->
            hijack(instruction, ownerDocumentId, caseDocumentId, parentBuildingBlockInstanceId, adoptable, satisfied)
        }

        // Pass 2 — the running tree, wherever a declared call activity meets an entry that authorises it.
        takeOverTreeBelow(
            target = target,
            parentProcessInstanceIds = topProcessInstancesOf(ownerDocumentId),
            ownerDocumentId = ownerDocumentId,
            parentBuildingBlockInstanceId = parentBuildingBlockInstanceId,
            caseDocumentId = caseDocumentId,
            instructions = instructions,
            satisfied = satisfied,
            depth = 0,
        )

        reportEntriesNeitherPassReached(instructions, ownerDocumentId, adoptable, satisfied)
    }

    /**
     * An entry the target declares on a call activity, that pass 1 skipped in silence and pass 2 never
     * reached, created nothing and said nothing. Neither pass can report it alone: pass 1 cannot know
     * whether the walk will get there, and pass 2 never sees an entry whose call activity it does not
     * visit. So it is reported here, where both answers are in.
     *
     * The usual cause is the one recorded as G23: a call activity *above* this one was left a plain
     * sub-process, so its process still runs the owner's old deployment, and the link declaring this block
     * lives on the building block's deployment where the walk never looks. The message says so, because
     * the fix is in the plan (authorise the level above) rather than in this entry.
     */
    private fun reportEntriesNeitherPassReached(
        instructions: List<AddBuildingBlockInstruction>,
        ownerDocumentId: UUID,
        adoptable: Set<BuildingBlockDefinitionId>,
        satisfied: Set<BuildingBlockDefinitionId>,
    ) {
        instructions
            .map { BuildingBlockDefinitionId.of(it.buildingBlockKey, it.buildingBlockVersionTag) }
            .distinct()
            .filter { it in adoptable && it !in satisfied }
            .forEach { unreached ->
                val message = "Building block '$unreached' was not added to '$ownerDocumentId': the plan " +
                    "authorises it and the target declares it on a call activity, but no running process " +
                    "was reached that the declaring call activity had started. Either this case is not (or " +
                    "no longer) running that work, or a call activity above it was left a plain " +
                    "sub-process — a process left behind keeps running the old deployment, and the link " +
                    "declaring this block sits on the building block's deployment, where the walk does not " +
                    "look. Authorising the level above as well is what makes this one reachable."
                logger.warn { message }
                MigrationWarnings.warn(message)
            }
    }

    // ---------------------------------------------------------------------------------------------
    // Pass 1: by business key
    // ---------------------------------------------------------------------------------------------

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

        // Resolve the process(es) up front, dropping the entries with no match. A building block only
        // exists to take ownership of a running process, so if there is nothing to take over we skip
        // entirely — no document, no instance — instead of leaving an orphan block behind. This is a
        // skip, not a failure: the rest of the migration continues.
        //
        // But it is never a *silent* skip. Whether this owner happens to have a matching process is a
        // runtime fact (a closed case has none, and that is fine), yet the same branch is also what a
        // plan naming the wrong process key falls into — and that plan skips every case while
        // reporting success. The warning names both halves of the query that found nothing, because
        // between the process definition key and the business key it is always one of the two.
        val processMigrations = instruction.processMigration
            .map { instruction ->
                instruction to findHijackableProcesses(instruction, ownerDocumentId)
                    .filterNot { ownedByTheWalk(it, buildingBlockDefinitionId, adoptable) }
            }
            .filter { (_, processInstances) -> processInstances.isNotEmpty() }
        if (processMigrations.isEmpty()) {
            if (buildingBlockDefinitionId in adoptable) {
                // Pass 2's to take, from the running tree rather than by business key. Saying anything
                // here would warn on every successfully-adopted block; if the walk cannot take it either,
                // it warns itself, naming the call activity — which is the more useful message anyway.
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

        // The document is created already populated from the entry's dataMigration (read from the owner),
        // so schema validation at creation succeeds even when the block's schema has required fields; the
        // patch list is then re-applied against the persisted document (idempotent for `doc:` targets, and
        // the path that handles any non-`doc:` targets).
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

    /**
     * Whether [processInstance] belongs to pass 2 rather than to the business-key route: the target
     * declares this block on a call activity **and** this process was started by one.
     *
     * Both routes can match the same process, because a child inherits the owner's business key — which
     * is the very reason pass 2 exists. If the business-key route won those, an entry that names a
     * process key only to carry `mapActivities` for an adopted node would flatten the block it was
     * trying to configure: created directly under the owner, with the nesting lost and nothing said. So
     * the **links** decide which route applies, never whether the plan happens to name a process key.
     */
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
        satisfied += buildingBlockDefinitionId
    }

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

    // ---------------------------------------------------------------------------------------------
    // Pass 2: by walking the running tree
    // ---------------------------------------------------------------------------------------------

    /**
     * The owner's own running process instances: those carrying its document id as business key and not
     * called by another such process. Descendants that inherited the business key are reached by the walk
     * itself, so starting from the whole set would visit them twice and, worse, attribute a grandchild to
     * the case instead of to the block above it.
     */
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
                    // Already a building block, process and all — natively started, or created by pass 1.
                    // Its own children are still ours to take over, under it.
                    takeOverTreeBelow(
                        target, listOf(childProcessInstanceId), existing.documentId, existing.id, caseDocumentId,
                        instructions, satisfied, depth + 1,
                    )
                    return@forEach
                }

                val callerActivityId = callingExecution.activityId
                val link = callerActivityId?.let {
                    buildingBlockLinkOf(callingExecution.getProcessDefinitionId(), it)
                    // The caller's *running* definition answers only while the caller was itself taken
                    // over — it is then on the block's own deployment, which carries the link. A hop the
                    // plan leaves as a plain sub-process never moves, so its caller keeps running the old
                    // blueprint's copy, which legitimately carries none of the new model's links, and
                    // everything below it would be invisible (G23). The target model knows which
                    // blueprint deploys that process and therefore which links the new version means.
                        ?: linkedBuildingBlockVersionResolver.resolveCallActivityLink(
                            target, processDefinitionKeyOf(childProcessInstanceId), it
                        )
                }
                if (link == null || callerActivityId == null) {
                    // The target version models this as a plain sub-process as well. Leave it be — but a
                    // call activity further down may still be declared a building block.
                    takeOverTreeBelow(
                        target,
                        listOf(childProcessInstanceId),
                        ownerDocumentId,
                        parentBuildingBlockInstanceId,
                        caseDocumentId,
                        instructions,
                        satisfied,
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
                    depth + 1,
                )
            }
        }
    }

    /**
     * Gives [childProcessInstanceId] the identity of the building block [link] declares, and returns the
     * instance — or null when the plan does not authorise it or the blueprint cannot carry it, having said
     * why in either case.
     */
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

        // The plan must authorise this block by name and version. Without an entry the running
        // sub-process is left exactly as it is — which is a divergence from what a case *started* on this
        // version would look like, so it is said out loud rather than assumed to be what the author meant.
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

            // A block the runtime listener created for this very call activity but never gave a process
            // to. A pre-migration instance can reach one of these: a building-block process link
            // attaches to *every* deployment sharing the process definition key, including the copy the
            // old blueprint owned, so the listener fires on a case whose blueprint has no blocks at all
            // (G21). Claim it rather than create a second document for the same running process.
            existing.definition.id == buildingBlockDefinitionId -> {
                existing.processInstanceId = childProcessInstanceId
                existing.activityId = callerActivityId
                existing.callerProcessDefinitionId = callerProcessDefinitionId
                // And re-home it into the tree. The listener created it with no parent — the calling
                // process carried the case's business key back then, so there was no parent block to
                // find. There is one now, and without this the nesting this pass exists to produce would
                // be lost for exactly the blocks it had to claim.
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
            // The entry's instruction addressing this process definition key, if it has one: its
            // mapActivities is the escape hatch where the author renamed an activity, and its skip flags
            // and setProcessVariables apply here exactly as they do to a hijack.
            processMigration = processMigrationFor(instruction, processDefinitionKey),
            buildingBlockDocumentId = instance.documentId,
        )

        // Backs the call activity's `#{buildingBlockDocumentId}` expression and lets the listener's
        // onCallActivityEnd run this link's END output mappings when the block finishes.
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

    /**
     * Creates the block's document and instance from the link's `inputMappings` — the same mappings the
     * listener resolves when a block is started natively — read against the owner document, and then the
     * entry's own `dataMigration` on top, exactly as pass 1 applies it. `pv:` sources are not resolvable
     * here (there is no execution to read them from at migration time), so they are reported rather than
     * quietly dropped.
     */
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

    /**
     * The entry's process migration addressing [processDefinitionKey], or null when it names none. The
     * walk never renames the process — it finds the target *by* the running key — so an entry addressing
     * this process names it on either end.
     */
    private fun processMigrationFor(
        instruction: AddBuildingBlockInstruction,
        processDefinitionKey: String,
    ): ProcessMigrationInstruction? =
        instruction.processMigration.firstOrNull {
            it.targetProcessDefinitionKey == processDefinitionKey ||
                it.sourceProcessDefinitionKey == processDefinitionKey
        }

    // ---------------------------------------------------------------------------------------------
    // Shared: everything after "which process?"
    // ---------------------------------------------------------------------------------------------

    /**
     * Hands the running process [processInstanceId] to the building block document
     * [buildingBlockDocumentId]: migrate it onto the block's deployment, apply the entry's process
     * variables, and move ownership.
     *
     * Both the business key and the process-document association have to move —
     * `ProcessDocumentService.getDocumentId` prefers the association over the business key, so leaving it
     * on the owner document would silently break the block's end-event result sync (G17).
     */
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

    /**
     * Repoints the process-document association of [processInstanceId] to the building block document.
     * A taken-over process still carries the owner's association; [ProcessDocumentAssociationService.createProcessDocumentInstance]
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
    ): String? =
        processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(buildingBlockDefinitionId)
            .filter { it.processDefinitionKey == processDefinitionKey }
            // A building block can have several deployed versions of a process definition linked (each
            // redeploy adds one); target the current `main` version, not an arbitrary/older one.
            .let { matches -> matches.firstOrNull { it.main } ?: matches.firstOrNull() }
            ?.id
            ?.processDefinitionId
            ?.id

    // ---------------------------------------------------------------------------------------------
    // Running-tree lookups
    // ---------------------------------------------------------------------------------------------

    private fun childProcessInstancesOf(processInstanceId: String): List<String> =
        runtimeService.createProcessInstanceQuery()
            .superProcessInstanceId(processInstanceId)
            .list()
            .map { it.processInstanceId }

    /** The super (calling) process instance id of [processInstanceId], or null if it is top-level. */
    private fun superProcessInstanceIdOf(processInstanceId: String): String? =
        runtimeService.createProcessInstanceQuery()
            .subProcessInstanceId(processInstanceId)
            .singleResult()
            ?.processInstanceId

    /** The execution of the call activity that started [processInstanceId], or null when top-level. */
    private fun callingExecutionOf(processInstanceId: String) =
        operatonExecutionRepository.findById(processInstanceId).orElse(null)?.superExecution

    /**
     * The building block the call activity execution [callingExecutionId] already carries, if any —
     * `#{buildingBlockDocumentId}`, the same variable the runtime listener sets and reads back. It is
     * the only handle on a block whose `processInstanceId` was never filled in.
     */
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

    private fun processDefinitionIdOf(processInstanceId: String): String =
        runtimeService.createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .singleResult()
            .processDefinitionId

    private fun processDefinitionKeyOf(processInstanceId: String): String =
        repositoryService.getProcessDefinition(processDefinitionIdOf(processInstanceId)).key

    private companion object {
        private const val DOC_PREFIX = "doc"
        private const val PROCESS_VARIABLE_PREFIX = "pv:"

        /** Runaway backstop for the tree walk; no real blueprint nests anywhere near this deep. */
        private const val MAX_DEPTH = 20
        val logger = KotlinLogging.logger {}
    }
}
