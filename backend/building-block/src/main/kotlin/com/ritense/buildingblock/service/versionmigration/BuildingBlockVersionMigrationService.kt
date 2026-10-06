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

package com.ritense.buildingblock.service.versionmigration

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.exception.BuildingBlockVersionMigrationException
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.processlink.dto.BuildingBlockInputMappingDto
import com.ritense.buildingblock.processlink.dto.BuildingBlockOutputMappingDto
import com.ritense.buildingblock.repository.BuildingBlockProcessLinkRepository
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.service.BuildingBlockFieldService
import com.ritense.buildingblock.service.BuildingBlockManagementService
import com.ritense.buildingblock.service.BuildingBlockPluginDefinitionService
import com.ritense.buildingblock.web.rest.dto.BuildingBlockInUseVersionDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationChainDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationChainResolutionDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationChangesetDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationContainerType.BUILDING_BLOCK
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationContainerType.CASE
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationDifferencesDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationDraftDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationExecuteRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationExistingDraftDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationPreviewDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationPreviewRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationRepointDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationResultDto
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case.web.rest.dto.CaseDefinitionDraftCreateRequest
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginService
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinitionId
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX
import com.ritense.valtimo.service.OperatonProcessService
import jakarta.persistence.EntityManager
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.ProcessDefinition
import org.operaton.bpm.model.bpmn.Bpmn
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.CallActivity
import org.operaton.bpm.model.xml.instance.ModelElementInstance
import org.semver4j.Semver
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.UUID

