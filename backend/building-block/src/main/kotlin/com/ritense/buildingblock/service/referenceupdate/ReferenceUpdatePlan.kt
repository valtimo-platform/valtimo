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

package com.ritense.buildingblock.service.referenceupdate

import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateReasonCode.CONFLICT_CHILD
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateReasonCode.CONFLICT_INPUT
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateReasonCode.CONFLICT_PLUGIN
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.semver4j.Semver
import java.util.UUID

class ReferenceUpdateContext(
    val source: BuildingBlockDefinitionId,
    val target: BuildingBlockDefinitionId,
    val index: BuildingBlockReferenceIndex,
    val planner: BuildingBlockReferenceUpdatePlanner,
    val targetFields: TargetFields,
    val analyses: List<ChainAnalysis>,
    val draftsAllowed: Boolean,
)

class ReferenceUpdatePlan(
    val selectedAnalyses: List<ChainAnalysis>,
    val newDraftVersions: Map<ReferenceContainer, Semver>,
    val changes: List<LinkChange>,
    val conflicts: Map<String, NotUpdatableReason>,
    val covered: Set<String>,
    val skipped: List<String>,
    val resolutions: Map<String, ChainResolution>,
) {
    /** The container version a change is written to. */
    fun containerOf(writable: WritableVersion): ReferenceContainer = when (writable) {
        is InPlaceDraft -> writable.original
        is ExistingDraft -> writable.draft.container
        is NewDraft -> writable.original.withVersion(
            newDraftVersions[writable.original] ?: error("No draft version allocated for ${writable.original}")
        )
    }

    /** Containers that exist already and get written to. */
    val existingWrittenContainers: List<ReferenceContainer>
        get() = changes.map { it.writable }.filter { it !is NewDraft }.map { containerOf(it) }.distinct()
}

data class LinkChangeKey(
    val container: ReferenceContainer,
    val location: ReferenceLocation,
    val childKey: String,
)

/** Change to one link; [newChild] is null when only plugin configurations are added. */
data class LinkChange(
    val writable: WritableVersion,
    val link: IndexedReference,
    val newChild: BuildingBlockDefinitionId?,
    val containerReference: Boolean,
    val dropAgainstTarget: Boolean,
    val addInputs: List<BuildingBlockInputMapping>,
    val addPlugins: Map<String, UUID>,
) {
    val key get() = LinkChangeKey(writable.identity, link.location, link.child.key)

    /** The new child when the link is re-pointed, null when it keeps its child. */
    val repointedTo: BuildingBlockDefinitionId? get() = newChild?.takeIf { it != link.child }

    fun conflictWith(other: LinkChange): NotUpdatableReason? {
        val where = mapOf("location" to link.location.toString(), "container" to writable.identity.label())
        if (newChild != null && other.newChild != null && newChild != other.newChild) {
            return NotUpdatableReason(CONFLICT_CHILD, where + mapOf("first" to "$newChild", "second" to "${other.newChild}"))
        }
        val inputConflict = addInputs.firstOrNull { mine ->
            other.addInputs.any { normalizeField(it.target) == normalizeField(mine.target) && it.source != mine.source }
        }
        if (inputConflict != null) {
            return NotUpdatableReason(CONFLICT_INPUT, where + ("input" to inputConflict.target))
        }
        val pluginConflict = addPlugins.keys.firstOrNull { other.addPlugins[it] != null && other.addPlugins[it] != addPlugins[it] }
        if (pluginConflict != null) {
            return NotUpdatableReason(CONFLICT_PLUGIN, where + ("plugin" to pluginConflict))
        }
        return null
    }

    fun mergedWith(other: LinkChange) = copy(
        newChild = newChild ?: other.newChild,
        containerReference = containerReference || other.containerReference,
        dropAgainstTarget = dropAgainstTarget || other.dropAgainstTarget,
        addInputs = (addInputs + other.addInputs).distinctBy { normalizeField(it.target) },
        addPlugins = addPlugins + other.addPlugins,
    )

    fun inputMappings(targetFields: TargetFields, current: List<BuildingBlockInputMapping>): List<BuildingBlockInputMapping> {
        val kept = if (dropAgainstTarget) current.filter { targetFields.has(it.target) } else current
        val added = addInputs.filter { added -> kept.none { normalizeField(it.target) == normalizeField(added.target) } }
        return kept + added
    }

    fun outputMappings(targetFields: TargetFields, current: List<BuildingBlockOutputMapping>): List<BuildingBlockOutputMapping> =
        if (dropAgainstTarget) current.filter { targetFields.has(it.source) } else current
}
