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
import com.ritense.valueresolver.ValueResolverService
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import java.util.UUID

@Component
@SkipComponentScan
class BuildingBlockCallActivityListener(
    private val processLinkService: ProcessLinkService,
    private val buidingBlockInstanceService: BuildingBlockInstanceService,
    private val valueResolverService: ValueResolverService,
    private val objectMapper: ObjectMapper,
) {

    @EventListener(
        condition = """#execution.bpmnModelElementInstance != null
            && #execution.bpmnModelElementInstance.elementType.typeName == T(org.operaton.bpm.engine.ActivityTypes).CALL_ACTIVITY
            && #execution.eventName == T(org.operaton.bpm.engine.delegate.ExecutionListener).EVENTNAME_START"""
    )
    fun onCallActivityStart(execution: DelegateExecution) {
        val activityId = execution.currentActivityId ?: return
        val links = processLinkService.getProcessLinks(execution.processDefinitionId, activityId)
            .filterIsInstance<BuildingBlockProcessLink>()

        val buildingBlockProcessLink = links.getOrNull(0)

        buildingBlockProcessLink?.let {
            // Check if we're inside a parent building block (nested building block scenario)
            val parentBuildingBlockInstance = findParentBuildingBlockInstance(execution)

            // Determine if this is an independent process (no case, no parent building block)
            val isIndependentProcess = parentBuildingBlockInstance == null && execution.businessKey == null

            // For nested building blocks, use the root case document ID from the parent chain
            // For top-level building blocks under a case, use the execution's business key (which is the case document ID)
            // For independent processes, caseDocumentId is null
            val rootCaseDocumentId: UUID? = when {
                parentBuildingBlockInstance != null -> parentBuildingBlockInstance.caseDocumentId
                execution.businessKey != null -> UUID.fromString(execution.businessKey)
                else -> null // Independent process
            }

            // The source document for input mappings: parent building block document or case document
            // For independent processes, this is null (inputs come from process variables)
            val sourceDocumentId: UUID? = when {
                parentBuildingBlockInstance != null -> parentBuildingBlockInstance.documentId
                execution.businessKey != null -> UUID.fromString(execution.businessKey)
                else -> null // Independent process
            }

            val buildingBlockInstance = this.createBuildingBlock(
                execution = execution,
                buildingBlockProcessLink = it,
                rootCaseDocumentId = rootCaseDocumentId,
                sourceDocumentId = sourceDocumentId,
                activityId = activityId,
                parentBuildingBlockInstanceId = parentBuildingBlockInstance?.id
            )
            // Set as local variable on the call activity execution for two purposes:
            // 1. The BPMN expression #{buildingBlockDocumentId} reads this to set the child process's business key
            // 2. onCallActivityEnd reads this to perform output mappings when the building block completes
            execution.setVariableLocal(BUILDING_BLOCK_DOCUMENT_ID_VARIABLE, buildingBlockInstance.documentId.toString())
        }
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
        return buidingBlockInstanceService.getByDocumentId(documentId)
    }

    @EventListener(
        condition = """#execution.bpmnModelElementInstance != null
            && #execution.bpmnModelElementInstance.elementType.typeName == T(org.operaton.bpm.engine.ActivityTypes).CALL_ACTIVITY
            && #execution.eventName == T(org.operaton.bpm.engine.delegate.ExecutionListener).EVENTNAME_END"""
    )
    fun onCallActivityEnd(execution: DelegateExecution) {

        val buildingBlockVariableString = execution.getVariableLocal(BUILDING_BLOCK_DOCUMENT_ID_VARIABLE)?.let {
            it as String
        }?: return

        val buildingBlockDocumentId = try {
            UUID.fromString(buildingBlockVariableString)
        } catch(_: IllegalArgumentException) {
            throw IllegalStateException("Execution variable '$BUILDING_BLOCK_DOCUMENT_ID_VARIABLE' should be a UUID " +
                "referencing the building block document, but was '$buildingBlockVariableString'")
        }

        val buildingBlockInstance = buidingBlockInstanceService.getByDocumentId(buildingBlockDocumentId)
            ?: throw IllegalStateException("No building block instance found for documentId '$buildingBlockDocumentId'")

        val processLinks = processLinkService.getProcessLinks(
            execution.processDefinitionId,
            buildingBlockInstance.activityId
        ).filterIsInstance<BuildingBlockProcessLink>()

        val processLink = processLinks.singleOrNull()
            ?: throw IllegalStateException(
                "Expected a single building block process link for processDefinitionId '${execution.processDefinitionId}' " +
                    "and activityId '${buildingBlockInstance.activityId}', but found ${processLinks.size}"
            )

        val endSyncOutputMappings = processLink.outputMappings.filter {
            it.syncTiming == BuildingBlockSyncTiming.END
        }
        if (endSyncOutputMappings.isEmpty()) return

        // Resolve values from building block document
        // Source format: doc:/path or just /path (defaults to doc:)
        val sourceMappings = endSyncOutputMappings.map { mapping ->
            val sourceKey = if (mapping.source.startsWith("doc:")) {
                mapping.source
            } else {
                "doc:/${mapping.source}"
            }
            sourceKey to mapping.target
        }

        val resolvedValues = valueResolverService.resolveValues(
            buildingBlockInstance.documentId.toString(),
            sourceMappings.map { it.first }
        )

        val valuesToHandle = sourceMappings.associate { (sourceKey, target) ->
            target to resolvedValues[sourceKey]
        }

        // Separate process variable targets (pv:) from document targets (doc:, case:, etc.)
        val pvTargets = valuesToHandle.filter { it.key.startsWith("pv:") }
        val docTargets = valuesToHandle.filter { !it.key.startsWith("pv:") }

        // Handle process variable targets - write to parent process variables
        if (pvTargets.isNotEmpty()) {
            valueResolverService.handleValues(execution.processInstanceId, execution, pvTargets)
        }

        // Handle document targets - write to parent building block doc or case doc
        if (docTargets.isNotEmpty()) {
            val targetDocumentId = if (buildingBlockInstance.parentBuildingBlockInstanceId != null) {
                val parentInstance = buidingBlockInstanceService.get(buildingBlockInstance.parentBuildingBlockInstanceId)
                    ?: throw IllegalStateException("Parent building block instance not found: ${buildingBlockInstance.parentBuildingBlockInstanceId}")
                parentInstance.documentId
            } else {
                buildingBlockInstance.caseDocumentId
                    ?: throw IllegalStateException("Cannot write doc: output mappings for building block without a case document")
            }
            valueResolverService.handleValues(targetDocumentId, docTargets)
        }
    }

    private fun createBuildingBlock(
        execution: DelegateExecution,
        buildingBlockProcessLink: BuildingBlockProcessLink,
        rootCaseDocumentId: UUID?,
        sourceDocumentId: UUID?,
        activityId: String,
        parentBuildingBlockInstanceId: UUID?
    ): BuildingBlockInstance {
        val documentRequest = NewDocumentRequest(
            null,
            null,
            null,
            buildingBlockProcessLink.buildingBlockDefinitionId.key,
            buildingBlockProcessLink.buildingBlockDefinitionId.versionTag.toString(),
            buildDocumentContent(execution, buildingBlockProcessLink, sourceDocumentId),
        )

        return buidingBlockInstanceService.create(
            documentRequest,
            rootCaseDocumentId,
            activityId,
            parentBuildingBlockInstanceId
        )
    }

    private fun buildDocumentContent(
        execution: DelegateExecution,
        buildingBlockProcessLink: BuildingBlockProcessLink,
        sourceDocumentId: UUID?
    ): JsonNode {
        val inputSources = buildingBlockProcessLink.inputMappings.map { it.source }

        // Separate pv: sources from doc: sources
        val pvSources = inputSources.filter { it.startsWith("pv:") }
        val docSources = inputSources.filter { !it.startsWith("pv:") }

        // Resolve process variable sources using execution context
        val pvResolvedValues = if (pvSources.isNotEmpty()) {
            valueResolverService.resolveValues(execution.processInstanceId, execution, pvSources)
        } else {
            emptyMap()
        }

        // Resolve document sources using document ID (if available)
        val docResolvedValues = if (docSources.isNotEmpty() && sourceDocumentId != null) {
            valueResolverService.resolveValues(sourceDocumentId.toString(), docSources)
        } else if (docSources.isNotEmpty()) {
            throw IllegalStateException("Cannot resolve doc: input mappings without a source document (case or parent building block)")
        } else {
            emptyMap()
        }

        // Combine resolved values
        val resolvedValues = pvResolvedValues + docResolvedValues

        val documentToCreate = buildingBlockProcessLink.inputMappings.associate {
            it.target to resolvedValues[it.source]
        }

        return objectMapper.valueToTree(documentToCreate)
    }
}
