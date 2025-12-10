/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
            val buildingBlockInstance = this.createBuildingBlock(
                it,
                UUID.fromString(execution.businessKey),
                activityId
            )
            execution.setVariableLocal(BUILDING_BLOCK_INSTANCE_ID_VARIABLE, buildingBlockInstance.documentId.toString())
        }
    }

    @EventListener(
        condition = """#execution.bpmnModelElementInstance != null
            && #execution.bpmnModelElementInstance.elementType.typeName == T(org.operaton.bpm.engine.ActivityTypes).CALL_ACTIVITY
            && #execution.eventName == T(org.operaton.bpm.engine.delegate.ExecutionListener).EVENTNAME_END"""
    )
    fun onCallActivityEnd(execution: DelegateExecution) {
        val buildingBlockVariableString = execution.getVariableLocal(BUILDING_BLOCK_INSTANCE_ID_VARIABLE) as String

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

        val resolvedValues = valueResolverService.resolveValues(
            buildingBlockInstance.documentId.toString(),
            endSyncOutputMappings.map { "doc:/${it.source}" }
        )

        val valuesToHandle = endSyncOutputMappings.associate { mapping ->
            mapping.target to resolvedValues["doc:/${mapping.source}"]
        }

        valueResolverService.handleValues(buildingBlockInstance.caseDocumentId, valuesToHandle)
    }

    private fun createBuildingBlock(
        buildingBlockProcessLink: BuildingBlockProcessLink,
        caseDocumentId: UUID,
        activityId: String
    ): BuildingBlockInstance {
        val documentRequest = NewDocumentRequest(
            null,
            null,
            null,
            buildingBlockProcessLink.buildingBlockDefinitionId.key,
            buildingBlockProcessLink.buildingBlockDefinitionId.versionTag.toString(),
            buildDocumentContent(buildingBlockProcessLink, caseDocumentId),
        )

        return buidingBlockInstanceService.create(
            documentRequest,
            caseDocumentId,
            activityId
        )
    }

    private fun buildDocumentContent(
        buildingBlockProcessLink: BuildingBlockProcessLink,
        caseDocumentId: UUID
    ): JsonNode {
        val resolvedValues = valueResolverService.resolveValues(
            caseDocumentId.toString(),
            buildingBlockProcessLink.inputMappings.map {
                it.source
            }
        )

        val documentToCreate = buildingBlockProcessLink.inputMappings.associate {
            it.target to resolvedValues[it.source]
        }

        return objectMapper.valueToTree(documentToCreate)
    }

    companion object {
        const val BUILDING_BLOCK_INSTANCE_ID_VARIABLE = "buildingBlockInstanceId"
    }
}
