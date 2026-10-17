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

import com.ritense.buildingblock.processlink.dto.BuildingBlockInputMappingDto
import com.ritense.buildingblock.processlink.dto.BuildingBlockOutputMappingDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateChainDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateChangesetDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateDifferencesDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateDraftDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateExistingDraftDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateRepointDto
import java.security.MessageDigest

object BuildingBlockReferenceUpdateMapper {

    fun toChainDto(
        context: ReferenceUpdateContext,
        plan: ReferenceUpdatePlan,
        analysis: ChainAnalysis,
    ): BuildingBlockReferenceUpdateChainDto {
        val index = context.index
        val chain = analysis.chain
        val references = chain.hops.reversed().map { it.toDto(index) }
        val reasons = analysis.notUpdatableReasons + listOfNotNull(plan.conflicts[chain.id])
        return BuildingBlockReferenceUpdateChainDto(
            id = chain.id,
            containers = chain.containers.reversed().map { it.toDto(index.isFinal(it)) },
            references = references,
            link = references.last(),
            selected = plan.selectedAnalyses.any { it.chain.id == chain.id },
            selectedByDefault = analysis.selectedByDefault,
            requiresDrafts = analysis.requiresDrafts,
            modifiesExistingDraft = analysis.modifiesExistingDraft,
            existingDrafts = analysis.existingDrafts.map {
                BuildingBlockReferenceUpdateExistingDraftDto(
                    container = it.original.toDto(true),
                    draftVersionTag = it.draft.container.versionTag.toString(),
                    draftBasedOnVersionTag = it.draft.basedOnVersionTag?.toString(),
                )
            },
            updatable = reasons.isEmpty(),
            notUpdatableReasons = reasons.map { it.toDto() },
            differences = toDifferencesDto(context, analysis, plan.resolutions[chain.id]),
        )
    }

    private fun toDifferencesDto(
        context: ReferenceUpdateContext,
        analysis: ChainAnalysis,
        resolution: ChainResolution?,
    ): BuildingBlockReferenceUpdateDifferencesDto {
        val differences = analysis.differences
        return BuildingBlockReferenceUpdateDifferencesDto(
            existingInputMappings = differences.existingInputMappings.map { BuildingBlockInputMappingDto(it.source, it.target) },
            missingRequiredInputs = differences.missingRequiredInputs,
            droppedInputMappings = differences.droppedInputMappings.map { BuildingBlockInputMappingDto(it.source, it.target) },
            droppedOutputMappings = differences.droppedOutputMappings.map {
                BuildingBlockOutputMappingDto(it.source, it.target, it.syncTiming)
            },
            missingPluginDefinitionKeys = differences.missingPluginDefinitionKeys,
            pluginConfigurationLink = differences.pluginConfigurationLink?.toDto(context.index),
            unresolvedRequiredInputs = analysis.unresolvedRequiredInputs(resolution, context.targetFields),
            unresolvedPluginDefinitionKeys = analysis.unresolvedPluginDefinitionKeys(resolution),
            configured = analysis.configured(resolution, context.targetFields),
        )
    }

    fun toChangesetDto(context: ReferenceUpdateContext, plan: ReferenceUpdatePlan) = BuildingBlockReferenceUpdateChangesetDto(
        draftsToCreate = plan.newDraftVersions.map { (base, version) ->
            BuildingBlockReferenceUpdateDraftDto(base.type, base.key, version.toString(), base.versionTag.toString())
        },
        draftsToModify = toModifiedDraftDtos(context, plan),
        linksToRepoint = toRepointDtos(plan),
        skippedChainIds = plan.skipped,
        coveredChainIds = plan.covered.toList(),
    )

    fun toModifiedDraftDtos(context: ReferenceUpdateContext, plan: ReferenceUpdatePlan): List<BuildingBlockReferenceUpdateDraftDto> =
        plan.existingWrittenContainers.map { container ->
            BuildingBlockReferenceUpdateDraftDto(
                container.type,
                container.key,
                container.versionTag.toString(),
                context.index.info(container)?.basedOnVersionTag?.toString(),
            )
        }

    fun toRepointDtos(plan: ReferenceUpdatePlan): List<BuildingBlockReferenceUpdateRepointDto> =
        plan.changes.mapNotNull { change ->
            val newChild = change.repointedTo ?: return@mapNotNull null
            val location = change.link.location
            BuildingBlockReferenceUpdateRepointDto(
                container = plan.containerOf(change.writable).toDto(false),
                kind = location.kind,
                processDefinitionKey = (location as? ProcessLinkLocation)?.processDefinitionKey,
                activityId = (location as? ProcessLinkLocation)?.activityId,
                buildingBlockKey = change.link.child.key,
                fromVersionTag = change.link.child.versionTag.toString(),
                toBuildingBlockKey = newChild.key,
                toVersionTag = newChild.versionTag.toString(),
                containerReference = change.containerReference,
            )
        }

    /** Hash of everything execute would write; differs once the data behind a preview changed. */
    fun fingerprint(context: ReferenceUpdateContext, changeset: BuildingBlockReferenceUpdateChangesetDto, plan: ReferenceUpdatePlan): String {
        val changes = plan.changes.map { change ->
            listOf(
                change.writable.identity,
                change.link.location,
                change.link.child,
                change.link.inputMappings.map { it.toString() }.sorted(),
                change.link.outputMappings.map { it.toString() }.sorted(),
                change.link.pluginConfigurationMappings.toSortedMap(),
                change.newChild,
                change.addInputs.map { "${it.source}->${it.target}" }.sorted(),
                change.addPlugins.toSortedMap(),
            ).joinToString("|")
        }.sorted()
        val content = listOf(
            changeset.draftsToCreate,
            changeset.draftsToModify,
            changeset.linksToRepoint,
            changeset.skippedChainIds.sorted(),
            changeset.coveredChainIds.sorted(),
            changes,
            // Decides which mappings are dropped
            context.targetFields.names.sorted(),
        ).joinToString("\n")
        return MessageDigest.getInstance("SHA-256").digest(content.toByteArray())
            .joinToString("") { "%02x".format(it) }
    }
}
