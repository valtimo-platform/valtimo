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
import io.github.oshai.kotlinlogging.KotlinLogging

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
            candidates.firstOrNull { it.origin == LinkOrigin.CALL_ACTIVITY && it.activityId == instance.activityId }
        } else {
            candidates.firstOrNull { it.origin == LinkOrigin.STARTABLE_ITEM }
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
        val logger = KotlinLogging.logger {}
    }
}
