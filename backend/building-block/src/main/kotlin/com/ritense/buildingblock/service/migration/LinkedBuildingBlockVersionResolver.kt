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
import com.ritense.valtimo.contract.blueprint.migration.MigrationRunCache
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.operaton.findProcessDefinitionOrNull
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.ProcessDefinition
import org.operaton.bpm.model.bpmn.instance.CallActivity

/** Answers "which version of this building block does that blueprint version link?" — over both startable-item and call-activity links. */
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

    /** Every block reachable from [owner] by call-activity links, to any depth. Expands through unlinked `BB:`-tagged hops, returns only what is genuinely linked (D12). */
    fun resolveCallActivityReachable(owner: BlueprintId): Set<BuildingBlockDefinitionId> =
        resolveCallActivityDeclarers(owner).keys

    /** The link for [activityId] as [owner]'s model declares it — needed when the hop above stays a plain sub-process and still runs the old deployment. */
    fun resolveCallActivityLink(
        owner: BlueprintId,
        processDefinitionKey: String,
        activityId: String,
    ): BuildingBlockProcessLink? = resolveCallActivityLinkIndex(owner)[processDefinitionKey to activityId]

    /** Every call-activity link [owner] declares, by (process definition key, activity id). Built by [walkTree] itself; first — shallowest — declarer wins. */
    fun resolveCallActivityLinkIndex(owner: BlueprintId): Map<Pair<String, String>, BuildingBlockProcessLink> =
        walkTree(owner).callActivityLinkIndex

    /** As [resolveCallActivityReachable], but keeping which blueprint declares each block — a nested block is handed back to its parent block, not the case. */
    fun resolveCallActivityDeclarers(owner: BlueprintId): Map<BuildingBlockDefinitionId, BlueprintId> =
        walkTree(owner).declaredBy

    /** Which block version each call activity declares. Answers "did this hop change what it points at" — a re-pointed activity is a key change, not a remove plus an add. */
    fun resolveCallActivityDeclaredBlocks(owner: BlueprintId): Map<String, BuildingBlockDefinitionId> =
        walkTree(owner).declaredBlockByActivity

    private data class Tree(
        val declaredBy: Map<BuildingBlockDefinitionId, BlueprintId>,
        /** Which blueprint declares each call activity id — see [resolveGoverningBlueprint]. */
        val declaredByActivity: Map<String, BlueprintId>,
        /** Which building block version each call activity id names — see [resolveCallActivityDeclaredBlocks]. */
        val declaredBlockByActivity: Map<String, BuildingBlockDefinitionId>,
        /** Every blueprint the walk passed through, owner included — wider than [declaredBy], which includes hops nothing links. */
        val expanded: Set<BlueprintId>,
        /** See [resolveCallActivityLinkIndex], which is the only reader. */
        val callActivityLinkIndex: Map<Pair<String, String>, BuildingBlockProcessLink>,
    )

    /** One process definition of one blueprint, with everything the walk reads about it. */
    private data class WalkedProcess(
        val processDefinitionId: String,
        /** Null when nothing is deployed — a link row outlives the deployment it names, so this is not a reason to fail. */
        val definition: ProcessDefinition?,
        val links: List<BuildingBlockProcessLink>,
    )

    /** One breadth-first pass over [owner]'s tree, answering everything from a single read per blueprint. Memoized for the length of a run. */
    private fun walkTree(owner: BlueprintId): Tree =
        MigrationRunCache.computeIfAbsent(TreeKey(owner)) { walk(owner) }

    /** Private, so nothing else sharing [MigrationRunCache]'s keyspace can collide. */
    private data class TreeKey(val owner: BlueprintId)

    private fun walk(owner: BlueprintId): Tree {
        val declaredBy = LinkedHashMap<BuildingBlockDefinitionId, BlueprintId>()
        val declaredByActivity = LinkedHashMap<String, BlueprintId>()
        val declaredBlockByActivity = LinkedHashMap<String, BuildingBlockDefinitionId>()
        val callActivityLinkIndex = LinkedHashMap<Pair<String, String>, BuildingBlockProcessLink>()
        // Deduplicates expansion on its own set: a node reached through an unlinked call activity never lands in `declaredBy`.
        val expanded = LinkedHashSet<BlueprintId>()
        val queue = ArrayDeque<BlueprintId>().apply { add(owner) }
        while (queue.isNotEmpty()) {
            val current = queue.removeFirst()
            if (!expanded.add(current)) {
                continue
            }
            // A cyclic link graph is a configuration error, not something to fail a migration over — bounded, and stops rather than throws.
            if (expanded.size > MAX_LINK_GRAPH_NODES) {
                logger.warn {
                    "Stopped resolving call-activity-linked building blocks for '$owner' after " +
                        "$MAX_LINK_GRAPH_NODES blueprints; the link graph is either cyclic or larger than " +
                        "any blueprint should be."
                }
                break
            }
            val processes = processDefinitionIdsOf(current).map { processDefinitionId ->
                WalkedProcess(
                    processDefinitionId = processDefinitionId,
                    definition = repositoryService.findProcessDefinitionOrNull(processDefinitionId),
                    links = processLinkRepository.findByProcessDefinitionId(processDefinitionId)
                        .filterIsInstance<BuildingBlockProcessLink>(),
                )
            }

            // Links before call targets — the breadth-first order "first declarer wins" is defined against.
            processes.forEach { process ->
                process.links.forEach { link ->
                    declaredBy.putIfAbsent(link.buildingBlockDefinitionId, current)
                    declaredByActivity.putIfAbsent(link.activityId, current)
                    declaredBlockByActivity.putIfAbsent(link.activityId, link.buildingBlockDefinitionId)
                    // Only the index needs the key; a definition that is gone still declares its links.
                    process.definition?.key
                        ?.let { key -> callActivityLinkIndex.putIfAbsent(key to link.activityId, link) }
                    queue.add(link.buildingBlockDefinitionId)
                }
            }
            processes.forEach { process -> queue.addAll(buildingBlockCallTargetsOf(process)) }
        }
        return Tree(declaredBy, declaredByActivity, declaredBlockByActivity, expanded, callActivityLinkIndex)
    }

    /** The blueprint whose links decide [instance]'s version — the declarer of the call activity it came from, which is not [owner] once a hop was left a plain sub-process. */
    fun resolveGoverningBlueprint(owner: BlueprintId, instance: BuildingBlockInstance): BlueprintId {
        val activityId = instance.activityId ?: return owner
        return walkTree(owner).declaredByActivity[activityId] ?: owner
    }

    /** The block versions [process] calls by `BB:<key>:<version>` tag, linked or not — the tag is the only place the binding exists. */
    private fun buildingBlockCallTargetsOf(process: WalkedProcess): List<BuildingBlockDefinitionId> {
        // Keyed on the definition existing, not on its key: an unlinked `BB:`-tagged hop has no key, and reading its model is what makes everything below it visible.
        process.definition ?: return emptyList()
        val model = repositoryService.getBpmnModelInstance(process.processDefinitionId) ?: return emptyList()
        return model.getModelElementsByType(CallActivity::class.java)
            .mapNotNull { BuildingBlockDefinitionId.fromProcessVersionTag(it.operatonCalledElementVersionTag) }
    }

    /** The version [instance] should be on per [owner], matched via its originating call activity; one reachable link wins, several throw rather than guess, none leaves it alone. */
    fun resolveTarget(owner: BlueprintId, instance: BuildingBlockInstance): BuildingBlockDefinitionId? {
        val current = instance.definition.id
        val candidates = resolveLinkedVersions(owner)
        if (candidates.isEmpty()) {
            return null
        }

        val preferred = if (instance.activityId != null) {
            // The activity identifies the link exactly, so the key is deliberately not consulted.
            candidates.firstOrNull { it.origin == LinkOrigin.CALL_ACTIVITY && it.activityId == instance.activityId }
        } else {
            // A startable-item link carries no identity beyond its key, so the key is the only thing that can say which link this instance came from.
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

        // One reachable version and no matching origin: nothing is in doubt, but it usually means a renamed activity.
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
        /** Runaway backstop for [resolveCallActivityReachable]. */
        const val MAX_LINK_GRAPH_NODES = 200
        val logger = KotlinLogging.logger {}
    }
}
