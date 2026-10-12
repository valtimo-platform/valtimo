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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.exception.BuildingBlockReferenceUpdateException
import com.ritense.buildingblock.exception.UnknownBuildingBlockDefinitionException
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.BuildingBlockProcessLinkRepository
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.service.BuildingBlockManagementService
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.BUILDING_BLOCK
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.CASE
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateDraftDto
import com.ritense.case.domain.StartableItem
import com.ritense.case.domain.StartableItemId
import com.ritense.case.repository.StartableItemRepository
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case.web.rest.dto.CaseDefinitionDraftCreateRequest
import com.ritense.case.web.rest.dto.StartableItemType
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinitionId
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.processlink.event.ProcessLinkUpdatedEvent
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX
import com.ritense.valtimo.service.OperatonProcessService
import jakarta.persistence.EntityManager
import jakarta.persistence.LockModeType
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.ProcessDefinition
import org.operaton.bpm.model.bpmn.Bpmn
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.CallActivity
import org.operaton.bpm.model.xml.instance.ModelElementInstance
import org.springframework.context.ApplicationEventPublisher
import org.zalando.problem.Status
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.UUID

/** Writes a [ReferenceUpdatePlan]; callers run it in one transaction. */
class BuildingBlockReferenceUpdateApplier(
    private val buildingBlockManagementService: BuildingBlockManagementService,
    private val caseDefinitionService: CaseDefinitionService,
    private val buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker,
    private val caseDefinitionChecker: CaseDefinitionChecker,
    private val operatonProcessService: OperatonProcessService,
    private val repositoryService: RepositoryService,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository,
    private val processLinkRepository: ProcessLinkRepository,
    private val buildingBlockProcessLinkRepository: BuildingBlockProcessLinkRepository,
    private val caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val startableItemRepository: StartableItemRepository,
    private val applicationEventPublisher: ApplicationEventPublisher,
    private val entityManager: EntityManager,
) {

    /** Row lock until commit, reloading the row; concurrent updates and finalizations of this version wait. */
    fun lock(container: ReferenceContainer) {
        val definition: Any = when (container.type) {
            BUILDING_BLOCK -> entityManager.find(BuildingBlockDefinition::class.java, container.buildingBlockId())
                ?: throw UnknownBuildingBlockDefinitionException(container.buildingBlockId())
            CASE -> entityManager.find(CaseDefinition::class.java, container.caseDefinitionId())
                ?: throw BuildingBlockReferenceUpdateException(
                    "$container no longer exists. Refresh the preview and try again.",
                    Status.NOT_FOUND,
                )
        }
        entityManager.refresh(definition, LockModeType.PESSIMISTIC_WRITE)
    }

    /** Locks the written containers, then rechecks them: another admin may have finalized one since the index was read. */
    fun assertWritable(plan: ReferenceUpdatePlan) {
        plan.existingWrittenContainers
            .sortedWith(compareBy({ it.type }, { it.key }, { it.versionTag }))
            .forEach { container ->
                lock(container)
                val writable = when (container.type) {
                    BUILDING_BLOCK -> buildingBlockDefinitionChecker.canUpdateBuildingBlockDefinition(container.buildingBlockId())
                    CASE -> caseDefinitionChecker.canUpdateCaseDefinition(container.caseDefinitionId())
                }
                if (!writable) {
                    throw BuildingBlockReferenceUpdateException(
                        "$container can no longer be changed; it was finalized or removed. Refresh the preview and try again."
                    )
                }
            }
        plan.newDraftVersions.forEach { (base, version) ->
            val draft = base.withVersion(version)
            val exists = when (draft.type) {
                BUILDING_BLOCK -> entityManager.find(BuildingBlockDefinition::class.java, draft.buildingBlockId())
                CASE -> entityManager.find(CaseDefinition::class.java, draft.caseDefinitionId())
            } != null
            if (exists) {
                throw BuildingBlockReferenceUpdateException(
                    "$draft was created by someone else in the meantime. Refresh the preview and try again.",
                    Status.CONFLICT,
                )
            }
        }
    }

    fun createDrafts(plan: ReferenceUpdatePlan): List<BuildingBlockReferenceUpdateDraftDto> =
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
            BuildingBlockReferenceUpdateDraftDto(base.type, base.key, newVersion.toString(), base.versionTag.toString())
        }

    fun applyChanges(context: ReferenceUpdateContext, plan: ReferenceUpdatePlan) {
        plan.changes
            .filter { it.link.location is CaseLinkLocation }
            .forEach { applyCaseLinkChange(context, plan.containerOf(it.writable), it) }

        plan.changes
            .filter { it.link.location is ProcessLinkLocation }
            .groupBy { plan.containerOf(it.writable) to (it.link.location as ProcessLinkLocation).processDefinitionKey }
            .forEach { (group, changes) -> applyProcessChanges(context, group.first, group.second, changes) }
    }

    private fun applyCaseLinkChange(context: ReferenceUpdateContext, container: ReferenceContainer, change: LinkChange) {
        val caseDefinitionId = container.caseDefinitionId()
        val candidates = caseDefinitionBuildingBlockLinkRepository.findAllByCaseDefinitionId(caseDefinitionId)
            .filter { it.buildingBlockDefinitionId.key == change.link.child.key }
        val link = candidates.firstOrNull { it.buildingBlockDefinitionId == change.link.child }
            ?: candidates.singleOrNull()
            ?: throw IllegalStateException("$container has no building block link to ${change.link.child.key}")

        val newChild = change.newChild ?: link.buildingBlockDefinitionId
        if (newChild != link.buildingBlockDefinitionId) {
            moveStartableItem(caseDefinitionId, link.buildingBlockDefinitionId, newChild, sharedByOtherLink = candidates.size > 1)
        }
        // Key column not updatable
        val keyChanged = newChild.key != link.buildingBlockDefinitionId.key
        if (keyChanged) {
            caseDefinitionBuildingBlockLinkRepository.delete(link)
            caseDefinitionBuildingBlockLinkRepository.flush()
        }
        caseDefinitionBuildingBlockLinkRepository.save(
            CaseDefinitionBuildingBlockLink(
                id = if (keyChanged) UUID.randomUUID() else link.id,
                caseDefinitionId = link.caseDefinitionId,
                buildingBlockDefinitionId = newChild,
                inputMappings = change.inputMappings(context.targetFields, link.inputMappings),
                outputMappings = change.outputMappings(context.targetFields, link.outputMappings),
                pluginConfigurationMappings = link.pluginConfigurationMappings + change.addPlugins,
                startableByUser = link.startableByUser,
            )
        )
    }

    /** Rows are versioned per link, or one blank-version row per key in copied drafts; sort order matches on key and type. */
    private fun moveStartableItem(
        caseDefinitionId: CaseDefinitionId,
        from: BuildingBlockDefinitionId,
        to: BuildingBlockDefinitionId,
        sharedByOtherLink: Boolean,
    ) {
        val fromVersion = from.versionTag.toString()
        val rows = startableItemRepository.findAllByIdCaseDefinitionId(caseDefinitionId)
            .filter { it.id.itemType == StartableItemType.BUILDING_BLOCK && it.id.itemKey == from.key }
        // Other versioned rows of a shared key belong to the other link; otherwise they are stale rows of this one
        val ownRows = if (sharedByOtherLink) {
            rows.filter { it.id.itemVersionTag == fromVersion || it.id.itemVersionTag.isBlank() }
        } else {
            rows
        }
        val item = ownRows.firstOrNull { it.id.itemVersionTag == fromVersion }
            ?: ownRows.firstOrNull { it.id.itemVersionTag.isBlank() }
            ?: ownRows.firstOrNull()
            ?: return
        val blank = item.id.itemVersionTag.isBlank()
        val newId = StartableItemId(caseDefinitionId, to.key, StartableItemType.BUILDING_BLOCK, if (blank) "" else to.versionTag.toString())
        // A shared blank row also orders the other link
        val obsolete = ownRows.filter { it.id != newId && !(sharedByOtherLink && it.id.itemVersionTag.isBlank()) }
        if (obsolete.isNotEmpty()) {
            startableItemRepository.deleteAll(obsolete)
            startableItemRepository.flush()
        }
        if (!startableItemRepository.existsById(newId)) {
            startableItemRepository.save(StartableItem(id = newId, sortOrder = item.sortOrder))
        }
    }

    private fun applyProcessChanges(
        context: ReferenceUpdateContext,
        container: ReferenceContainer,
        processDefinitionKey: String,
        changes: List<LinkChange>,
    ) {
        val processDefinition = processDefinitionIn(container, processDefinitionKey)
        val repointed = changes.mapNotNull { change ->
            val newChild = change.newChild ?: return@mapNotNull null
            if (newChild == currentLink(processDefinition.id, change).buildingBlockDefinitionId) null else change to newChild
        }

        val processDefinitionId = if (repointed.isEmpty()) {
            processDefinition.id
        } else {
            val model = runWithoutAuthorization {
                operatonProcessService.getBpmnModelInstanceByProcessDefinitionId(processDefinition.id)
            }
            repointed.forEach { (change, newChild) -> pointCallActivity(model, change, newChild, container) }
            redeploy(container, processDefinition, model)
        }

        changes.forEach { change ->
            val link = currentLink(processDefinitionId, change)
            buildingBlockProcessLinkRepository.save(
                link.copy(
                    buildingBlockDefinitionId = change.newChild ?: link.buildingBlockDefinitionId,
                    inputMappings = change.inputMappings(context.targetFields, link.inputMappings),
                    outputMappings = change.outputMappings(context.targetFields, link.outputMappings),
                    pluginConfigurationMappings = link.pluginConfigurationMappings + change.addPlugins,
                )
            )
        }
        applicationEventPublisher.publishEvent(
            ProcessLinkUpdatedEvent(BuildingBlockProcessLink.PROCESS_LINK_TYPE, processDefinitionId)
        )
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

    private fun pointCallActivity(
        model: BpmnModelInstance,
        change: LinkChange,
        newChild: BuildingBlockDefinitionId,
        container: ReferenceContainer,
    ) {
        val location = change.link.location as ProcessLinkLocation
        val callActivity = model.getModelElementById<ModelElementInstance>(location.activityId) as? CallActivity
            ?: throw BuildingBlockReferenceUpdateException("Activity '${location.activityId}' in $container is not a call activity")
        callActivity.calledElement = mainProcessDefinitionKey(newChild)
        callActivity.operatonCalledElementBinding = "versionTag"
        callActivity.operatonCalledElementVersionTag = OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX + newChild
    }

    /** Redeploys changed BPMN; copy listener carries process links over. */
    private fun redeploy(container: ReferenceContainer, processDefinition: ProcessDefinition, model: BpmnModelInstance): String {
        val caseOwnership = if (container.type == CASE) {
            processDefinitionCaseDefinitionRepository.findByIdProcessDefinitionId(ProcessDefinitionId(processDefinition.id))
        } else {
            null
        }
        val buildingBlockId = container.buildingBlockId()
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
                    ProcessDefinitionCaseDefinitionId(ProcessDefinitionId(deployed.id), container.caseDefinitionId()),
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

    private fun processDefinitionIn(container: ReferenceContainer, processDefinitionKey: String): ProcessDefinition {
        val processDefinitionIds = when (container.type) {
            BUILDING_BLOCK -> processDefinitionBuildingBlockDefinitionRepository
                .findAllByIdBuildingBlockDefinitionId(container.buildingBlockId())
                .map { it.id.processDefinitionId.id }
            CASE -> processDefinitionCaseDefinitionRepository
                .findByIdCaseDefinitionId(container.caseDefinitionId())
                .map { it.id.processDefinitionId.id }
        }
        if (processDefinitionIds.isEmpty()) {
            throw BuildingBlockReferenceUpdateException("$container has no process definitions")
        }
        return repositoryService.createProcessDefinitionQuery()
            .processDefinitionIdIn(*processDefinitionIds.toTypedArray())
            .processDefinitionKey(processDefinitionKey)
            .list()
            .singleOrNull()
            ?: throw BuildingBlockReferenceUpdateException("$container has no single process definition '$processDefinitionKey'")
    }

    private fun mainProcessDefinitionKey(buildingBlockDefinitionId: BuildingBlockDefinitionId): String {
        val processDefinitionId = processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(buildingBlockDefinitionId)
            .firstOrNull { it.main }
            ?.id?.processDefinitionId?.id
            ?: throw BuildingBlockReferenceUpdateException(
                "Building block $buildingBlockDefinitionId has no main process, so a call activity cannot start it."
            )
        return repositoryService.getProcessDefinition(processDefinitionId).key
    }

    private fun ReferenceContainer.buildingBlockId() = BuildingBlockDefinitionId(key, versionTag)

    private fun ReferenceContainer.caseDefinitionId() = CaseDefinitionId.of(key, versionTag.toString())
}
