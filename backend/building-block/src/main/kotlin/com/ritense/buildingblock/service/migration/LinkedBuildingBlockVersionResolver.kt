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

import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.operaton.findBpmnModelInstanceOrNull
import com.ritense.valtimo.operaton.findProcessDefinitionOrNull
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.instance.CallActivity

/**
 * Answers "which version of this building block does that blueprint version link?".
 *
 * A blueprint links a building block in two independent ways, and both have to be considered:
 *
 * - **as a startable item** — a `case_definition_building_block_link` row, letting a user start the
 *   block from the case (case definitions only);
 * - **as a call activity** — a [BuildingBlockProcessLink] on an activity of one of the blueprint's
 *   process definitions, so the block runs as part of a process. A building block's own processes can
 *   call other building blocks the same way, which is what makes nested blocks possible.
 *
 * When a case migrates, these links on the *target* case definition version are what decide whether
 * the case's existing building block instances are now out of date — and, since a migration plan may
 * lead from one building block key to another, whether they should become a different building block
 * altogether.
 */
class LinkedBuildingBlockVersionResolver(
    private val caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val processLinkRepository: ProcessLinkRepository,
    private val buildingBlockMigrationPathResolver: BuildingBlockMigrationPathResolver,
    private val repositoryService: RepositoryService,
) {

    /** How a blueprint version links a building block version. */
    enum class LinkOrigin { STARTABLE_ITEM, CALL_ACTIVITY }

    data class LinkedBuildingBlock(
        val buildingBlockDefinitionId: BuildingBlockDefinitionId,
        val origin: LinkOrigin,
        /** The call activity this link sits on; null for a startable-item link. */
        val activityId: String? = null,
    )

    /** Every building block version linked by [owner], from both link kinds. */
    fun resolveLinkedVersions(owner: BlueprintId): List<LinkedBuildingBlock> {
        return startableItemLinks(owner) + callActivityLinks(owner)
    }

    /**
     * Every building block version reachable from [owner] by following **call activity** links, to any
     * depth — [owner]'s own, plus whatever those blocks declare on their call activities, and so on.
     *
     * A nested block is declared by the block above it, not by the case: `bijstand:1.0.1` links
     * `bijstand-uitvoeren:1.0.0`, and `bijstand-besluit:1.0.0` is linked by `bijstand-uitvoeren:1.0.0`.
     * Anything asking "does this blueprint version model that block anywhere below it" therefore has to
     * walk the graph rather than read one level — which is exactly the set
     * [BuildingBlockAdoptionExecutor] can reach in a single run.
     *
     * Startable-item links are deliberately not followed: they are how a *user* starts a block, not how a
     * running process tree nests, so they say nothing about what a migration can descend into.
     *
     * **Two sets, not one.** A blueprint version's tree is walked through more than it declares:
     *
     * - what the walk *expands* includes a call activity bound to a building block's deployment
     *   (`camunda:calledElementVersionTag="BB:<key>:<version>"`) even when it carries **no**
     *   building-block process link. Such a call target runs as a plain sub-process, but it is still a
     *   deployed building block whose own BPMN declares links, and those links are part of what this
     *   version models. Reading only linked hops makes one unlinked call activity hide everything below
     *   it — for the migration this was built for, a single such gap at depth 1 hid 142 links.
     * - what the walk *returns* is only what a call activity actually **links**. That is what keeps the
     *   D12 guarantee: a plan may still only name a block the version genuinely declares, so it cannot
     *   create one no later migration would ever look for.
     *
     * The two are consistent with what [BuildingBlockAdoptionExecutor] does at runtime, which descends
     * *past* an unlinked child (leaving it a plain sub-process) and adopts a linked one below it. So
     * widening the expansion cannot authorise anything adoption would then create out of thin air; it
     * only stops refusing entries for blocks that are declared, further down than one hop.
     */
    fun resolveCallActivityReachable(owner: BlueprintId): Set<BuildingBlockDefinitionId> =
        resolveCallActivityDeclarers(owner).keys

    /**
     * The same walk as [resolveCallActivityReachable], but keeping **which blueprint declares each block** —
     * the one whose call activity names it, which is the block's owner in the running tree.
     *
     * That owner is what a nested block's state is transferred to and from: on the way out
     * [RemoveBuildingBlockMigrationComponentExecutor] hands a nested block back to its **parent block**, not
     * to the case, so a suggested `dataMigration` or `processMigration` has to be computed against the
     * parent or it proposes moving data to the wrong document. The first declarer wins, which in breadth-first
     * order is the shallowest one — the same node the runtime walk would descend through first.
     */
    /**
     * The building-block link for [activityId] on the process [processDefinitionKey], looked up in the
     * blueprint that **[owner]'s model** says deploys that process — not in whichever deployment the
     * process happens to be running.
     *
     * This is what a running tree needs when the hop above a block stays a **plain sub-process**. Adoption
     * normally reads the link from the caller's current definition, which is right as long as the caller
     * was taken over first: it is then on the block's own deployment, which carries the link. A hop that
     * is left plain never moves, so its caller keeps running the *old* blueprint's copy of that process —
     * a copy that legitimately carries none of the new model's links. Everything below such a hop would
     * then be invisible, which is exactly the shape this feature was built for: a case whose middle level
     * is called as a plain sub-process while the level below it is a declared building block.
     *
     * The walk of [resolveCallActivityDeclarers] already passes through those hops (it expands through a
     * `BB:<key>:<version>` binding whether or not it is linked), so the blueprint that owns the running
     * process is known from the target model alone. Its links are the ones the target version means.
     */
    fun resolveCallActivityLink(
        owner: BlueprintId,
        processDefinitionKey: String,
        activityId: String,
    ): BuildingBlockProcessLink? = resolveCallActivityLinkIndex(owner)[processDefinitionKey to activityId]

    /**
     * Every call-activity link [owner]'s model declares, indexed by the pair that identifies a call
     * activity at runtime: the **process definition key** whose BPMN contains it, and its activity id.
     *
     * The whole index in one walk, because a caller resolving links hop by hop pays the walk each time:
     * [resolveCallActivityLink] reads `blueprintsInTreeOf`, which for a real configuration means a BFS over
     * a hundred blueprints, a `findByProcessDefinitionId` per process definition and a parsed BPMN model
     * per definition. `AddBuildingBlockMigrationComponentExecutor` needs it once per hop the plan leaves as
     * a plain sub-process, which in the configuration this was built for is dozens per case (G31). So it
     * takes the index once per instance it migrates and looks up in memory after that.
     *
     * First declarer wins, matching what the per-hop lookup returned: the blueprints are visited in the
     * walk's breadth-first order, so the shallowest declaration of a given call activity is the one kept —
     * the same node the runtime walk descends through first.
     */
    fun resolveCallActivityLinkIndex(owner: BlueprintId): Map<Pair<String, String>, BuildingBlockProcessLink> {
        val index = LinkedHashMap<Pair<String, String>, BuildingBlockProcessLink>()
        blueprintsInTreeOf(owner).forEach { blueprint ->
            processDefinitionIdsOf(blueprint).forEach { processDefinitionId ->
                val processDefinitionKey = processDefinitionKeyOf(processDefinitionId) ?: return@forEach
                processLinkRepository.findByProcessDefinitionId(processDefinitionId)
                    .filterIsInstance<BuildingBlockProcessLink>()
                    .forEach { link -> index.putIfAbsent(processDefinitionKey to link.activityId, link) }
            }
        }
        return index
    }

    /**
     * The key of [processDefinitionId], or null when nothing is deployed under it — which says nothing
     * about links and is not a reason to fail a plan save or a migration. Asked so that it answers
     * rather than throws, which matters more than it looks: see [findProcessDefinitionOrNull].
     */
    private fun processDefinitionKeyOf(processDefinitionId: String): String? =
        repositoryService.findProcessDefinitionOrNull(processDefinitionId)?.key

    fun resolveCallActivityDeclarers(owner: BlueprintId): Map<BuildingBlockDefinitionId, BlueprintId> =
        walkTree(owner).declaredBy

    /**
     * Every blueprint the walk passes *through*, [owner] included — the linked blocks plus the ones only
     * called by version tag. Wider than what the walk returns as declared, which is the point: a process
     * running under one of these is part of what [owner] models even when nothing links it.
     */
    private fun blueprintsInTreeOf(owner: BlueprintId): Set<BlueprintId> = walkTree(owner).expanded

    private data class Tree(
        val declaredBy: Map<BuildingBlockDefinitionId, BlueprintId>,
        /** Which blueprint declares each call activity id — see [resolveGoverningBlueprint]. */
        val declaredByActivity: Map<String, BlueprintId>,
        val expanded: Set<BlueprintId>,
    )

    private fun walkTree(owner: BlueprintId): Tree {
        val declaredBy = LinkedHashMap<BuildingBlockDefinitionId, BlueprintId>()
        val declaredByActivity = LinkedHashMap<String, BlueprintId>()
        // Expansion is deduplicated on its own set: a node reached through an *unlinked* call activity is
        // never added to `declaredBy`, so without this it would be expanded again on every visit.
        val expanded = HashSet<BlueprintId>()
        val queue = ArrayDeque<BlueprintId>().apply { add(owner) }
        while (queue.isNotEmpty()) {
            val current = queue.removeFirst()
            if (!expanded.add(current)) {
                continue
            }
            // A cyclic link graph is a configuration error rather than something to fail a migration
            // over, so the walk is bounded and stops instead of throwing. Counted in distinct blueprints
            // rather than iterations: a real tree can hold a hundred blocks and every one is legitimate.
            if (expanded.size > MAX_LINK_GRAPH_NODES) {
                logger.warn {
                    "Stopped resolving call-activity-linked building blocks for '$owner' after " +
                        "$MAX_LINK_GRAPH_NODES blueprints; the link graph is either cyclic or larger than " +
                        "any blueprint should be."
                }
                break
            }
            callActivityLinks(current).forEach { link ->
                declaredBy.putIfAbsent(link.buildingBlockDefinitionId, current)
                link.activityId?.let { declaredByActivity.putIfAbsent(it, current) }
                queue.add(link.buildingBlockDefinitionId)
            }
            queue.addAll(buildingBlockCallTargetsOf(current))
        }
        return Tree(declaredBy, declaredByActivity, expanded)
    }

    /**
     * The blueprint whose links decide which version [instance] belongs on, given that [owner] is the
     * blueprint version of whatever owns it in the running tree.
     *
     * Usually that is [owner] itself, and this returns it. It is *not* [owner] for a block the adoption
     * walk took over from under a hop the plan deliberately left as a plain sub-process: nothing became a
     * block at that level, so the instance hangs directly off the case while the call activity that
     * declares it belongs to the skipped block's BPMN. Ask the case and the answer is "I link nothing of
     * the sort" — which is indistinguishable from a block whose link was withdrawn, so the block gets
     * left alone with a warning telling the author to dissolve what their plan just deliberately created,
     * and no later migration ever upgrades it.
     *
     * So the question has to be put to the blueprint that **declares** the call activity the instance
     * came from, which the tree walk passes through anyway. Both readings of "linked" then agree: an
     * entry is authorised because the model reaches the block through that declarer, and the same
     * declarer is asked to maintain it afterwards.
     *
     * Matched on the recorded activity id, the same identity [resolveTarget] prefers, so a declarer that
     * has re-pointed that call activity at a different version — or a different building block entirely —
     * is still the one asked. An instance with no activity id came from a startable item, which only a
     * case definition can offer and only one level deep, so [owner] is already the right answer. Where
     * two blueprints in one tree declare the same activity id the shallowest wins, as it does for
     * [resolveCallActivityDeclarers]; nothing in the instance can distinguish them.
     */
    fun resolveGoverningBlueprint(owner: BlueprintId, instance: BuildingBlockInstance): BlueprintId {
        val activityId = instance.activityId ?: return owner
        return walkTree(owner).declaredByActivity[activityId] ?: owner
    }

    /**
     * The building block versions the processes of [owner] call by version tag — `BB:<key>:<version>` on
     * a call activity — whether or not that call activity carries a building-block process link.
     *
     * Read from the deployed BPMN because the tag is the only place the binding exists: a link says
     * "this call activity is a building block", the tag says "this is the deployment it calls", and an
     * unlinked call activity has only the second. Operaton keeps parsed models in its deployment cache,
     * so this is a walk over in-memory models rather than a parse per activity.
     */
    private fun buildingBlockCallTargetsOf(owner: BlueprintId): List<BuildingBlockDefinitionId> =
        processDefinitionIdsOf(owner).flatMap { processDefinitionId ->
            // A definition that is no longer deployed tells us nothing about call targets, and is not a
            // reason to fail a plan save or a migration — a link row outlives the deployment it names — so
            // it is treated as "no call activities". Asked so that it answers rather than throws, which
            // matters more than it looks: see findBpmnModelInstanceOrNull.
            val model = repositoryService.findBpmnModelInstanceOrNull(processDefinitionId)
                ?: return@flatMap emptyList()

            model.getModelElementsByType(CallActivity::class.java)
                .mapNotNull { BuildingBlockDefinitionId.fromProcessVersionTag(it.operatonCalledElementVersionTag) }
        }

    /**
     * The building block version [instance] should be on according to [owner], or null when [owner]
     * links nothing this instance can follow (the block is a leftover from an older version of the
     * owner and is left alone).
     *
     * Note that the answer is a full [BuildingBlockDefinitionId], key included, and that the candidate
     * links are **not** filtered by the instance's own key. A migration plan may lead from one building
     * block key to another, so an owner that now links a *different* building block where it used to
     * link this one is asking for exactly that migration — refusing to look past the key would make
     * that instruction invisible and quietly strand the instance.
     *
     * An instance created by a call activity records the activity it came from, so it is matched back
     * to *that* call activity's link rather than to any link that happens to be there; an instance with
     * no recorded activity came from a startable item. This origin match is what makes a key change
     * unambiguous: the same call activity naming a different building block is a deliberate act by
     * whoever authored the owner's new version.
     *
     * That preferred match can be missing — most often because the owner's process migration renamed
     * the activity past what [BuildingBlockCallActivityRemapExecutor] could follow, or because the
     * block is now linked through the other mechanism than the one it was started from. What happens
     * then depends on whether anything is actually in doubt, which is decided by asking which of the
     * links the instance can even *get* to through the deployed plans
     * ([BuildingBlockMigrationPathResolver]):
     *
     * - **exactly one reachable link** — use it. There is only one answer, so matching the instance to
     *   a particular link would not change it.
     * - **several reachable links** — fail. Picking one (the highest, say) would be a guess about which
     *   link governs this instance, and a wrong guess migrates a running block to a version its
     *   owner never intended for it. The same reason [BuildingBlockProcessVersionChecker] refuses to
     *   guess an activity mapping.
     * - **none reachable** — null. Nothing this instance can follow, so it is left where it is, exactly
     *   as for an owner that links no such block at all.
     *
     * @throws IllegalStateException when several of [owner]'s links are reachable from [instance] and it
     * cannot be matched to one of them.
     */
    fun resolveTarget(owner: BlueprintId, instance: BuildingBlockInstance): BuildingBlockDefinitionId? {
        val current = instance.definition.id
        val candidates = resolveLinkedVersions(owner)
        if (candidates.isEmpty()) {
            return null
        }

        val preferred = if (instance.activityId != null) {
            // The activity identifies the link exactly, so the key is deliberately not consulted: the
            // same call activity naming a different building block *is* the key-change instruction.
            candidates.firstOrNull { it.origin == LinkOrigin.CALL_ACTIVITY && it.activityId == instance.activityId }
        } else {
            // A startable-item link carries no identity beyond its key, so the key is the only thing
            // that can say which link this instance came from. Matching on the origin kind alone would
            // pin every startable-origin instance to whichever startable item happened to come back
            // first — including a block just created by `addBuildingBlock` under a completely unrelated
            // key. Where no startable item shares the key, the link that governs really is unknown, and
            // the reachability tie-break below is what decides.
            candidates.firstOrNull {
                it.origin == LinkOrigin.STARTABLE_ITEM &&
                    it.buildingBlockDefinitionId.key == current.key
            }
        }
        if (preferred != null) {
            return preferred.buildingBlockDefinitionId
        }

        val origin = if (instance.activityId != null) {
            "call activity '${instance.activityId}'"
        } else {
            "startable item"
        }
        val reachable = candidates
            .map { it.buildingBlockDefinitionId }
            .distinct()
            .filter { buildingBlockMigrationPathResolver.isReachable(current, it) }
        if (reachable.isEmpty()) {
            logger.debug {
                "No $origin link on '$owner' matches building block instance '${instance.id}' ('$current'), " +
                    "and none of the versions it does link is reachable from '$current'; leaving it as is"
            }
            return null
        }
        check(reachable.size == 1) {
            "'$owner' links ${reachable.sortedBy { it.toString() }.joinToString { "'$it'" }}, all of which " +
                "building block instance '${instance.id}' ('$current') could be migrated to, and it cannot " +
                "be matched to any one of those links by its $origin. Which version it should move to is " +
                "therefore ambiguous, and guessing would risk moving a running building block to a version " +
                "its owner never meant for it. Point the ${
                    if (instance.activityId != null) "call activity" else "startable item"
                } at the intended version, or make the links agree."
        }

        // One reachable version, no matching origin: nothing is in doubt, so the unmatched origin does
        // not stop the block moving. Still worth knowing about — it usually means a renamed activity.
        logger.warn {
            "No $origin link found on '$owner' for building block instance '${instance.id}' ('$current'), " +
                "but '${reachable.single()}' is the only version it links that the instance can reach; using it"
        }
        return reachable.single()
    }

    private fun startableItemLinks(owner: BlueprintId): List<LinkedBuildingBlock> {
        if (owner !is CaseDefinitionId) {
            return emptyList() // only a case definition can offer a building block as a startable item
        }
        return caseDefinitionBuildingBlockLinkRepository.findAllByCaseDefinitionId(owner)
            .map { LinkedBuildingBlock(it.buildingBlockDefinitionId, LinkOrigin.STARTABLE_ITEM) }
    }

    private fun callActivityLinks(owner: BlueprintId): List<LinkedBuildingBlock> {
        return processDefinitionIdsOf(owner)
            .flatMap { processDefinitionId -> processLinkRepository.findByProcessDefinitionId(processDefinitionId) }
            .filterIsInstance<BuildingBlockProcessLink>()
            .map { LinkedBuildingBlock(it.buildingBlockDefinitionId, LinkOrigin.CALL_ACTIVITY, it.activityId) }
    }

    /** The process definitions belonging to [owner], whichever kind of blueprint it is. */
    private fun processDefinitionIdsOf(owner: BlueprintId): List<String> = when (owner) {
        is CaseDefinitionId -> processDefinitionCaseDefinitionRepository.findByIdCaseDefinitionId(owner)
            .map { it.id.processDefinitionId.id }

        is BuildingBlockDefinitionId -> processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(owner)
            .map { it.id.processDefinitionId.id }

        else -> emptyList()
    }

    private companion object {
        /** Runaway backstop for [resolveCallActivityReachable]; no real blueprint comes close. */
        const val MAX_LINK_GRAPH_NODES = 200
        val logger = KotlinLogging.logger {}
    }
}
