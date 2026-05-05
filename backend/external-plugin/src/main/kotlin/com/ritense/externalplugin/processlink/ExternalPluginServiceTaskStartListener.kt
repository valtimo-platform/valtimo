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

package com.ritense.externalplugin.processlink

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginProcessLink
import com.ritense.externalplugin.repository.ExternalPluginProcessLinkRepository
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginDefinitionService
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.ritense.logging.withLoggingContext
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.event.OperatonExecutionEvent
import com.ritense.valueresolver.ValueResolverService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.delegate.BpmnError
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
@SkipComponentScan
class ExternalPluginServiceTaskStartListener(
    private val processLinkRepository: ExternalPluginProcessLinkRepository,
    private val configurationService: ExternalPluginConfigurationService,
    private val definitionService: ExternalPluginDefinitionService,
    private val hostService: ExternalPluginHostService,
    private val hostClient: ExternalPluginHostClient,
    private val valueResolverService: ValueResolverService,
    private val objectMapper: ObjectMapper,
) {

    @Transactional
    @EventListener(
        condition = """#event.delegateExecution.bpmnModelElementInstance != null
            && #event.delegateExecution.bpmnModelElementInstance.elementType.typeName == T(org.operaton.bpm.engine.ActivityTypes).TASK_SERVICE
            && #event.eventName == T(org.operaton.bpm.engine.delegate.ExecutionListener).EVENTNAME_START"""
    )
    fun notify(event: OperatonExecutionEvent) {
        val execution = event.delegateExecution
        withLoggingContext("com.ritense.document.domain.impl.JsonSchemaDocument", execution.processBusinessKey) {
            processLinkRepository.findByProcessDefinitionIdAndActivityIdAndActivityType(
                execution.processDefinitionId,
                execution.currentActivityId,
                ActivityTypeWithEventName.SERVICE_TASK_START,
            ).forEach { processLink -> invoke(execution, processLink) }
        }
    }

    private fun invoke(execution: DelegateExecution, processLink: ExternalPluginProcessLink) {
        val configuration = configurationService.get(processLink.externalPluginConfigurationId)
        val definition = definitionService.get(configuration.definitionId)
        val host = hostService.get(definition.hostId)

        val resolvedProperties = resolveActionProperties(execution, processLink)
        val payload = buildPayload(execution, processLink, configuration, resolvedProperties)

        val response = hostClient.invokeAction(
            baseUrl = host.baseUrl,
            pluginId = definition.pluginId,
            version = definition.version,
            actionKey = processLink.actionKey,
            payload = payload,
        )

        when {
            response.status in 200..299 -> applySuccess(execution, response.body)
            response.status in 400..499 -> throw bpmnError(response, definition, processLink)
            else -> throw IllegalStateException(
                "External plugin host returned status ${response.status} for plugin '${definition.pluginId}' action '${processLink.actionKey}'",
            )
        }
    }

    private fun resolveActionProperties(execution: DelegateExecution, processLink: ExternalPluginProcessLink): ObjectNode {
        val rawProperties = processLink.actionProperties ?: objectMapper.createObjectNode()
        val keysToResolve = mutableListOf<String>()
        rawProperties.fields().forEachRemaining { (_, value) ->
            if (value.isTextual) keysToResolve += value.asText()
        }
        val resolved = if (keysToResolve.isEmpty()) {
            emptyMap()
        } else {
            valueResolverService.resolveValues(execution.processInstanceId, execution, keysToResolve)
        }

        val output = objectMapper.createObjectNode()
        rawProperties.fields().forEachRemaining { (key, value) ->
            if (value.isTextual && resolved.containsKey(value.asText())) {
                output.set<JsonNode>(key, objectMapper.valueToTree(resolved[value.asText()]))
            } else {
                output.set<JsonNode>(key, value)
            }
        }
        return output
    }

    private fun buildPayload(
        execution: DelegateExecution,
        processLink: ExternalPluginProcessLink,
        configuration: ExternalPluginConfiguration,
        properties: ObjectNode,
    ): ObjectNode {
        val payload = objectMapper.createObjectNode()
        payload.put("configurationId", configuration.id.toString())
        payload.put("processInstanceId", execution.processInstanceId)
        payload.put("activityId", execution.currentActivityId)
        execution.processBusinessKey?.let { payload.put("documentId", it) }
        payload.set<JsonNode>("properties", properties)
        return payload
    }

    private fun applySuccess(execution: DelegateExecution, body: JsonNode?) {
        val variables = body?.get("variables") ?: return
        if (!variables.isObject) return
        variables.fields().forEachRemaining { (key, value) ->
            execution.setVariable(key, objectMapper.treeToValue(value, Any::class.java))
        }
    }

    private fun bpmnError(
        response: ExternalPluginHostClient.ActionResponse,
        definition: ExternalPluginDefinition,
        processLink: ExternalPluginProcessLink,
    ): BpmnError {
        val errorCode = response.body?.get("errorCode")?.asText()
            ?: "EXTERNAL_PLUGIN_${response.status}"
        val message = (response.body?.get("errorMessage") ?: response.body?.get("message"))?.asText()
            ?: "External plugin '${definition.pluginId}' action '${processLink.actionKey}' returned ${response.status}"
        logger.warn { "External plugin returned 4xx: $message" }
        return BpmnError(errorCode, message)
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
