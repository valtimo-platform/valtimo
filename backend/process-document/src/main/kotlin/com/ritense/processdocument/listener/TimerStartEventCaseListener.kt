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

package com.ritense.processdocument.listener

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentDefinitionService
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.domain.impl.request.NewDocumentForRunningProcessRequest
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processdocument.service.ProcessDocumentService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.model.bpmn.instance.Process
import org.operaton.bpm.model.bpmn.instance.StartEvent
import org.operaton.bpm.model.bpmn.instance.TimerEventDefinition
import org.springframework.context.event.EventListener

class TimerStartEventCaseListener(
    private val processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
    private val documentDefinitionService: DocumentDefinitionService,
    private val processDocumentService: ProcessDocumentService,
    private val objectMapper: ObjectMapper,
) {

    @EventListener(
        condition = "#execution.bpmnModelElementInstance != null " +
            "&& #execution.bpmnModelElementInstance.elementType.typeName == T(org.operaton.bpm.engine.ActivityTypes).START_EVENT " +
            "&& #execution.eventName == T(org.operaton.bpm.engine.delegate.ExecutionListener).EVENTNAME_START"
    )
    fun notify(execution: DelegateExecution) {
        if (!isProcessTimerStart(execution) || execution.processBusinessKey != null) {
            return
        }

        val link = processDefinitionCaseDefinitionService
            .findByProcessDefinitionIdOrNull(ProcessDefinitionId(execution.processDefinitionId))
            ?: return

        if (!link.canInitializeDocument) {
            logger.warn {
                "Process '${link.processDefinitionKey}' was started by a timer without a case: " +
                    "'canInitializeDocument' is off for case definition '${link.id.caseDefinitionId}'"
            }
            return
        }

        execution.processBusinessKey = runWithoutAuthorization { createCase(execution, link) }
    }

    private fun isProcessTimerStart(execution: DelegateExecution): Boolean {
        val startEvent = execution.bpmnModelElementInstance as? StartEvent ?: return false
        return startEvent.parentElement is Process &&
            startEvent.eventDefinitions.any { it is TimerEventDefinition }
    }

    private fun createCase(execution: DelegateExecution, link: ProcessDefinitionCaseDefinition): String {
        val caseDefinitionId = link.id.caseDefinitionId
        val documentDefinition = documentDefinitionService.findByBlueprintId(caseDefinitionId)
            .orElseThrow { IllegalStateException("No document definition found for case definition '$caseDefinitionId'") }

        val request = NewDocumentForRunningProcessRequest(
            link.processDefinitionKey,
            execution.processInstanceId,
            NewDocumentRequest(
                documentDefinition.id().name(),
                caseDefinitionId.key,
                caseDefinitionId.versionTag.version,
                objectMapper.createObjectNode()
            )
        )

        val result = processDocumentService.newDocumentForRunningProcess(request)
        return result.resultingDocument()
            .orElseThrow {
                IllegalStateException(
                    "Unable to create case of definition '$caseDefinitionId' for process '${link.processDefinitionKey}' " +
                        "started by a timer: ${result.errors().joinToString { it.asString() }}"
                )
            }
            .id()
            .toString()
    }

    private companion object {
        val logger = KotlinLogging.logger {}
    }
}