/** Re-points references to one building block version onto another, writing only to drafts (#841). */
@Service
@SkipComponentScan
class BuildingBlockVersionMigrationService(
    private val usageIndexLoader: BuildingBlockUsageIndexLoader,
    private val buildingBlockManagementService: BuildingBlockManagementService,
    private val caseDefinitionService: CaseDefinitionService,
    private val buildingBlockFieldService: BuildingBlockFieldService,
    private val buildingBlockPluginDefinitionService: BuildingBlockPluginDefinitionService,
    private val buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker,
    private val operatonProcessService: OperatonProcessService,
    private val repositoryService: RepositoryService,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository,
    private val processLinkRepository: ProcessLinkRepository,
    private val buildingBlockProcessLinkRepository: BuildingBlockProcessLinkRepository,
    private val caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val pluginService: PluginService,
    private val authorizationService: AuthorizationService,
    private val entityManager: EntityManager,
) {

    @Transactional(readOnly = true)
    fun getInUseVersions(key: String?): List<BuildingBlockInUseVersionDto> {
        denyAuthorization()

        val index = usageIndexLoader.load(key?.takeIf { it.isNotBlank() })
        return index.references
            .groupBy { it.child }
            .map { (child, references) ->
                val info = index.info(MigrationContainer.of(child))
                BuildingBlockInUseVersionDto(
                    key = child.key,
                    versionTag = child.versionTag.toString(),
                    name = info?.name,
                    final = info?.final ?: true,
                    referenceCount = references.size,
                )
            }
            .sortedWith(
                compareBy<BuildingBlockInUseVersionDto> { it.key }
                    .thenByDescending { Semver.parse(it.versionTag) }
            )
    }

    @Transactional(readOnly = true)
    fun preview(request: BuildingBlockVersionMigrationPreviewRequestDto): BuildingBlockVersionMigrationPreviewDto {
        denyAuthorization()

        val context = prepare(request.key, request.sourceVersionTag, request.targetVersionTag)
        val selected = request.selectedChainIds?.toSet()
            ?: context.analyses.filter { it.selectedByDefault }.map { it.chain.id }.toSet()
        val plan = buildPlan(context, selected, toResolutions(request.resolutions))

        return BuildingBlockVersionMigrationPreviewDto(
            key = context.source.key,
            sourceVersionTag = context.source.versionTag.toString(),
            targetVersionTag = context.target.versionTag.toString(),
            draftsAllowed = context.draftsAllowed,
            chains = context.analyses.map { toChainDto(context, plan, it) },
            changeset = toChangesetDto(context, plan),
        )
    }

    @Transactional
    fun execute(request: BuildingBlockVersionMigrationExecuteRequestDto): BuildingBlockVersionMigrationResultDto {
        denyAuthorization()

        val context = prepare(request.key, request.sourceVersionTag, request.targetVersionTag)
        if (!context.draftsAllowed) {
            throw BuildingBlockVersionMigrationException(
                "This environment does not allow drafts, so building block references cannot be migrated here."
            )
        }

        val selected = request.selectedChainIds.toSet()
        val knownIds = context.analyses.map { it.chain.id }.toSet()
        val unknown = selected - knownIds
        if (selected.isEmpty() || unknown.isNotEmpty()) {
            throw BuildingBlockVersionMigrationException(
                if (selected.isEmpty()) "Select at least one chain to migrate."
                else "Unknown chains selected: ${unknown.joinToString()}. Refresh the preview and try again."
            )
        }

        val resolutions = toResolutions(request.resolutions)
        validateResolutions(context, resolutions)
        val plan = buildPlan(context, selected, resolutions)
        assertExecutable(context, plan, resolutions)

        val draftsCreated = createDrafts(plan)
        applyChanges(context, plan)
        entityManager.flush()

        val after = usageIndexLoader.load(context.source.key)
        return BuildingBlockVersionMigrationResultDto(
            key = context.source.key,
            sourceVersionTag = context.source.versionTag.toString(),
            targetVersionTag = context.target.versionTag.toString(),
            chainsMigratedDirectly = plan.selectedAnalyses
                .filter { !it.requiresDrafts && !it.modifiesExistingDraft }
                .map { it.chain.id },
            linksRepointed = toRepointDtos(context, plan),
            draftsCreated = draftsCreated,
            draftsModified = toModifiedDraftDtos(context, plan),
            skippedChainIds = plan.skipped.toList(),
            remainingReferences = after.referencesTo(context.source).map { it.toDto(after) },
        )
    }

    private fun prepare(key: String, sourceVersionTag: String, targetVersionTag: String): MigrationContext {
        val source = parseId(key, sourceVersionTag)
        val target = parseId(key, targetVersionTag)
        if (source == target) {
            throw BuildingBlockVersionMigrationException("Source and target are the same version: $source.")
        }

        val index = usageIndexLoader.load()
        if (index.info(MigrationContainer.of(source)) == null) {
            throw BuildingBlockVersionMigrationException("Building block $source does not exist.")
        }
        if (index.info(MigrationContainer.of(target)) == null) {
            throw BuildingBlockVersionMigrationException("Building block $target does not exist.")
        }

        val targetFields = TargetFields(buildingBlockFieldService.getFields(target))
        val targetPluginKeys = buildingBlockPluginDefinitionService.getPluginDefinitionKeysForBuildingBlock(target)
        val draftsAllowed = buildingBlockDefinitionChecker.canUpdateGlobalConfiguration()
        val planner = BuildingBlockVersionMigrationPlanner(index, source, target, targetFields, targetPluginKeys, draftsAllowed)
        val analyses = planner.findChains().map { planner.analyze(it) }

        return MigrationContext(source, target, index, planner, targetFields, analyses, draftsAllowed)
    }

    private fun parseId(key: String, versionTag: String): BuildingBlockDefinitionId = try {
        BuildingBlockDefinitionId.of(key, versionTag)
    } catch (e: IllegalArgumentException) {
        throw BuildingBlockVersionMigrationException(e.message ?: "Invalid building block version $key:$versionTag")
    }

    private fun toResolutions(resolutions: List<BuildingBlockVersionMigrationChainResolutionDto>): Map<String, ChainResolution> =
        resolutions.associate { resolution ->
            resolution.chainId to ChainResolution(
                inputMappings = resolution.inputMappings.map { BuildingBlockInputMapping(it.source, it.target) },
                pluginConfigurations = resolution.pluginConfigurations,
            )
        }

    private fun validateResolutions(context: MigrationContext, resolutions: Map<String, ChainResolution>) {
        resolutions.forEach { (chainId, resolution) ->
            resolution.inputMappings.forEach { mapping ->
                if (mapping.source.isBlank() || !context.targetFields.has(mapping.target)) {
                    throw BuildingBlockVersionMigrationException(
                        "Chain $chainId maps '${mapping.source}' to '${mapping.target}', which is not a field of ${context.target}."
                    )
                }
            }
            resolution.pluginConfigurations.forEach { (pluginDefinitionKey, configurationId) ->
                val configuration = pluginService.findPluginConfiguration(PluginConfigurationId.existingId(configurationId))
                if (configuration == null || configuration.pluginDefinition.key != pluginDefinitionKey) {
                    throw BuildingBlockVersionMigrationException(
                        "Chain $chainId selects plugin configuration $configurationId for '$pluginDefinitionKey', " +
                            "but no configuration of that plugin exists with that id."
                    )
                }
            }
        }
    }

    private fun assertExecutable(context: MigrationContext, plan: MigrationPlan, resolutions: Map<String, ChainResolution>) {
        val problems = plan.selectedAnalyses.mapNotNull { analysis ->
            val chainId = analysis.chain.id
            val resolution = resolutions[chainId]
            when {
                !analysis.migratable -> "Chain $chainId cannot be migrated: ${analysis.notMigratableReason}"
                plan.conflicts.containsKey(chainId) -> "Chain $chainId conflicts with another selected chain: ${plan.conflicts[chainId]}"
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
            throw BuildingBlockVersionMigrationException(problems.joinToString(" "))
        }
    }

    private fun buildPlan(
        context: MigrationContext,
        selectedIds: Set<String>,
        resolutions: Map<String, ChainResolution>,
    ): MigrationPlan {
        val selectedAnalyses = context.analyses.filter { it.chain.id in selectedIds }
        val draftVersions = context.planner.allocateDraftVersions(
            selectedAnalyses.filter { it.migratable }.flatMap { it.writables }.filterIsInstance<NewDraft>().map { it.original }
        )

        val changes = linkedMapOf<LinkChangeKey, LinkChange>()
        val conflicts = linkedMapOf<String, String>()
        selectedAnalyses.filter { it.migratable }.forEach { analysis ->
            val proposals = proposeChanges(context, analysis, resolutions[analysis.chain.id], draftVersions)
            val conflict = proposals.firstNotNullOfOrNull { proposal -> changes[proposal.key]?.conflictWith(proposal) }
            if (conflict != null) {
                conflicts[analysis.chain.id] = conflict
            } else {
                proposals.forEach { proposal -> changes.merge(proposal.key, proposal) { existing, new -> existing.mergedWith(new) } }
            }
        }

        val covered = context.analyses
            .filter { it.chain.id !in selectedIds && it.migratable }
            .filter { analysis ->
                val proposals = proposeChanges(context, analysis, null, draftVersions, requireAllocated = true)
                proposals != null && proposals.all { proposal ->
                    proposal.newChild == null || changes[proposal.key]?.newChild == proposal.newChild
                }
            }
            .map { it.chain.id }
            .toSet()

        val usedDraftBases = changes.values.map { it.writable }.filterIsInstance<NewDraft>().map { it.original }.toSet()
        return MigrationPlan(
            selectedAnalyses = selectedAnalyses,
            newDraftVersions = draftVersions.filterKeys { it in usedDraftBases },
            changes = changes.values.toList(),
            conflicts = conflicts,
            covered = covered,
            skipped = context.analyses.map { it.chain.id }.filter { it !in selectedIds && it !in covered },
            resolutions = resolutions,
        )
    }

    private fun proposeChanges(
        context: MigrationContext,
        analysis: ChainAnalysis,
        resolution: ChainResolution?,
        draftVersions: Map<MigrationContainer, Semver>,
    ): List<LinkChange> = proposeChanges(context, analysis, resolution, draftVersions, requireAllocated = false)!!

    private fun proposeChanges(
        context: MigrationContext,
        analysis: ChainAnalysis,
        resolution: ChainResolution?,
        draftVersions: Map<MigrationContainer, Semver>,
        requireAllocated: Boolean,
    ): List<LinkChange>? {
        if (requireAllocated && analysis.writables.any { it is NewDraft && it.original !in draftVersions }) {
            return null
        }
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

    private fun versionOf(writable: WritableVersion, draftVersions: Map<MigrationContainer, Semver>): Semver = when (writable) {
        is InPlaceDraft -> writable.original.versionTag
        is ExistingDraft -> writable.draft.container.versionTag
        is NewDraft -> draftVersions[writable.original]
            ?: throw IllegalStateException("No draft version allocated for ${writable.original}")
    }

    private fun containerOf(writable: WritableVersion, plan: MigrationPlan): MigrationContainer = when (writable) {
        is InPlaceDraft -> writable.original
        is ExistingDraft -> writable.draft.container
        is NewDraft -> writable.original.withVersion(versionOf(writable, plan.newDraftVersions))
    }

    private fun createDrafts(plan: MigrationPlan): List<BuildingBlockVersionMigrationDraftDto> =
        plan.newDraftVersions.map { (base, newVersion) ->
            runWithoutAuthorization {
                when (base.type) {
                    BUILDING_BLOCK -> buildingBlockManagementService.createDraft(
                        base.key,
                        base.versionTag.toString(),
                        newVersion.toString()
                    )
                    CASE -> caseDefinitionService.createCaseDefinitionDraft(
                        CaseDefinitionDraftCreateRequest(
                            caseDefinitionKey = base.key,
                            caseDefinitionVersion = newVersion.toString(),
                            basedOnCaseDefinitionVersion = base.versionTag.toString(),
                        )
                    )
                }
            }
            BuildingBlockVersionMigrationDraftDto(base.type, base.key, newVersion.toString(), base.versionTag.toString())
        }

    private fun applyChanges(context: MigrationContext, plan: MigrationPlan) {
        plan.changes
            .filter { it.link.location is CaseLinkLocation }
            .forEach { applyCaseLinkChange(context, containerOf(it.writable, plan), it) }

        plan.changes
            .filter { it.link.location is ProcessLinkLocation }
            .groupBy { containerOf(it.writable, plan) to (it.link.location as ProcessLinkLocation).processDefinitionKey }
            .forEach { (group, changes) -> applyProcessChanges(context, group.first, group.second, changes) }
    }

    private fun applyCaseLinkChange(context: MigrationContext, container: MigrationContainer, change: LinkChange) {
        val caseDefinitionId = CaseDefinitionId.of(container.key, container.versionTag.toString())
        val candidates = caseDefinitionBuildingBlockLinkRepository.findAllByCaseDefinitionId(caseDefinitionId)
            .filter { it.buildingBlockDefinitionId.key == change.link.child.key }
        val link = candidates.firstOrNull { it.buildingBlockDefinitionId == change.link.child }
            ?: candidates.singleOrNull()
            ?: throw IllegalStateException("$container has no building block link to ${change.link.child.key}")

        caseDefinitionBuildingBlockLinkRepository.save(
            CaseDefinitionBuildingBlockLink(
                id = link.id,
                caseDefinitionId = link.caseDefinitionId,
                buildingBlockDefinitionId = change.newChild ?: link.buildingBlockDefinitionId,
                inputMappings = change.inputMappings(context, link.inputMappings),
                outputMappings = change.outputMappings(context, link.outputMappings),
                pluginConfigurationMappings = link.pluginConfigurationMappings + change.addPlugins,
                startableByUser = link.startableByUser,
            )
        )
    }

    private fun applyProcessChanges(
        context: MigrationContext,
        container: MigrationContainer,
        processDefinitionKey: String,
        changes: List<LinkChange>,
    ) {
        val processDefinition = processDefinitionIn(container, processDefinitionKey)
        val repointed = changes.filter { change ->
            val current = currentLink(processDefinition.id, change)
            change.newChild != null && change.newChild != current.buildingBlockDefinitionId
        }

        val processDefinitionId = if (repointed.isEmpty()) {
            processDefinition.id
        } else {
            val model = runWithoutAuthorization {
                operatonProcessService.getBpmnModelInstanceByProcessDefinitionId(processDefinition.id)
            }
            repointed.forEach { change -> pointCallActivity(model, change, container) }
            redeploy(container, processDefinition, model)
        }

        changes.forEach { change ->
            val link = currentLink(processDefinitionId, change)
            buildingBlockProcessLinkRepository.save(
                link.copy(
                    buildingBlockDefinitionId = change.newChild ?: link.buildingBlockDefinitionId,
                    inputMappings = change.inputMappings(context, link.inputMappings),
                    outputMappings = change.outputMappings(context, link.outputMappings),
                    pluginConfigurationMappings = link.pluginConfigurationMappings + change.addPlugins,
                )
            )
        }
    }

    private fun currentLink(processDefinitionId: String, change: LinkChange): BuildingBlockProcessLink {
        val activityId = (change.link.location as ProcessLinkLocation).activityId
        return processLinkRepository.findByProcessDefinitionIdAndActivityId(processDefinitionId, activityId)
            .filterIsInstance<BuildingBlockProcessLink>()
            .singleOrNull()
            ?: throw IllegalStateException(
                "Process definition $processDefinitionId has no building block link on activity '$activityId'"
            )
    }

    private fun pointCallActivity(model: BpmnModelInstance, change: LinkChange, container: MigrationContainer) {
        val location = change.link.location as ProcessLinkLocation
        val newChild = change.newChild!!
        val callActivity = model.getModelElementById<ModelElementInstance>(location.activityId) as? CallActivity
            ?: throw IllegalStateException("Activity '${location.activityId}' in $container is not a call activity")
        callActivity.calledElement = mainProcessDefinitionKey(newChild)
        callActivity.operatonCalledElementBinding = "versionTag"
        callActivity.operatonCalledElementVersionTag = OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX + newChild
    }

    /** Deploys the changed BPMN as the container's new version of the process; the copy listener carries every process link over. */
    private fun redeploy(container: MigrationContainer, processDefinition: ProcessDefinition, model: BpmnModelInstance): String {
        val caseOwnership = if (container.type == CASE) {
            processDefinitionCaseDefinitionRepository.findByIdProcessDefinitionId(ProcessDefinitionId(processDefinition.id))
        } else {
            null
        }
        val buildingBlockId = BuildingBlockDefinitionId(container.key, container.versionTag)
        val buildingBlockOwnership = if (container.type == BUILDING_BLOCK) {
            processDefinitionBuildingBlockDefinitionRepository.findByIdBuildingBlockDefinitionIdAndIdProcessDefinitionId(
                buildingBlockId,
                ProcessDefinitionId.of(processDefinition.id)
            )
        } else {
            null
        }

        val bpmn = ByteArrayOutputStream().also { Bpmn.writeModelToStream(it, model) }.toByteArray()
        val deployment = runWithoutAuthorization {
            operatonProcessService.deploy(
                container.blueprintId(),
                processDefinition.resourceName,
                ByteArrayInputStream(bpmn),
                false,
                false,
                false,
                null,
                processDefinition.id
            )
        } ?: return processDefinition.id

        val deployed = deployment.deployedProcessDefinitions.firstOrNull { it.key == processDefinition.key }
            ?: deployment.deployedProcessDefinitions.first()
        if (processDefinition.isSuspended) {
            repositoryService.suspendProcessDefinitionById(deployed.id)
        }

        when (container.type) {
            CASE -> processDefinitionCaseDefinitionRepository.save(
                ProcessDefinitionCaseDefinition(
                    ProcessDefinitionCaseDefinitionId(
                        ProcessDefinitionId(deployed.id),
                        CaseDefinitionId.of(container.key, container.versionTag.toString())
                    ),
                    canInitializeDocument = caseOwnership?.canInitializeDocument ?: false,
                    startableByUser = caseOwnership?.startableByUser ?: false,
                )
            )
            BUILDING_BLOCK -> {
                buildingBlockOwnership?.let { processDefinitionBuildingBlockDefinitionRepository.delete(it) }
                processDefinitionBuildingBlockDefinitionRepository.save(
                    ProcessDefinitionBuildingBlockDefinition(
                        ProcessDefinitionBuildingBlockDefinitionId(ProcessDefinitionId.of(deployed.id), buildingBlockId),
                        buildingBlockOwnership?.main ?: false
                    )
                )
            }
        }
        return deployed.id
    }

    private fun processDefinitionIn(container: MigrationContainer, processDefinitionKey: String): ProcessDefinition {
        val processDefinitionIds = when (container.type) {
            BUILDING_BLOCK -> processDefinitionBuildingBlockDefinitionRepository
                .findAllByIdBuildingBlockDefinitionId(BuildingBlockDefinitionId(container.key, container.versionTag))
                .map { it.id.processDefinitionId.id }
            CASE -> processDefinitionCaseDefinitionRepository
                .findByIdCaseDefinitionId(CaseDefinitionId.of(container.key, container.versionTag.toString()))
                .map { it.id.processDefinitionId.id }
        }
        if (processDefinitionIds.isEmpty()) {
            throw IllegalStateException("$container has no process definitions")
        }
        return repositoryService.createProcessDefinitionQuery()
            .processDefinitionIdIn(*processDefinitionIds.toTypedArray())
            .processDefinitionKey(processDefinitionKey)
            .list()
            .singleOrNull()
            ?: throw IllegalStateException("$container has no single process definition '$processDefinitionKey'")
    }

    private fun mainProcessDefinitionKey(buildingBlockDefinitionId: BuildingBlockDefinitionId): String {
        val processDefinitionId = processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(buildingBlockDefinitionId)
            .firstOrNull { it.main }
            ?.id?.processDefinitionId?.id
            ?: throw BuildingBlockVersionMigrationException(
                "Building block $buildingBlockDefinitionId has no main process, so a call activity cannot start it."
            )
        return repositoryService.getProcessDefinition(processDefinitionId).key
    }

    private fun toChainDto(
        context: MigrationContext,
        plan: MigrationPlan,
        analysis: ChainAnalysis,
    ): BuildingBlockVersionMigrationChainDto {
        val index = context.index
        val chain = analysis.chain
        val references = chain.hops.reversed().map { it.toDto(index) }
        val conflict = plan.conflicts[chain.id]
        return BuildingBlockVersionMigrationChainDto(
            id = chain.id,
            containers = chain.containers.reversed().map { it.toDto(index.isFinal(it)) },
            references = references,
            link = references.last(),
            selected = plan.selectedAnalyses.any { it.chain.id == chain.id },
            selectedByDefault = analysis.selectedByDefault,
            requiresDrafts = analysis.requiresDrafts,
            modifiesExistingDraft = analysis.modifiesExistingDraft,
            existingDrafts = analysis.existingDrafts.map {
                BuildingBlockVersionMigrationExistingDraftDto(
                    container = it.original.toDto(true),
                    draftVersionTag = it.draft.container.versionTag.toString(),
                    draftBasedOnVersionTag = it.draft.basedOnVersionTag?.toString(),
                )
            },
            migratable = analysis.migratable && conflict == null,
            notMigratableReason = analysis.notMigratableReason ?: conflict?.let { "Conflicts with another selected chain: $it" },
            differences = toDifferencesDto(context, analysis, plan.resolutions[chain.id]),
        )
    }

    private fun toDifferencesDto(
        context: MigrationContext,
        analysis: ChainAnalysis,
        resolution: ChainResolution?,
    ): BuildingBlockVersionMigrationDifferencesDto {
        val differences = analysis.differences
        return BuildingBlockVersionMigrationDifferencesDto(
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

    private fun toChangesetDto(context: MigrationContext, plan: MigrationPlan) = BuildingBlockVersionMigrationChangesetDto(
        draftsToCreate = plan.newDraftVersions.map { (base, version) ->
            BuildingBlockVersionMigrationDraftDto(base.type, base.key, version.toString(), base.versionTag.toString())
        },
        draftsToModify = toModifiedDraftDtos(context, plan),
        linksToRepoint = toRepointDtos(context, plan),
        skippedChainIds = plan.skipped,
        coveredChainIds = plan.covered.toList(),
    )

    private fun toModifiedDraftDtos(context: MigrationContext, plan: MigrationPlan): List<BuildingBlockVersionMigrationDraftDto> =
        plan.changes.map { it.writable }
            .filter { it !is NewDraft }
            .map { containerOf(it, plan) }
            .distinct()
            .map { container ->
                BuildingBlockVersionMigrationDraftDto(
                    container.type,
                    container.key,
                    container.versionTag.toString(),
                    context.index.info(container)?.basedOnVersionTag?.toString(),
                )
            }

    private fun toRepointDtos(context: MigrationContext, plan: MigrationPlan): List<BuildingBlockVersionMigrationRepointDto> =
        plan.changes
            .filter { it.newChild != null && it.newChild != it.link.child }
            .map { change ->
                val location = change.link.location
                BuildingBlockVersionMigrationRepointDto(
                    container = containerOf(change.writable, plan).toDto(false),
                    kind = location.kind,
                    processDefinitionKey = (location as? ProcessLinkLocation)?.processDefinitionKey,
                    activityId = (location as? ProcessLinkLocation)?.activityId,
                    buildingBlockKey = change.link.child.key,
                    fromVersionTag = change.link.child.versionTag.toString(),
                    toVersionTag = change.newChild!!.versionTag.toString(),
                    containerReference = change.containerReference,
                )
            }

    private fun LinkChange.inputMappings(
        context: MigrationContext,
        current: List<BuildingBlockInputMapping>,
    ): List<BuildingBlockInputMapping> {
        val kept = if (dropAgainstTarget) current.filter { context.targetFields.has(it.target) } else current
        val added = addInputs.filter { added -> kept.none { normalizeField(it.target) == normalizeField(added.target) } }
        return kept + added
    }

    private fun LinkChange.outputMappings(
        context: MigrationContext,
        current: List<BuildingBlockOutputMapping>,
    ): List<BuildingBlockOutputMapping> =
        if (dropAgainstTarget) current.filter { context.targetFields.has(it.source) } else current

    private fun denyAuthorization() {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                BuildingBlockDefinition::class.java,
                Action.deny()
            )
        )
    }

    class MigrationContext(
        val source: BuildingBlockDefinitionId,
        val target: BuildingBlockDefinitionId,
        val index: BuildingBlockUsageIndex,
        val planner: BuildingBlockVersionMigrationPlanner,
        val targetFields: TargetFields,
        val analyses: List<ChainAnalysis>,
        val draftsAllowed: Boolean,
    )

    class MigrationPlan(
        val selectedAnalyses: List<ChainAnalysis>,
        val newDraftVersions: Map<MigrationContainer, Semver>,
        val changes: List<LinkChange>,
        val conflicts: Map<String, String>,
        val covered: Set<String>,
        val skipped: List<String>,
        val resolutions: Map<String, ChainResolution> = emptyMap(),
    )

    data class LinkChangeKey(
        val container: MigrationContainer,
        val location: ReferenceLocation,
        val childKey: String,
    )

    data class LinkChange(
        val writable: WritableVersion,
        val link: UsageReference,
        val newChild: BuildingBlockDefinitionId?,
        val containerReference: Boolean,
        val dropAgainstTarget: Boolean,
        val addInputs: List<BuildingBlockInputMapping>,
        val addPlugins: Map<String, UUID>,
    ) {
        val key get() = LinkChangeKey(writable.identity, link.location, link.child.key)

        fun conflictWith(other: LinkChange): String? {
            if (newChild != null && other.newChild != null && newChild != other.newChild) {
                return "${link.location} in ${writable.identity} would point to both $newChild and ${other.newChild}"
            }
            val inputConflict = addInputs.firstOrNull { mine ->
                other.addInputs.any { normalizeField(it.target) == normalizeField(mine.target) && it.source != mine.source }
            }
            if (inputConflict != null) {
                return "input '${inputConflict.target}' of ${link.location} in ${writable.identity} gets two different sources"
            }
            val pluginConflict = addPlugins.keys.firstOrNull { other.addPlugins[it] != null && other.addPlugins[it] != addPlugins[it] }
            if (pluginConflict != null) {
                return "plugin '$pluginConflict' of ${link.location} in ${writable.identity} gets two different configurations"
            }
            return null
        }

        fun mergedWith(other: LinkChange) = copy(
            newChild = newChild ?: other.newChild,
            containerReference = containerReference || other.containerReference,
            dropAgainstTarget = dropAgainstTarget || other.dropAgainstTarget,
            addInputs = (addInputs + other.addInputs).distinct(),
            addPlugins = addPlugins + other.addPlugins,
        )
    }
}
