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
import com.ritense.externalplugin.exception.ExternalPluginActionFailedException
import com.ritense.externalplugin.repository.ExternalPluginProcessLinkRepository
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginDefinitionService
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.ritense.logging.withLoggingContext
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.service.BuildingBlockPluginConfigurationResolver
import com.ritense.plugin.service.PluginActionResultHandler
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.event.OperatonExecutionEvent
import com.ritense.valueresolver.ValueResolverService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import java.util.UUID
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
    private val pluginActionResultHandler: PluginActionResultHandler,
    private val buildingBlockPluginConfigurationResolver: BuildingBlockPluginConfigurationResolver? = null,
) {

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
        val configurationId = resolveConfigurationId(execution, processLink)
        val configuration = configurationService.get(configurationId)
        val definition = definitionService.get(configuration.definitionId)
        validateResolvedDefinition(processLink, definition)
        requireAcceptedContent(definition, processLink)
        val host = hostService.get(definition.hostId)
        val hostSecret = hostService.decryptedSecret(host)

        val resolvedProperties = resolveActionProperties(execution, processLink)
        val payload = buildPayload(execution, processLink, configuration, resolvedProperties)

        // Version always comes from the resolved configuration's definition, never from the link's
        // (design-time-only) reference — invoking v1 plugin code with a v2 config's token must be
        // impossible. See PluginConfigurationReference / D1.
        val response = hostClient.invokeAction(
            baseUrl = host.baseUrl,
            pluginId = definition.pluginId,
            version = definition.version,
            actionKey = processLink.actionKey,
            payload = payload,
            hostSecret = hostSecret,
        )

        when {
            response.status in 200..299 -> {
                validateDeclaredOutputs(definition, processLink, response.body)
                applySuccess(execution, processLink, response.body)
            }

            else -> throw actionFailed(response, definition, processLink)
        }
    }

    /**
     * Enforces the manifest's result contract at runtime: when the resolved definition's manifest
     * declares `outputs` for the invoked action, the response's `result` must contain every
     * declared key. A key may hold JSON null — null is a legitimate value — but an absent key means
     * the plugin broke its own contract (typically a value dropped during serialization, e.g. an
     * `undefined` in a JS plugin), which would otherwise surface only as a silently skipped result
     * mapping. Validated before anything (variables or mappings) is applied, so a contract
     * violation fails the invocation without partial writes.
     */
    private fun validateDeclaredOutputs(
        definition: ExternalPluginDefinition,
        processLink: ExternalPluginProcessLink,
        body: JsonNode?,
    ) {
        val declaredOutputs = declaredOutputs(definition, processLink.actionKey)
        if (declaredOutputs.isEmpty()) {
            return
        }

        val result = body?.get("result")
        val missingKeys = if (result != null && result.isObject) {
            declaredOutputs.filterNot { result.has(it) }
        } else {
            declaredOutputs
        }
        if (missingKeys.isNotEmpty()) {
            val message = "External plugin '${definition.pluginId}@${definition.version}' action " +
                "'${processLink.actionKey}' declares outputs $declaredOutputs in its manifest, but its " +
                "result is missing key(s) $missingKeys. Every declared output must be returned; " +
                "returning null for a key is allowed."
            logger.warn { message }
            throw ExternalPluginActionFailedException("RESULT_CONTRACT_VIOLATION", message)
        }
    }

    private fun declaredOutputs(definition: ExternalPluginDefinition, actionKey: String): List<String> {
        val actions = definition.manifestJson?.get("actions") ?: return emptyList()
        if (!actions.isArray) return emptyList()
        val action = actions.firstOrNull { it.get("key")?.asText() == actionKey } ?: return emptyList()
        val outputs = action.get("outputs") ?: return emptyList()
        if (!outputs.isArray) return emptyList()
        return outputs.mapNotNull { if (it.isTextual) it.asText() else null }
    }

    /**
     * `FIXED` links carry the configuration id directly. `BUILDING_BLOCK` links carry a
     * `pluginId`/version pair (design-time metadata, D1) and are resolved through the shared
     * [BuildingBlockPluginConfigurationResolver] SPI (already in `:backend:plugin`; no new module
     * dependency) using the namespaced key `external-plugin:<pluginId>@<version>` (D2) — the same
     * `pluginConfigurationMappings` map the embedded system's `PluginService.invoke` reads, just
     * under a distinct key so the two systems can never collide.
     */
    private fun resolveConfigurationId(execution: DelegateExecution, processLink: ExternalPluginProcessLink): UUID {
        return when (processLink.pluginConfigurationReference.type) {
            PluginConfigurationReferenceType.FIXED -> requireNotNull(processLink.externalPluginConfigurationId) {
                "External plugin process link '${processLink.id}' has no configuration id"
            }

            PluginConfigurationReferenceType.BUILDING_BLOCK -> {
                val pluginId = processLink.pluginConfigurationReference.pluginDefinitionKey
                    ?: throw IllegalStateException(
                        "External plugin process link '${processLink.id}' has a BUILDING_BLOCK reference " +
                            "without a pluginDefinitionKey"
                    )
                val version = processLink.pluginConfigurationReference.pluginDefinitionVersion
                    ?: throw IllegalStateException(
                        "External plugin process link '${processLink.id}' has a BUILDING_BLOCK reference " +
                            "without a pluginDefinitionVersion"
                    )
                val resolver = buildingBlockPluginConfigurationResolver
                    ?: throw IllegalStateException(
                        "Building block plugin configuration resolver is not available — cannot resolve " +
                            "external plugin process link '${processLink.id}'"
                    )

                val mappingKey = buildingBlockMappingKey(pluginId, version)
                resolver.resolve(execution, mappingKey)
                    ?: resolver.resolveByKeyPrefix(execution, buildingBlockMappingKeyPrefix(pluginId))?.also {
                        // Version-tolerant fallback: no mapping for the exact pinned version, but one
                        // exists for another version of the same plugin. The resolved configuration's
                        // version wins at runtime (D1), mirroring how a mismatched version is accepted
                        // for FIXED links; validateResolvedDefinition surfaces the mismatch as a warning.
                        logger.warn {
                            "No building-block plugin configuration mapping for '$mappingKey' (process " +
                                "link '${processLink.id}'); using a mapping for a different version of " +
                                "external plugin '$pluginId'."
                        }
                    }
                    ?: throw IllegalStateException(
                        "No plugin configuration mapping provided for external plugin '$mappingKey' " +
                            "(process link '${processLink.id}')"
                    )
            }
        }
    }

    /**
     * Version mismatches between the (design-time) reference and the resolved configuration's
     * definition are allowed — the resolved definition's version always wins at runtime (D1) — but
     * are surfaced as a warning since they usually mean the BB mapping was pinned to a version that
     * later moved. A `pluginId` mismatch is not recoverable: it means the mapped configuration
     * belongs to an entirely different plugin, so the action would be invoked against unrelated code.
     * Regardless of reference type, the resolved definition's manifest must still declare the
     * action key the link invokes — a `BUILDING_BLOCK` mapping can point at a configuration whose
     * definition no longer exposes this action.
     */
    private fun validateResolvedDefinition(processLink: ExternalPluginProcessLink, definition: ExternalPluginDefinition) {
        val reference = processLink.pluginConfigurationReference
        val expectedPluginId = reference.pluginDefinitionKey

        if (expectedPluginId != null) {
            require(definition.pluginId == expectedPluginId) {
                "External plugin process link '${processLink.id}' expects plugin '$expectedPluginId' " +
                    "but resolved configuration belongs to plugin '${definition.pluginId}'"
            }

            val expectedVersion = reference.pluginDefinitionVersion
            if (expectedVersion != null && expectedVersion != definition.version) {
                logger.warn {
                    "External plugin process link '${processLink.id}' reference pins version " +
                        "'$expectedVersion' for plugin '$expectedPluginId', but the resolved configuration " +
                        "uses version '${definition.version}' — proceeding with the resolved configuration's version"
                }
            }
        }

        require(definitionDeclaresActionKey(definition, processLink.actionKey)) {
            "External plugin process link '${processLink.id}' invokes action '${processLink.actionKey}' " +
                "which plugin '${definition.pluginId}@${definition.version}' does not declare in its manifest"
        }
    }

    private fun definitionDeclaresActionKey(definition: ExternalPluginDefinition, actionKey: String): Boolean {
        val actions = definition.manifestJson?.get("actions") ?: return true
        if (!actions.isArray) return true
        return actions.any { it.get("key")?.asText() == actionKey }
    }

    private fun buildingBlockMappingKey(pluginId: String, version: String) = "external-plugin:$pluginId@$version"

    /** Version-agnostic prefix of [buildingBlockMappingKey]: matches a mapping for any version of the plugin. */
    private fun buildingBlockMappingKeyPrefix(pluginId: String) = "external-plugin:$pluginId@"

    private fun resolveActionProperties(execution: DelegateExecution, processLink: ExternalPluginProcessLink): ObjectNode {
        val rawProperties = processLink.actionProperties ?: objectMapper.createObjectNode()
        val keysToResolve = mutableListOf<String>()
        rawProperties.fields().forEachRemaining { (_, value) ->
            // Only send values through the resolver when a resolver factory actually supports the
            // prefix. A literal that merely contains a colon (e.g. "https://example.com") is passed
            // through untouched instead of tripping the resolver on an unknown prefix.
            if (value.isTextual && valueResolverService.supportsValue(value.asText())) {
                keysToResolve += value.asText()
            }
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

    /**
     * `variables` and `result` are separate channels that never interfere: `variables` keeps its
     * existing process-variable behavior unconditionally, while `result` only feeds the configured
     * [PluginActionResultMapping][com.ritense.plugin.domain.PluginActionResultMapping]s. Plugins built
     * against an older SDK simply omit `result` and have nothing to map.
     */
    private fun applySuccess(execution: DelegateExecution, processLink: ExternalPluginProcessLink, body: JsonNode?) {
        val variables = body?.get("variables")
        if (variables != null && variables.isObject) {
            variables.fields().forEachRemaining { (key, value) ->
                execution.setVariable(key, objectMapper.treeToValue(value, Any::class.java))
            }
        }

        if (processLink.actionResultMappings.isNotEmpty()) {
            pluginActionResultHandler.handle(execution, body?.get("result"), processLink.actionResultMappings)
        }
    }

    /**
     * Turns a non-2xx host response into a failure that surfaces on the job incident with the
     * plugin's real error code and message. See [ExternalPluginActionFailedException] for why this
     * is a plain exception and not a BpmnError.
     */
    /**
     * A definition whose host package changed after acceptance must not be invoked: what would run
     * is not what the admin accepted. Fails the invocation (surfacing as a process incident) until
     * an admin re-accepts the new content.
     */
    private fun requireAcceptedContent(definition: ExternalPluginDefinition, processLink: ExternalPluginProcessLink) {
        if (definition.requiresReacceptance) {
            val message = "External plugin '${definition.pluginId}@${definition.version}' action " +
                "'${processLink.actionKey}' was not invoked: the plugin package changed on its host " +
                "and awaits re-acceptance by an administrator"
            logger.warn { message }
            throw ExternalPluginActionFailedException(CONTENT_CHANGED_ERROR_CODE, message)
        }
    }

    private fun actionFailed(
        response: ExternalPluginHostClient.ActionResponse,
        definition: ExternalPluginDefinition,
        processLink: ExternalPluginProcessLink,
    ): ExternalPluginActionFailedException {
        val errorCode = response.body?.get("errorCode")?.asText()
            ?: "EXTERNAL_PLUGIN_${response.status}"
        val detail = (response.body?.get("errorMessage") ?: response.body?.get("message"))?.asText()
        val message = buildString {
            append("External plugin '${definition.pluginId}' action '${processLink.actionKey}' ")
            append("failed with status ${response.status} (code: $errorCode)")
            if (!detail.isNullOrBlank()) append(": $detail")
        }
        logger.warn { message }
        return ExternalPluginActionFailedException(errorCode, message)
    }

    companion object {
        /** Error code raised when an invocation is blocked pending content re-acceptance. */
        const val CONTENT_CHANGED_ERROR_CODE = "EXTERNAL_PLUGIN_CONTENT_CHANGED"

        private val logger = KotlinLogging.logger {}
    }
}
