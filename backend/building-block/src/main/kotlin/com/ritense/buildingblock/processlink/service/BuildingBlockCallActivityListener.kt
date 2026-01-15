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
import com.ritense.valtimo.contract.buildingblock.BuildingBlockConstants.Companion.BUILDING_BLOCK_INSTANCE_ID_VARIABLE
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

            // For nested building blocks, use the root case document ID from the parent chain
            // For top-level building blocks, use the execution's business key (which is the case document ID)
            val rootCaseDocumentId = parentBuildingBlockInstance?.caseDocumentId
                ?: UUID.fromString(execution.businessKey)

            // The source document for input mappings: parent building block document or case document
            val sourceDocumentId = parentBuildingBlockInstance?.documentId
                ?: UUID.fromString(execution.businessKey)

            val buildingBlockInstance = this.createBuildingBlock(
                buildingBlockProcessLink = it,
                rootCaseDocumentId = rootCaseDocumentId,
                sourceDocumentId = sourceDocumentId,
                activityId = activityId,
                parentBuildingBlockInstanceId = parentBuildingBlockInstance?.id
            )
            // Set as local variable on the call activity execution - this is read by StartEventFromCallActivityListenerImpl
            // to automatically propagate to the child process
            execution.setVariableLocal(BUILDING_BLOCK_INSTANCE_ID_VARIABLE, buildingBlockInstance.documentId.toString())
        }
    }

    /**
     * Find the parent building block instance by walking up the execution hierarchy.
     * Returns null if this is a top-level building block (called from a case process).
     *
     * The key insight is that for a call activity within a process, execution.superExecution
     * might be null (if the call activity is at the top level of the process).
     * We need to navigate via the process instance's superExecution, which correctly points
     * to the call activity that started the current process.
     */
    private fun findParentBuildingBlockInstance(execution: DelegateExecution): BuildingBlockInstance? {
        // Get the process instance (root execution) of the current process
        val processInstance = execution.processInstance ?: return null

        // Navigate to the parent process's call activity that started this process
        var current: DelegateExecution? = processInstance.superExecution

        while (current != null) {
            val buildingBlockDocumentIdString = current.getVariableLocal(BUILDING_BLOCK_INSTANCE_ID_VARIABLE) as? String
            if (buildingBlockDocumentIdString != null) {
                val buildingBlockDocumentId = UUID.fromString(buildingBlockDocumentIdString)
                return buidingBlockInstanceService.getByDocumentId(buildingBlockDocumentId)
            }
            // Navigate up to the parent process's super execution
            val parentProcessInstance = current.processInstance
            current = parentProcessInstance?.superExecution
        }

        return null
    }

    @EventListener(
        condition = """#execution.bpmnModelElementInstance != null
            && #execution.bpmnModelElementInstance.elementType.typeName == T(org.operaton.bpm.engine.ActivityTypes).CALL_ACTIVITY
            && #execution.eventName == T(org.operaton.bpm.engine.delegate.ExecutionListener).EVENTNAME_END"""
    )
    fun onCallActivityEnd(execution: DelegateExecution) {

        val buildingBlockVariableString = execution.getVariableLocal(BUILDING_BLOCK_INSTANCE_ID_VARIABLE)?.let {
            it as String
        }?: return

        val buildingBlockDocumentId = try {
            UUID.fromString(buildingBlockVariableString)
        } catch(_: IllegalArgumentException) {
            throw IllegalStateException("Execution variable '$BUILDING_BLOCK_INSTANCE_ID_VARIABLE' should be a UUID " +
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

        // Resolve values from building block document or process variables
        // Source can be:
        // - pv:variableName - reads from execution variables (set by called process via camunda:out variables="all")
        // - doc:/path - reads from building block document
        // - path (no prefix) - defaults to doc:/path for backward compatibility
        val valuesToHandle = mutableMapOf<String, Any?>()
        val docSourcesToResolve = mutableListOf<Pair<String, String>>() // Pair of (sourceKey, target)

        for (mapping in endSyncOutputMappings) {
            when {
                mapping.source.startsWith("pv:") -> {
                    // Read from execution variables (variables copied from called process)
                    val variableName = mapping.source.removePrefix("pv:")
                    val value = execution.getVariable(variableName)
                    valuesToHandle[mapping.target] = value
                }
                mapping.source.startsWith("doc:") -> {
                    docSourcesToResolve.add(mapping.source to mapping.target)
                }
                else -> {
                    // Default to doc:/ for backward compatibility
                    docSourcesToResolve.add("doc:/${mapping.source}" to mapping.target)
                }
            }
        }

        // Resolve doc: sources from building block document
        if (docSourcesToResolve.isNotEmpty()) {
            val docSourceKeys = docSourcesToResolve.map { it.first }
            val resolvedValues = valueResolverService.resolveValues(
                buildingBlockInstance.documentId.toString(),
                docSourceKeys
            )
            for ((sourceKey, target) in docSourcesToResolve) {
                valuesToHandle[target] = resolvedValues[sourceKey]
            }
        }

        // Determine target document: parent building block doc if nested, otherwise case doc
        val targetDocumentId = if (buildingBlockInstance.parentBuildingBlockInstanceId != null) {
            val parentInstance = buidingBlockInstanceService.get(buildingBlockInstance.parentBuildingBlockInstanceId)
                ?: throw IllegalStateException("Parent building block instance not found: ${buildingBlockInstance.parentBuildingBlockInstanceId}")
            parentInstance.documentId
        } else {
            buildingBlockInstance.caseDocumentId
        }

        valueResolverService.handleValues(targetDocumentId, valuesToHandle)
    }

    private fun  createBuildingBlock(
        buildingBlockProcessLink: BuildingBlockProcessLink,
        rootCaseDocumentId: UUID,
        sourceDocumentId: UUID,
        activityId: String,
        parentBuildingBlockInstanceId: UUID?
    ): BuildingBlockInstance {
        val documentRequest = NewDocumentRequest(
            null,
            null,
            null,
            buildingBlockProcessLink.buildingBlockDefinitionId.key,
            buildingBlockProcessLink.buildingBlockDefinitionId.versionTag.toString(),
            buildDocumentContent(buildingBlockProcessLink, sourceDocumentId),
        )

        return buidingBlockInstanceService.create(
            documentRequest,
            rootCaseDocumentId,
            activityId,
            parentBuildingBlockInstanceId
        )
    }

    private fun buildDocumentContent(
        buildingBlockProcessLink: BuildingBlockProcessLink,
        sourceDocumentId: UUID
    ): JsonNode {
        val resolvedValues = valueResolverService.resolveValues(
            sourceDocumentId.toString(),
            buildingBlockProcessLink.inputMappings.map {
                it.source
            }
        )

        val documentToCreate = buildingBlockProcessLink.inputMappings.associate {
            it.target to resolvedValues[it.source]
        }

        return objectMapper.valueToTree(documentToCreate)
    }
}
