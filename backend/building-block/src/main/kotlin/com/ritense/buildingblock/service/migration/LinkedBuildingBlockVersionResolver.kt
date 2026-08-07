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
import org.semver4j.Semver

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
 * the case's existing building block instances are now out of date.
 */
class LinkedBuildingBlockVersionResolver(
    private val caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val processLinkRepository: ProcessLinkRepository,
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
     * The version of [instance]'s building block that [owner] links, or null when [owner] does not
     * link that building block at all (the block is a leftover from an older version of the owner and
     * is left alone).
     *
     * An instance created by a call activity records the activity it came from, so it is matched back
     * to *that* call activity's link rather than to any link that happens to name the same building
     * block; an instance with no recorded activity came from a startable item.
     *
     * That preferred match can be missing — most often because the owner's process migration renamed
     * the activity past what [BuildingBlockCallActivityRemapExecutor] could follow, or because the
     * block is now linked through the other mechanism than the one it was started from. What happens
     * then depends on whether anything is actually in doubt:
     *
     * - **every link for the building block names the same version** — use it. There is only one
     *   answer, so matching the instance to a particular link would not change it.
     * - **the links disagree** — fail. Picking one (the highest, say) would be a guess about which
     *   link governs this instance, and a wrong guess migrates a running block to a version its
     *   owner never intended for it. The same reason [BuildingBlockProcessVersionChecker] refuses to
     *   guess an activity mapping.
     *
     * @throws IllegalStateException when [owner] links the building block at several versions and
     * [instance] cannot be matched to one of them.
     */
    fun resolveTargetVersion(owner: BlueprintId, instance: BuildingBlockInstance): Semver? {
        val key = instance.definition.id.key
        val candidates = resolveLinkedVersions(owner)
            .filter { it.buildingBlockDefinitionId.key == key }
        if (candidates.isEmpty()) {
            return null
        }

        val preferred = if (instance.activityId != null) {
            candidates.firstOrNull { it.origin == LinkOrigin.CALL_ACTIVITY && it.activityId == instance.activityId }
        } else {
            candidates.firstOrNull { it.origin == LinkOrigin.STARTABLE_ITEM }
        }
        if (preferred != null) {
            return preferred.buildingBlockDefinitionId.versionTag
        }

        val linkedVersions = candidates.map { it.buildingBlockDefinitionId.versionTag }.distinct()
        val origin = if (instance.activityId != null) {
            "call activity '${instance.activityId}'"
        } else {
            "startable item"
        }
        check(linkedVersions.size == 1) {
            "'$owner' links building block '$key' at ${linkedVersions.sorted().joinToString()}, and building " +
                "block instance '${instance.id}' cannot be matched to any of those links by its $origin. " +
                "Which version it should move to is therefore ambiguous, and guessing would risk moving a " +
                "running building block to a version its owner never meant for it. Point the ${
                    if (instance.activityId != null) "call activity" else "startable item"
                } at the intended version, or make the links agree."
        }

        // One version linked, several links to it: nothing is in doubt, so the unmatched origin does
        // not stop the block moving. Still worth knowing about — it usually means a renamed activity.
        logger.warn {
            "No $origin link found on '$owner' for building block '$key' (instance '${instance.id}'), " +
                "but every link names '${linkedVersions.single()}'; using it"
        }
        return linkedVersions.single()
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
