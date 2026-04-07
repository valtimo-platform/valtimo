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

package com.ritense.notificatiesapi.listener

import com.fasterxml.jackson.databind.node.JsonNodeFactory
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.plugin.repository.PluginProcessLinkRepository
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.case.service.CaseDefinitionService
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.service.ProcessPropertyService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.runtime.Execution
import org.operaton.bpm.model.bpmn.instance.CatchEvent
import org.operaton.bpm.model.bpmn.instance.MessageEventDefinition
import org.springframework.context.event.EventListener
import org.springframework.transaction.annotation.Transactional

open class NotificatiesApiNotificationProcessLinkListener(
    private val pluginProcessLinkRepository: PluginProcessLinkRepository,
    private val runtimeService: RuntimeService,
    private val repositoryService: RepositoryService,
    private val processPropertyService: ProcessPropertyService,
    private val processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
    private val processDocumentService: ProcessDocumentService,
    private val caseDefinitionService: CaseDefinitionService,
) {

    @Transactional
    @EventListener(NotificatiesApiNotificationReceivedEvent::class)
    open fun onNotificationReceived(event: NotificatiesApiNotificationReceivedEvent) {
        logger.debug { "Received notification on kanaal '${event.kanaal}', checking for matching process links" }

        val processLinks = pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(
            NOTIFICATIES_API_PLUGIN_DEFINITION_KEY,
            RECEIVE_NOTIFICATIE_ACTION_KEY
        )
        if (processLinks.isEmpty()) {
            return
        }

        val variables = toProcessVariables(event)
        processLinks.forEach { processLink ->
            if (matchesFilter(event, processLink)) {
                when (processLink.activityType) {
                    ActivityTypeWithEventName.MESSAGE_START_EVENT_START -> startProcessByMessage(processLink, variables)
                    else -> signalWaitingExecutions(processLink, variables)
                }
            }
        }
    }

    private fun matchesFilter(
        event: NotificatiesApiNotificationReceivedEvent,
        processLink: PluginProcessLink
    ): Boolean {
        val properties = processLink.actionProperties ?: return true

        val kanaalFilter = properties.get("kanaal")?.takeIf { !it.isNull }?.asText()
        val actieFilter = properties.get("actie")?.takeIf { !it.isNull }?.asText()
        val kenmerkenFilter = properties.get("kenmerken")?.takeIf { !it.isNull && it.isObject }

        if (!kanaalFilter.isNullOrBlank() && !event.kanaal.equals(kanaalFilter, ignoreCase = true)) {
            return false
        }
        if (!actieFilter.isNullOrBlank() && !event.actie.equals(actieFilter, ignoreCase = true)) {
            return false
        }
        kenmerkenFilter?.fields()?.forEach { (key, value) ->
            val eventValue = event.kenmerken[key]
            if (eventValue == null || !eventValue.equals(value.asText(), ignoreCase = true)) {
                return false
            }
        }

        return true
    }

    private fun signalWaitingExecutions(processLink: PluginProcessLink, variables: Map<String, Any>) {
        val executions = runtimeService.createExecutionQuery()
            .processDefinitionId(processLink.processDefinitionId)
            .activityId(processLink.activityId)
            .list()

        if (executions.isEmpty()) {
            logger.debug { "No waiting executions found for process definition '${processLink.processDefinitionId}' at activity '${processLink.activityId}'" }
            return
        }

        executions.forEach { execution ->
            logger.info { "Signaling execution '${execution.id}' in process instance '${execution.processInstanceId}' at activity '${processLink.activityId}'" }
            continueExecution(execution, processLink, variables)
        }
    }

    private fun continueExecution(execution: Execution, processLink: PluginProcessLink, variables: Map<String, Any>) {
        when (processLink.activityType) {
            ActivityTypeWithEventName.RECEIVE_TASK_END ->
                runtimeService.signal(execution.id, variables)

            ActivityTypeWithEventName.INTERMEDIATE_CATCH_EVENT_END -> {
                val messageName = getMessageName(processLink)
                runtimeService.messageEventReceived(messageName, execution.id, variables)
            }

            else -> error("Unsupported activity type '${processLink.activityType}' for receive-notificatie process link")
        }
    }

    private fun startProcessByMessage(processLink: PluginProcessLink, variables: Map<String, Any>) {
        if (processPropertyService.isSystemProcessById(processLink.processDefinitionId)) {
            startSystemProcessByMessage(processLink, variables)
        } else {
            startDocumentProcessByMessage(processLink, variables)
        }
    }

    private fun startSystemProcessByMessage(processLink: PluginProcessLink, variables: Map<String, Any>) {
        val messageName = getMessageName(processLink)
        logger.info { "Starting system process instance by message '$messageName' for process definition '${processLink.processDefinitionId}'" }
        runtimeService.createMessageCorrelation(messageName)
            .processDefinitionId(processLink.processDefinitionId)
            .setVariables(variables)
            .correlateStartMessage()
    }

    private fun startDocumentProcessByMessage(processLink: PluginProcessLink, variables: Map<String, Any>) {
        val processDefinitionCaseDefinition = processDefinitionCaseDefinitionService
            .findByProcessDefinitionIdOrNull(ProcessDefinitionId(processLink.processDefinitionId))
        if (processDefinitionCaseDefinition == null) {
            return
        }

        val caseDefinitionKey = processDefinitionCaseDefinition.id.caseDefinitionId.key
        val activeCaseDefinition = runWithoutAuthorization {
            caseDefinitionService.getActiveCaseDefinition(caseDefinitionKey)
        }
        if (activeCaseDefinition?.id != processDefinitionCaseDefinition.id.caseDefinitionId) {
            return
        }

        require(processDefinitionCaseDefinition.canInitializeDocument) {
            "Cannot start process for process definition '${processLink.processDefinitionId}' " +
                "because canInitializeDocument is false on the linked case definition."
        }

        val processDefinitionKey = processDefinitionCaseDefinition.processDefinitionKey
            ?: error("Process definition key not found for '${processLink.processDefinitionId}'")

        val request = NewDocumentAndStartProcessRequest(
            processDefinitionKey,
            NewDocumentRequest(
                activeCaseDefinition.id.key,
                activeCaseDefinition.id.key,
                activeCaseDefinition.id.versionTag.toString(),
                JsonNodeFactory.instance.objectNode()
            )
        ).withProcessVars(variables)

        logger.info { "Starting document process for case '${activeCaseDefinition.id.key}' (${activeCaseDefinition.id.versionTag}) with process definition key '$processDefinitionKey'" }
        val result = runWithoutAuthorization { processDocumentService.newDocumentAndStartProcess(request) }
        if (result.errors().isNotEmpty()) {
            error("Failed to start document process: ${result.errors()}")
        }
    }

    private fun toProcessVariables(event: NotificatiesApiNotificationReceivedEvent): Map<String, Any> {
        val variables = mutableMapOf(
            "notificatieKanaal" to event.kanaal,
            "notificatieResourceUrl" to event.resourceUrl,
            "notificatieActie" to event.actie,
            "notificatieKenmerken" to event.kenmerken,
        )

        event.hoofdObject?.let { variables["notificatieHoofdObject"] = it }
        event.aanmaakdatum?.toString()?.let { variables["notificatieAanmaakdatum"] = it }

        return variables
    }

    private fun getMessageName(processLink: PluginProcessLink): String {
        val model = repositoryService.getBpmnModelInstance(processLink.processDefinitionId)
        val element = model.getModelElementById<CatchEvent>(processLink.activityId)
        val messageEventDefinition = element.eventDefinitions
            .filterIsInstance<MessageEventDefinition>()
            .firstOrNull()
            ?: throw IllegalStateException(
                "No message event definition found on element '${processLink.activityId}' " +
                    "in process definition '${processLink.processDefinitionId}'"
            )
        return messageEventDefinition.message.name
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        const val NOTIFICATIES_API_PLUGIN_DEFINITION_KEY = "notificatiesapi"
        const val RECEIVE_NOTIFICATIE_ACTION_KEY = "receive-notificatie"
    }
}
