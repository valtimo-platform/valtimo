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

package com.ritense.buildingblock.processlink.service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockSyncTiming
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockConstants.Companion.BUILDING_BLOCK_DOCUMENT_ID_VARIABLE
import com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX
import com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX
import com.ritense.valtimo.event.OperatonExecutionEvent
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valueresolver.ValueResolverService
import java.util.UUID
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

@Component
@SkipComponentScan
class BuildingBlockCallActivityListener(
    private val processLinkService: ProcessLinkService,
    private val buildingBlockInstanceService: BuildingBlockInstanceService,
    private val valueResolverService: ValueResolverService,
    private val objectMapper: ObjectMapper,
    private val operatonRepositoryService: OperatonRepositoryService,
) {

    @EventListener(
        condition = """#event.delegateExecution.bpmnModelElementInstance != null
            && #event.delegateExecution.bpmnModelElementInstance.elementType.typeName == T(org.operaton.bpm.engine.ActivityTypes).CALL_ACTIVITY
            && #event.eventName == T(org.operaton.bpm.engine.delegate.ExecutionListener).EVENTNAME_START"""
    )
    fun onCallActivityStart(event: OperatonExecutionEvent) {
        val execution = event.delegateExecution
        val activityId = execution.currentActivityId ?: return
        val links = processLinkService.getProcessLinks(execution.processDefinitionId, activityId)
            .filterIsInstance<BuildingBlockProcessLink>()

        val buildingBlockProcessLink = links.getOrNull(0)

        buildingBlockProcessLink?.let {
            val parentBuildingBlockInstance = findParentBuildingBlockInstance(execution)
            val isIndependentProcess = parentBuildingBlockInstance == null && isIndependentProcess(execution)

            val rootCaseDocumentId: UUID? = when {
                parentBuildingBlockInstance != null -> parentBuildingBlockInstance.caseDocumentId
                !isIndependentProcess && execution.businessKey != null -> UUID.fromString(execution.businessKey)
                else -> null
            }

            val buildingBlockInstance = this.createBuildingBlock(
                execution = execution,
                buildingBlockProcessLink = it,
                rootCaseDocumentId = rootCaseDocumentId,
                activityId = activityId,
                parentBuildingBlockInstanceId = parentBuildingBlockInstance?.id
            )
            // Used by BPMN #{buildingBlockDocumentId} expression and onCallActivityEnd for output mappings
            execution.setVariableLocal(BUILDING_BLOCK_DOCUMENT_ID_VARIABLE, buildingBlockInstance.documentId.toString())
        }
    }

    /**
     * Independent process = version tag doesn't start with "CD:" (case) or "BB:" (building block).
     */
    private fun isIndependentProcess(execution: DelegateExecution): Boolean {
        val processDefinition = operatonRepositoryService.findProcessDefinitionById(execution.processDefinitionId)
        val versionTag = processDefinition?.versionTag ?: return true

        return !versionTag.startsWith(OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX) &&
            !versionTag.startsWith(OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX)
    }

    /**
     * Finds the parent building block instance if the current process is a building block.
     * Returns null if this is a top-level building block (called from a case process).
     *
     * Uses the current process's business key to determine if we're inside a building block.
     * If the business key matches a building block document ID, the current process is a BB
     * and that BB instance becomes the parent of the new nested BB being created.
     */
    private fun findParentBuildingBlockInstance(execution: DelegateExecution): BuildingBlockInstance? {
        // The current process's business key is set to the document ID
        // For case processes: business key = case document ID
        // For building block processes: business key = building block document ID
        val businessKey = execution.processBusinessKey ?: return null

        // Check if this is a valid UUID
        val documentId = try {
            UUID.fromString(businessKey)
        } catch (_: IllegalArgumentException) {
            return null
        }

        // Try to find a building block instance with this document ID
        // If found, the current process is a building block, and this instance is the parent
        return buildingBlockInstanceService.getByDocumentId(documentId)
    }

    @EventListener(
        condition = """#event.delegateExecution.bpmnModelElementInstance != null
            && #event.delegateExecution.bpmnModelElementInstance.elementType.typeName == T(org.operaton.bpm.engine.ActivityTypes).CALL_ACTIVITY
            && #event.eventName == T(org.operaton.bpm.engine.delegate.ExecutionListener).EVENTNAME_END"""
    )
    fun onCallActivityEnd(event: OperatonExecutionEvent) {
        val execution = event.delegateExecution

        val buildingBlockVariableString = execution.getVariableLocal(BUILDING_BLOCK_DOCUMENT_ID_VARIABLE)?.let {
            it as String
        }?: return

        val buildingBlockDocumentId = try {
            UUID.fromString(buildingBlockVariableString)
        } catch(_: IllegalArgumentException) {
            throw IllegalStateException("Execution variable '$BUILDING_BLOCK_DOCUMENT_ID_VARIABLE' should be a UUID " +
                "referencing the building block document, but was '$buildingBlockVariableString'")
        }

        val buildingBlockInstance = buildingBlockInstanceService.getByDocumentId(buildingBlockDocumentId)
            ?: throw IllegalStateException("No building block instance found for documentId '$buildingBlockDocumentId'")

        val activityId = buildingBlockInstance.activityId
            ?: throw IllegalStateException("No buildingBlockInstance.activityId found for documentId '$buildingBlockDocumentId'")

        val processLinks = processLinkService.getProcessLinks(
            execution.processDefinitionId,
            activityId
        ).filterIsInstance<BuildingBlockProcessLink>()

        val processLink = processLinks.singleOrNull()
            ?: throw IllegalStateException(
                "Expected a single building block process link for processDefinitionId '${execution.processDefinitionId}' " +
                    "and activityId '$activityId', but found ${processLinks.size}"
            )

        val endSyncOutputMappings = processLink.outputMappings.filter {
            it.syncTiming == BuildingBlockSyncTiming.END
        }
        if (endSyncOutputMappings.isEmpty()) return

        val sourceMappings = endSyncOutputMappings.map { mapping ->
            mapping.getPrefixedSource() to mapping.target
        }

        val resolvedValues = valueResolverService.resolveValues(
            buildingBlockInstance.documentId.toString(),
            sourceMappings.map { it.first }
        )

        val valuesToHandle = sourceMappings.associate { (sourceKey, target) ->
            target to resolvedValues[sourceKey]
        }

        // Separate process variable targets (pv:) from other targets (doc:, case:, etc.)
        val pvTargets = valuesToHandle.filter { it.key.startsWith("pv:") }
        val otherTargets = valuesToHandle.filter { !it.key.startsWith("pv:") }

        // Handle process variable targets - write to parent process variables
        if (pvTargets.isNotEmpty()) {
            valueResolverService.handleValues(execution.processInstanceId, execution, pvTargets)
        }

        // Handle document targets - write to parent building block doc or case doc
        if (otherTargets.isNotEmpty()) {
            val parentId = buildingBlockInstance.parentBuildingBlockInstanceId
            val targetDocumentId = if (parentId != null) {
                val parentInstance = buildingBlockInstanceService.get(parentId)
                    ?: throw IllegalStateException("Parent building block instance not found: $parentId")
                parentInstance.documentId
            } else {
                buildingBlockInstance.caseDocumentId
                    ?: throw IllegalStateException("Cannot write doc: output mappings for building block without a case document")
            }
            valueResolverService.handleValues(targetDocumentId, otherTargets)
        }
    }

    private fun createBuildingBlock(
        execution: DelegateExecution,
        buildingBlockProcessLink: BuildingBlockProcessLink,
        rootCaseDocumentId: UUID?,
        activityId: String,
        parentBuildingBlockInstanceId: UUID?
    ): BuildingBlockInstance {
        val inputSources = buildingBlockProcessLink.inputMappings.map { it.source }
        val resolvedValues = valueResolverService.resolveValues(execution.processInstanceId, execution, inputSources)
        val valuesToHandle = buildingBlockProcessLink.inputMappings.associate {
            it.getPrefixedTarget() to resolvedValues[it.source]
        }
        val preProcessValues = valueResolverService.preProcessValuesForNewCase(valuesToHandle)
        val documentContent = objectMapper.valueToTree<JsonNode>(preProcessValues[DOC_PREFIX])

        val documentRequest = NewDocumentRequest(
            null,
            null,
            null,
            buildingBlockProcessLink.buildingBlockDefinitionId.key,
            buildingBlockProcessLink.buildingBlockDefinitionId.versionTag.toString(),
            documentContent,
        )

        val buildingBlockInstance =  buildingBlockInstanceService.create(
            documentRequest,
            rootCaseDocumentId,
            activityId,
            parentBuildingBlockInstanceId,
            callerProcessDefinitionId = execution.processDefinitionId
        )

        valueResolverService.handleValues(
            buildingBlockInstance.documentId,
            preProcessValues.filterKeys { !it.startsWith(DOC_PREFIX) }
        )

        return buildingBlockInstance
    }

    private companion object {
        private const val DOC_PREFIX = "doc"
    }
}
