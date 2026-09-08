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
import com.ritense.assistant.service.ActionExecutor
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.springframework.mock.web.MockMultipartFile

class ProcessDefinitionActionExecutor(
    private val processDeploymentService: ProcessDeploymentService,
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
            if (caseDefinitionKey != null) {
                val caseDefId = CaseDefinitionId(caseDefinitionKey, "1.0.0")
                processDeploymentService.deployProcessDefinitionAndProcessLinksForCaseDefinition(
                    caseDefinitionId = caseDefId,
                    bpmn = bpmnFile,
                    processLinks = emptyList(),
                    processDefinitionId = null,
                    canInitializeDocument = false,
                    startableByUser = false
                )
            } else {
                @Suppress("UNUSED_VARIABLE")
                val ignored = processDeploymentService.deployProcessDefinitionAndProcessLinks(
                    blueprintId = null,
                    bpmn = bpmnFile,
                    processLinks = emptyList(),
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
}
