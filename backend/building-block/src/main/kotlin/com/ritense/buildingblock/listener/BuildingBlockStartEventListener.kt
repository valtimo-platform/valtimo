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

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.buildingblock.service.CaseDefinitionBuildingBlockLinkService
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.event.OperatonExecutionEvent
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valueresolver.ValueResolverService
import io.github.oshai.kotlinlogging.KotlinLogging
import java.util.UUID
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.model.bpmn.impl.instance.ProcessImpl
import org.springframework.context.event.EventListener
import org.springframework.core.annotation.Order
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component

@Component
@SkipComponentScan
class BuildingBlockStartEventListener(
    private val buildingBlockInstanceService: BuildingBlockInstanceService,
    private val processDocumentService: ProcessDocumentService,
    private val operatonRepositoryService: OperatonRepositoryService,
    private val caseDocumentResolver: CaseDocumentResolver,
    private val objectMapper: ObjectMapper,
    private val caseDefinitionBuildingBlockLinkService: CaseDefinitionBuildingBlockLinkService,
    private val documentService: DocumentService,
    private val valueResolverService: ValueResolverService,
    private val processDocumentAssociationService: ProcessDocumentAssociationService,
    private val jdbcTemplate: JdbcTemplate,
) {

    /** Creates an ad-hoc BuildingBlockInstance for the given process instance. */
    @Order(100)
    @EventListener(
        condition = """#event.delegateExecution.bpmnModelElementInstance != null
            && #event.delegateExecution.bpmnModelElementInstance.elementType.typeName == T(org.operaton.bpm.engine.ActivityTypes).START_EVENT
            && #event.eventName == T(org.operaton.bpm.engine.delegate.ExecutionListener).EVENTNAME_START"""
    )
    fun onStartEvent(event: OperatonExecutionEvent) {
        val execution = event.delegateExecution

        val processDefinition = operatonRepositoryService.findProcessDefinitionById(execution.processDefinitionId)
            ?: return
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.fromProcessVersionTag(processDefinition.versionTag)
            ?: return
        val processInstanceId = OperatonProcessInstanceId(execution.processInstanceId)
        val documentId = processDocumentService.getDocumentId(processInstanceId, execution)
            ?: return
        val existingInstance = buildingBlockInstanceService.getByDocumentId(documentId.id)
        if (existingInstance != null) {
            if (existingInstance.processInstanceId == null) {
                existingInstance.processInstanceId = execution.processInstanceId
                buildingBlockInstanceService.save(existingInstance)
            }
            return
        }

        val caseDocumentId = try {
            caseDocumentResolver.resolveCaseDocumentId(documentId.id)
        } catch (_: Exception) {
            null
        } ?: return

        val caseDocument = documentService.get(caseDocumentId.toString())
        val caseDefinitionId = caseDocument.definitionId().caseDefinitionId()
        val link = caseDefinitionBuildingBlockLinkService.findLink(caseDefinitionId, buildingBlockDefinitionId)
            ?: return
        if (associationExists(execution.processInstanceId)) {
            return
        }
        createAdHocBuildingBlockInstance(buildingBlockDefinitionId, link, caseDocumentId, execution)
    }

    private fun createAdHocBuildingBlockInstance(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        link: CaseDefinitionBuildingBlockLink,
        caseDocumentId: UUID,
        execution: DelegateExecution
    ) {
        logger.debug { "Creating ad-hoc BuildingBlockInstance for '${buildingBlockDefinitionId.key}'" }
        val inputSources = link.inputMappings.map { it.source }
        val resolvedValues = valueResolverService.resolveValues(caseDocumentId.toString(), inputSources)
        val valuesToHandle = link.inputMappings.associate { it.target to resolvedValues[it.source] }
        val preProcessValues = valueResolverService.preProcessValuesForNewCase(valuesToHandle)
        val documentContent = objectMapper.valueToTree<JsonNode>(preProcessValues[DOC_PREFIX])

        val documentRequest = NewDocumentRequest(
            null,
            null,
            null,
            buildingBlockDefinitionId.key,
            buildingBlockDefinitionId.versionTag.toString(),
            documentContent,
        )

        val buildingBlockInstance = buildingBlockInstanceService.create(
            newDocumentRequest = documentRequest,
            caseDocumentId = caseDocumentId,
            processInstanceId = execution.processInstanceId,
        )
        updateProcessDocumentInstance(execution, buildingBlockInstance.documentId)
        valueResolverService.handleValues(
            execution.processInstanceId,
            execution,
            valuesToHandle.filterKeys { !it.startsWith(DOC_PREFIX) }
        )
    }

    private fun updateProcessDocumentInstance(execution: DelegateExecution, newDocumentId: UUID) {
        processDocumentAssociationService.createProcessDocumentInstance(
            execution.processInstanceId,
            newDocumentId,
            getProcessNameFrom(execution),
        )
        execution.processBusinessKey = newDocumentId.toString()

        // Flush:
        jdbcTemplate.update(
            "UPDATE ACT_RU_EXECUTION SET BUSINESS_KEY_ = ? WHERE ID_ = ?",
            newDocumentId.toString(), execution.processInstanceId
        )
    }


    private fun associationExists(processInstanceId: String?): Boolean {
        return processDocumentAssociationService.findProcessDocumentInstance(OperatonProcessInstanceId(processInstanceId))
            .isPresent
    }

    private fun getProcessNameFrom(execution: DelegateExecution): String? {
        return execution
            .bpmnModelInstance
            .definitions
            .rootElements
            .stream()
            .filter { rootElement -> rootElement is ProcessImpl && rootElement.isExecutable }
            .findFirst()
            .orElseThrow()
            .getAttributeValue("name")
    }


    private companion object {
        private val logger = KotlinLogging.logger {}
        private const val DOC_PREFIX = "doc"
    }
}
