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

package com.ritense.assistant.executor

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.module.kotlin.treeToValue
import com.ritense.assistant.service.ActionExecutor
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byKey
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byLatestVersion
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.operaton.bpm.model.bpmn.Bpmn
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.springframework.data.domain.Sort
import org.springframework.mock.web.MockMultipartFile
import java.io.ByteArrayInputStream

class ProcessDefinitionActionExecutor(
    private val processDeploymentService: ProcessDeploymentService,
    private val operatonRepositoryService: OperatonRepositoryService,
    private val processLinkService: ProcessLinkService,
    private val processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
    private val objectMapper: ObjectMapper
) : ActionExecutor {

    override fun execute(params: String, userId: String): Any {
        val paramsMap = objectMapper.readValue(params, Map::class.java)
        val processDefinitionKey = paramsMap["processDefinitionKey"] as String
        val bpmnXml = paramsMap["bpmnXml"] as String
        val caseDefinitionKey = paramsMap["caseDefinitionKey"] as? String

        val bpmnFile = MockMultipartFile(
            "$processDefinitionKey.bpmn",
            "$processDefinitionKey.bpmn",
            "application/xml",
            bpmnXml.toByteArray()
        )

        return runWithoutAuthorization {
            val current = operatonRepositoryService.findProcessDefinition(
                byKey(processDefinitionKey).and(byLatestVersion())
            )
            val versions = operatonRepositoryService.findProcessDefinitions(
                byKey(processDefinitionKey),
                Sort.by(Sort.Direction.DESC, "version")
            )
            val caseLink = versions.asSequence()
                .mapNotNull { processDefinitionCaseDefinitionService.findByProcessDefinitionIdOrNull(ProcessDefinitionId(it.id)) }
                .firstOrNull()
            val caseDefinitionId = caseLink?.id?.caseDefinitionId
                ?: caseDefinitionKey?.let { CaseDefinitionId(it, "1.0.0") }
            val processLinks = current?.let { carryOverProcessLinks(it, bpmnXml, caseDefinitionId) } ?: emptyList()

            if (caseDefinitionId != null) {
                processDeploymentService.deployProcessDefinitionAndProcessLinksForCaseDefinition(
                    caseDefinitionId = caseDefinitionId,
                    bpmn = bpmnFile,
                    processLinks = processLinks,
                    processDefinitionId = null,
                    canInitializeDocument = caseLink?.canInitializeDocument ?: false,
                    startableByUser = caseLink?.startableByUser ?: false
                )
            } else {
                @Suppress("UNUSED_VARIABLE")
                val ignored = processDeploymentService.deployProcessDefinitionAndProcessLinks(
                    blueprintId = null,
                    bpmn = bpmnFile,
                    processLinks = processLinks,
                    processDefinitionId = null
                )
            }

            mapOf(
                "success" to true,
                "message" to "Process definition deployed successfully",
                "processDefinitionKey" to processDefinitionKey
            )
        }
    }

    private fun carryOverProcessLinks(
        current: OperatonProcessDefinition,
        bpmnXml: String,
        caseDefinitionId: CaseDefinitionId?
    ): List<ProcessLinkCreateRequestDto> {
        val newModel = Bpmn.readModelFromStream(ByteArrayInputStream(bpmnXml.toByteArray(Charsets.UTF_8)))
        return processLinkService.getProcessLinks(current.id)
            .filter { hasElement(newModel, it.activityId) }
            .map { link ->
                val mapper = processLinkService.getProcessLinkMapper(link.processLinkType)
                val node = objectMapper.valueToTree<ObjectNode>(mapper.toProcessLinkExportResponseDto(link))
                node.put("processDefinitionId", current.id)
                node.put("processLinkType", link.processLinkType)
                val deployDto = objectMapper.treeToValue<ProcessLinkDeployDto>(node)
                mapper.toProcessLinkCreateRequestDto(deployDto, caseDefinitionId)
            }
    }

    private fun hasElement(model: BpmnModelInstance, activityId: String): Boolean {
        return model.getModelElementById<org.operaton.bpm.model.xml.instance.ModelElementInstance>(activityId) != null
    }
}
