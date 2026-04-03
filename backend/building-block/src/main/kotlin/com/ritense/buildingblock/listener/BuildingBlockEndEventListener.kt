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

package com.ritense.buildingblock.listener

import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.processlink.domain.BuildingBlockSyncTiming
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.buildingblock.service.CaseDefinitionBuildingBlockLinkService
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.event.OperatonExecutionEvent
import com.ritense.valueresolver.ValueResolverService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

@Component
@SkipComponentScan
class BuildingBlockEndEventListener(
    private val buildingBlockInstanceService: BuildingBlockInstanceService,
    private val caseDefinitionBuildingBlockLinkService: CaseDefinitionBuildingBlockLinkService,
    private val processDocumentService: ProcessDocumentService,
    private val documentService: DocumentService,
    private val valueResolverService: ValueResolverService,
) {

    @EventListener(
        condition = """#event.delegateExecution.bpmnModelElementInstance != null
            && #event.delegateExecution.bpmnModelElementInstance.elementType.typeName == T(org.operaton.bpm.engine.ActivityTypes).END_EVENT_NONE
            && #event.eventName == T(org.operaton.bpm.engine.delegate.ExecutionListener).EVENTNAME_END"""
    )
    fun onEndEvent(event: OperatonExecutionEvent) {
        val execution = event.delegateExecution
        val processInstanceId = OperatonProcessInstanceId(execution.processInstanceId)
        val documentId = processDocumentService.getDocumentId(processInstanceId, execution)
            ?: return
        val buildingBlockInstance = buildingBlockInstanceService.getByDocumentId(documentId.id)
            ?: return
        val caseDocumentId = buildingBlockInstance.caseDocumentId
            ?: return

        val caseDocument = documentService.get(caseDocumentId.toString())
        val caseDefinitionId = caseDocument.definitionId().caseDefinitionId()
        val buildingBlockDefinitionId = buildingBlockInstance.definition.id
        val link = caseDefinitionBuildingBlockLinkService.findLink(caseDefinitionId, buildingBlockDefinitionId)
            ?: return

        logger.debug { "Syncing results for ad-hoc building block '${buildingBlockInstance.definition.id}' to case '$caseDefinitionId'" }
        saveResultsOfAdHocBuildingBlock(execution, buildingBlockInstance, link)
    }

    fun saveResultsOfAdHocBuildingBlock(
        execution: DelegateExecution,
        buildingBlockInstance: BuildingBlockInstance,
        link: CaseDefinitionBuildingBlockLink
    ) {
        val endSyncMappings = link.outputMappings.filter {
            it.syncTiming == BuildingBlockSyncTiming.END
        }
        if (endSyncMappings.isEmpty()) {
            return
        }

        val caseDocumentId = buildingBlockInstance.caseDocumentId
            ?: throw IllegalStateException("Cannot sync results for building block without a case document")

        val resolvedValues = valueResolverService.resolveValues(
            execution.processInstanceId,
            execution,
            endSyncMappings.map { it.source }
        )

        val valuesToHandle = endSyncMappings.associate { (sourceKey, target) ->
            target to resolvedValues[sourceKey]
        }

        valueResolverService.handleValues(caseDocumentId, valuesToHandle)
    }

    private companion object {
        private val logger = KotlinLogging.logger {}
    }
}
