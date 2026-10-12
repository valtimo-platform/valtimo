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

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.exception.BuildingBlockReferenceUpdateException
import com.ritense.buildingblock.exception.UnknownBuildingBlockDefinitionException
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.service.BuildingBlockFieldService
import com.ritense.buildingblock.service.BuildingBlockPluginDefinitionService
import com.ritense.buildingblock.service.referenceupdate.BuildingBlockReferenceUpdateMapper.fingerprint
import com.ritense.buildingblock.service.referenceupdate.BuildingBlockReferenceUpdateMapper.toChainDto
import com.ritense.buildingblock.service.referenceupdate.BuildingBlockReferenceUpdateMapper.toChangesetDto
import com.ritense.buildingblock.service.referenceupdate.BuildingBlockReferenceUpdateMapper.toModifiedDraftDtos
import com.ritense.buildingblock.service.referenceupdate.BuildingBlockReferenceUpdateMapper.toRepointDtos
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateChainResolutionDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateExecuteRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdatePreviewDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdatePreviewRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateReasonCode.CONFLICT_SECOND_DRAFT
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateResultDto
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.persistence.EntityManager
import org.semver4j.Semver
import org.springframework.transaction.annotation.Isolation
import org.springframework.transaction.annotation.Transactional

/** Re-points building block references to another version; writes only to drafts. */
@Transactional
class BuildingBlockReferenceUpdateService(
    private val referenceIndexLoader: BuildingBlockReferenceIndexLoader,
    private val referenceUpdateApplier: BuildingBlockReferenceUpdateApplier,
    private val buildingBlockFieldService: BuildingBlockFieldService,
    private val buildingBlockPluginDefinitionService: BuildingBlockPluginDefinitionService,
    private val buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker,
    private val pluginService: PluginService,
    private val authorizationService: AuthorizationService,
    private val entityManager: EntityManager,
) {

    @Transactional(readOnly = true)
    fun getReferences(key: String, versionTag: String): List<BuildingBlockReferenceDto> {
        denyAuthorization()

        val id = parseId(key, versionTag)
        val index = referenceIndexLoader.load(key)
        if (index.info(ReferenceContainer.of(id)) == null) {
            throw UnknownBuildingBlockDefinitionException(id)
        }
        return index.referencesTo(id)
            .map { it.toDto(index) }
            .sortedWith(
                compareBy<BuildingBlockReferenceDto> { it.container.type }
                    .thenBy { it.container.key }
                    .thenByDescending { Semver.parse(it.container.versionTag) }
                    .thenBy { it.processDefinitionKey }
                    .thenBy { it.activityId }
            )
    }

    @Transactional(readOnly = true)
    fun preview(request: BuildingBlockReferenceUpdatePreviewRequestDto): BuildingBlockReferenceUpdatePreviewDto {
        denyAuthorization()

        val context = prepare(request.key, request.sourceVersionTag, request.targetKey, request.targetVersionTag)
        val selected = request.selectedChainIds?.toSet()
            ?: context.analyses.filter { it.selectedByDefault }.map { it.chain.id }.toSet()
        // Unknown chains tolerated: a preview is how a stale wizard refreshes
        val resolutions = toResolutions(request.resolutions).filterKeys { chainId -> context.analyses.any { it.chain.id == chainId } }
        validateResolutions(context, resolutions)
        val plan = buildPlan(context, selected, resolutions)
        val changeset = toChangesetDto(context, plan)

        return BuildingBlockReferenceUpdatePreviewDto(
            key = context.source.key,
            sourceVersionTag = context.source.versionTag.toString(),
            targetKey = context.target.key,
            targetVersionTag = context.target.versionTag.toString(),
            draftsAllowed = context.draftsAllowed,
            chains = context.analyses.map { toChainDto(context, plan, it) },
            changeset = changeset,
            fingerprint = fingerprint(context, changeset, plan),
        )
    }

    // MySQL's default snapshot would hide what a concurrent execute committed while this one waited on the lock
    @Transactional(isolation = Isolation.READ_COMMITTED)
    fun execute(request: BuildingBlockReferenceUpdateExecuteRequestDto): BuildingBlockReferenceUpdateResultDto {
        denyAuthorization()

        // Serializes executes for one source; the index is read after the lock
        referenceUpdateApplier.lock(ReferenceContainer.of(parseId(request.key, request.sourceVersionTag)))
        val context = prepare(request.key, request.sourceVersionTag, request.targetKey, request.targetVersionTag)
        if (!context.draftsAllowed) {
            throw BuildingBlockReferenceUpdateException(
                "This environment does not allow drafts, so building block references cannot be updated here."
            )
        }

        val selected = request.selectedChainIds.toSet()
        if (selected.isEmpty()) {
            throw BuildingBlockReferenceUpdateException("No chains selected. Select at least one reference to update.")
        }
        val unknown = selected - context.analyses.map { it.chain.id }.toSet()
        if (unknown.isNotEmpty()) {
            throw BuildingBlockReferenceUpdateException(
                "Unknown chains selected: ${unknown.joinToString()}. Refresh the preview and try again."
            )
        }

        val resolutions = toResolutions(request.resolutions)
        validateResolutions(context, resolutions)
        val plan = buildPlan(context, selected, resolutions)
        assertExecutable(context, plan, resolutions)
        if (fingerprint(context, toChangesetDto(context, plan), plan) != request.expectedFingerprint) {
            throw BuildingBlockReferenceUpdateException(
                "The references changed since the preview, so the reviewed changes are no longer accurate. " +
                    "Refresh the preview, review the changes again and retry."
            )
        }
        referenceUpdateApplier.assertWritable(plan)

        val draftsCreated = referenceUpdateApplier.createDrafts(plan)
        referenceUpdateApplier.applyChanges(context, plan)
        entityManager.flush()

        logger.info { "Updated references of ${context.source} to ${context.target}: ${draftsCreated.size} drafts created" }
        val after = referenceIndexLoader.load(context.source.key)
        return BuildingBlockReferenceUpdateResultDto(
            key = context.source.key,
            sourceVersionTag = context.source.versionTag.toString(),
            targetKey = context.target.key,
            targetVersionTag = context.target.versionTag.toString(),
            chainsUpdatedDirectly = plan.selectedAnalyses
                .filter { !it.requiresDrafts && !it.modifiesExistingDraft }
                .map { it.chain.id },
            linksRepointed = toRepointDtos(plan),
            draftsCreated = draftsCreated,
            draftsModified = toModifiedDraftDtos(context, plan),
            skippedChainIds = plan.skipped.toList(),
            remainingReferences = after.referencesTo(context.source).map { it.toDto(after) },
        )
    }

    private fun prepare(key: String, sourceVersionTag: String, targetKey: String?, targetVersionTag: String): ReferenceUpdateContext {
        val source = parseId(key, sourceVersionTag)
        val target = parseId(targetKey?.takeIf { it.isNotBlank() } ?: key, targetVersionTag)
        if (source == target) {
            throw BuildingBlockReferenceUpdateException("Source and target are the same version: $source.")
        }

        val index = referenceIndexLoader.load()
        if (index.info(ReferenceContainer.of(source)) == null) {
            throw UnknownBuildingBlockDefinitionException(source)
        }
        if (index.info(ReferenceContainer.of(target)) == null) {
            throw UnknownBuildingBlockDefinitionException(target)
        }

        val targetFields = TargetFields(buildingBlockFieldService.getFields(target))
        val targetPluginKeys = buildingBlockPluginDefinitionService.getPluginDefinitionKeysForBuildingBlock(target)
        val draftsAllowed = buildingBlockDefinitionChecker.canUpdateGlobalConfiguration()
        val planner = BuildingBlockReferenceUpdatePlanner(index, source, target, targetFields, targetPluginKeys, draftsAllowed)
        val analyses = planner.findChains().map { planner.analyze(it) }

        return ReferenceUpdateContext(source, target, index, planner, targetFields, analyses, draftsAllowed)
    }

    private fun parseId(key: String, versionTag: String): BuildingBlockDefinitionId = try {
        BuildingBlockDefinitionId.of(key, versionTag)
    } catch (e: IllegalArgumentException) {
        throw BuildingBlockReferenceUpdateException(e.message ?: "Invalid building block version $key:$versionTag")
    }

    private fun toResolutions(resolutions: List<BuildingBlockReferenceUpdateChainResolutionDto>): Map<String, ChainResolution> {
        val duplicates = resolutions.groupingBy { it.chainId }.eachCount().filterValues { it > 1 }.keys
        if (duplicates.isNotEmpty()) {
            throw BuildingBlockReferenceUpdateException("Duplicate resolutions for chains: ${duplicates.joinToString()}.")
        }
        return resolutions.associate { resolution ->
            resolution.chainId to ChainResolution(
                inputMappings = resolution.inputMappings.map { BuildingBlockInputMapping(it.source, it.target) },
                pluginConfigurations = resolution.pluginConfigurations,
            )
        }
    }

    private fun validateResolutions(context: ReferenceUpdateContext, resolutions: Map<String, ChainResolution>) {
        val analyses = context.analyses.associateBy { it.chain.id }
        resolutions.forEach { (chainId, resolution) ->
            val analysis = analyses[chainId]
                ?: throw BuildingBlockReferenceUpdateException(
                    "Resolution given for unknown chain $chainId. Refresh the preview and try again."
                )
            resolution.inputMappings.forEach { mapping ->
                if (!isValidSource(mapping.source)) {
                    throw BuildingBlockReferenceUpdateException(
                        "Chain $chainId maps '${mapping.source}', which is not a path starting with " +
                            "${INPUT_SOURCE_PREFIXES.joinToString(" or ")}."
                    )
                }
                if (!context.targetFields.has(mapping.target)) {
                    throw BuildingBlockReferenceUpdateException(
                        "Chain $chainId maps '${mapping.source}' to '${mapping.target}', which is not a field of ${context.target}."
                    )
                }
            }
            resolution.pluginConfigurations.forEach { (pluginDefinitionKey, configurationId) ->
                if (pluginDefinitionKey !in analysis.differences.missingPluginDefinitionKeys) {
                    throw BuildingBlockReferenceUpdateException(
                        "Chain $chainId selects a configuration for plugin '$pluginDefinitionKey', which is not missing."
                    )
                }
                val configuration = pluginService.findPluginConfiguration(PluginConfigurationId.existingId(configurationId))
                if (configuration == null || configuration.pluginDefinition.key != pluginDefinitionKey) {
                    throw BuildingBlockReferenceUpdateException(
                        "Chain $chainId selects plugin configuration $configurationId for '$pluginDefinitionKey', " +
                            "but no configuration of that plugin exists with that id."
                    )
                }
            }
        }
    }

    private fun isValidSource(source: String) =
        INPUT_SOURCE_PREFIXES.any { prefix -> source.startsWith(prefix) && source.removePrefix(prefix).trim('/').isNotBlank() }

    private fun assertExecutable(context: ReferenceUpdateContext, plan: ReferenceUpdatePlan, resolutions: Map<String, ChainResolution>) {
        val problems = plan.selectedAnalyses.mapNotNull { analysis ->
            val chainId = analysis.chain.id
            val resolution = resolutions[chainId]
            val conflict = plan.conflicts[chainId]
            when {
                !analysis.updatable ->
                    "Chain $chainId cannot be updated: ${analysis.notUpdatableReasons.joinToString(" ") { it.message }}"
                conflict != null -> "Chain $chainId cannot be updated: ${conflict.message}"
                !analysis.configured(resolution, context.targetFields) -> {
                    val inputs = analysis.unresolvedRequiredInputs(resolution, context.targetFields)
                    val plugins = analysis.unresolvedPluginDefinitionKeys(resolution)
                    "Chain $chainId is not fully configured." +
                        (if (inputs.isNotEmpty()) " Required inputs without a source: ${inputs.joinToString()}." else "") +
                        (if (plugins.isNotEmpty()) " Plugins without a configuration: ${plugins.joinToString()}." else "")
                }
                else -> null
            }
        }
        if (problems.isNotEmpty()) {
            throw BuildingBlockReferenceUpdateException(problems.joinToString(" "))
        }
    }

    private fun buildPlan(
        context: ReferenceUpdateContext,
        selectedIds: Set<String>,
        resolutions: Map<String, ChainResolution>,
    ): ReferenceUpdatePlan {
        val selectedAnalyses = context.analyses.filter { it.chain.id in selectedIds }
        val draftVersions = context.planner.allocateDraftVersions(
            selectedAnalyses.filter { it.updatable }.flatMap { it.writables }.filterIsInstance<NewDraft>().map { it.original }
        )

        val changes = linkedMapOf<LinkChangeKey, LinkChange>()
        val conflicts = linkedMapOf<String, NotUpdatableReason>()
        val newDraftBases = mutableMapOf<Pair<BuildingBlockReferenceUpdateContainerType, String>, ReferenceContainer>()
        selectedAnalyses.filter { it.updatable }.forEach { analysis ->
            val proposals = proposeChanges(context, analysis, resolutions[analysis.chain.id], draftVersions)
            val bases = analysis.writables.filterIsInstance<NewDraft>().map { it.original }
            val secondDraft = bases.firstOrNull { base -> newDraftBases[base.type to base.key].let { it != null && it != base } }
            val conflict = secondDraft?.let { NotUpdatableReason(CONFLICT_SECOND_DRAFT, mapOf("key" to it.key)) }
                ?: proposals.firstNotNullOfOrNull { proposal -> changes[proposal.key]?.conflictWith(proposal) }
            if (conflict != null) {
                conflicts[analysis.chain.id] = conflict
            } else {
                bases.forEach { newDraftBases.putIfAbsent(it.type to it.key, it) }
                proposals.forEach { proposal -> changes.merge(proposal.key, proposal) { existing, new -> existing.mergedWith(new) } }
            }
        }

        val covered = context.analyses
            .filter { it.chain.id !in selectedIds && it.updatable }
            .filter { analysis -> analysis.writables.none { it is NewDraft && it.original !in draftVersions } }
            .filter { analysis ->
                analysis.unresolvedPluginDefinitionKeys(null).isEmpty() &&
                    proposeChanges(context, analysis, null, draftVersions).all { proposal ->
                        proposal.newChild == null || changes[proposal.key]?.newChild == proposal.newChild
                    }
            }
            .map { it.chain.id }
            .toSet()

        val usedDraftBases = changes.values.map { it.writable }.filterIsInstance<NewDraft>().map { it.original }.toSet()
        return ReferenceUpdatePlan(
            selectedAnalyses = selectedAnalyses,
            newDraftVersions = draftVersions.filterKeys { it in usedDraftBases },
            changes = changes.values.toList(),
            conflicts = conflicts,
            covered = covered,
            skipped = context.analyses.map { it.chain.id }.filter { it !in selectedIds && it !in covered },
            resolutions = resolutions,
        )
    }

    /** Every [NewDraft] of [analysis] must have a version in [draftVersions]. */
    private fun proposeChanges(
        context: ReferenceUpdateContext,
        analysis: ChainAnalysis,
        resolution: ChainResolution?,
        draftVersions: Map<ReferenceContainer, Semver>,
    ): List<LinkChange> {
        val chain = analysis.chain
        val proposals = analysis.repointedHops.map { (hopIndex, writable) ->
            val link = analysis.effectiveLinks[hopIndex] ?: chain.hops[hopIndex]
            val newChild = if (hopIndex == 0) {
                context.target
            } else {
                val child = analysis.repointedHops.getValue(hopIndex - 1)
                BuildingBlockDefinitionId(child.original.key, versionOf(child, draftVersions))
            }
            LinkChange(
                writable = writable,
                link = link,
                newChild = newChild,
                containerReference = hopIndex > 0,
                dropAgainstTarget = hopIndex == 0,
                addInputs = if (hopIndex == 0) resolution?.inputMappings.orEmpty() else emptyList(),
                addPlugins = emptyMap(),
            )
        }.toMutableList()

        val pluginConfigurations = resolution?.pluginConfigurations.orEmpty()
        val topLink = analysis.topLink
        val pluginWritable = analysis.pluginWritable ?: analysis.repointedHops[chain.hops.lastIndex]
        if (pluginConfigurations.isNotEmpty() && topLink != null && pluginWritable != null) {
            proposals += LinkChange(
                writable = pluginWritable,
                link = topLink,
                newChild = null,
                containerReference = false,
                dropAgainstTarget = false,
                addInputs = emptyList(),
                addPlugins = pluginConfigurations,
            )
        }
        return proposals
    }

    private fun versionOf(writable: WritableVersion, draftVersions: Map<ReferenceContainer, Semver>): Semver = when (writable) {
        is InPlaceDraft -> writable.original.versionTag
        is ExistingDraft -> writable.draft.container.versionTag
        is NewDraft -> draftVersions[writable.original] ?: error("No draft version allocated for ${writable.original}")
    }

    private fun denyAuthorization() {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                BuildingBlockDefinition::class.java,
                Action.deny()
            )
        )
    }

    private companion object {
        val logger = KotlinLogging.logger {}
        val INPUT_SOURCE_PREFIXES = listOf("doc:", "case:")
    }
}
