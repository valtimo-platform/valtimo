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
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.ModifyDocumentRequest
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginTaskFormProcessLink
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormSubmissionResult
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginDefinitionService
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.ritense.processdocument.domain.impl.request.ModifyDocumentAndCompleteTaskRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processdocument.resolver.CaseDocumentJsonValueResolverFactory.Companion.PREFIX as DOC_PREFIX
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.operaton.authorization.OperatonTaskActionProvider
import com.ritense.valtimo.operaton.domain.OperatonTask
import com.ritense.valtimo.service.OperatonTaskService
import com.ritense.valueresolver.ProcessVariableValueResolverFactory.Companion.PREFIX as PV_PREFIX
import com.ritense.valueresolver.ValueResolverService
import com.ritense.valueresolver.ValueResolverServiceImpl.Companion.DELIMITER
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Completes a user task backed by an external-plugin `task-form` bundle the *same way* GZAC completes
 * every other form: it categorises the submitted values by value-resolver prefix and dispatches a
 * [ModifyDocumentAndCompleteTaskRequest] through [ProcessDocumentService]. The task is completed
 * server-side, as the logged-in user (PBAC applies), and value resolvers / document updates / the
 * `TaskCompleted` outbox event all fire — no plugin code, permission grant or user token needed for
 * the common case.
 *
 * Three capability levels are supported (see the sample plugin):
 * - **Level 0 — pure form.** The submission map arrives with value-resolver-prefixed keys
 *   (`pv:approved`, `doc:/reviewComment`); this service categorises and completes. Unprefixed keys
 *   are treated as process variables.
 * - **Level 1 — transform / validate hook.** When the manifest's `task-form` bundle declares
 *   `submitHandler: true`, this service first calls the plugin's `handle_submit` export
 *   (server-to-server, HMAC, on the same rails as actions). The plugin returns `{variables,
 *   documentContent?}` (which become the effective submission) or `{status: "error", …, fieldErrors}`
 *   which is surfaced to the form without completing the task.
 * - **Level 2 — full custom.** Untouched: a plugin may still drive completion itself through
 *   `request()` + `gzacApi.asUser`. That path does not use this service.
 */
@Transactional
@SkipComponentScan
class ExternalPluginTaskFormSubmissionService(
    private val processLinkService: ProcessLinkService,
    private val configurationService: ExternalPluginConfigurationService,
    private val definitionService: ExternalPluginDefinitionService,
    private val hostService: ExternalPluginHostService,
    private val hostClient: ExternalPluginHostClient,
    private val processDocumentService: ProcessDocumentService,
    private val documentService: JsonSchemaDocumentService,
    private val operatonTaskService: OperatonTaskService,
    private val authorizationService: AuthorizationService,
    private val valueResolverService: ValueResolverService,
    private val objectMapper: ObjectMapper,
) {

    fun handleSubmission(
        processLinkId: UUID,
        submission: JsonNode,
        documentId: String?,
        taskInstanceId: String?,
    ): ExternalPluginTaskFormSubmissionResult {
        // Validate up front: without a task there is nothing to complete and — crucially — no task
        // to check the COMPLETE permission on, so no hook may run either.
        requireNotNull(taskInstanceId) { "A task-form submission requires a taskInstanceId" }
        val processLink = processLinkService.getProcessLink(
            processLinkId,
            ExternalPluginTaskFormProcessLink::class.java,
        )
        val task = requireCompleteTaskPermission(taskInstanceId)

        // Level 1 — hand the raw submission to the plugin to validate/transform first, if declared.
        val effectiveSubmission = when (val hook = resolveSubmitHook(processLink)) {
            null -> submission
            else -> {
                val response = invokeHook(hook, processLink, submission, task, documentId)
                if (response.status !in 200..299) {
                    return hookRejection(response.body)
                }
                normalizeHookOutput(response.body)
            }
        }

        return complete(effectiveSubmission, documentId, taskInstanceId)
    }

    /**
     * Loads the task and asserts the caller may complete it. Mirrors the URL/form submission services
     * so a plugin task-form is governed by exactly the same COMPLETE permission as any other form.
     */
    private fun requireCompleteTaskPermission(taskInstanceId: String): OperatonTask {
        val task = operatonTaskService.findTaskById(taskInstanceId)
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                OperatonTask::class.java,
                OperatonTaskActionProvider.COMPLETE,
                task,
            )
        )
        return task
    }

    private fun complete(
        submission: JsonNode,
        documentId: String?,
        taskInstanceId: String?,
    ): ExternalPluginTaskFormSubmissionResult {
        val categorized = categorize(submission)

        if (documentId == null) {
            // No case document (non-case-bound process): complete with process variables only. The
            // value-resolver values (doc:/case: …) have no document to write to and are ignored.
            requireNotNull(taskInstanceId) { "A task-form submission requires a taskInstanceId or a documentId" }
            operatonTaskService.completeTaskWithFormData(taskInstanceId, categorized.processVariables)
            return ExternalPluginTaskFormSubmissionResult()
        }

        requireNotNull(taskInstanceId) { "A task-form user-task submission requires a taskInstanceId" }
        val document = runWithoutAuthorization { documentService.get(documentId) }
        val request = ModifyDocumentAndCompleteTaskRequest(
            ModifyDocumentRequest(document.id().toString(), objectMapper.createObjectNode()),
            taskInstanceId,
        ).withProcessVars(categorized.processVariables)

        val result = processDocumentService.dispatch(
            request.withAdditionalModifications { modified: JsonSchemaDocument ->
                if (categorized.valueResolverValues.isNotEmpty()) {
                    valueResolverService.handleValues(modified.id.id, categorized.valueResolverValues)
                }
            }
        )

        return if (result.errors().isNotEmpty()) {
            ExternalPluginTaskFormSubmissionResult(errors = result.errors().map { it.asString() })
        } else {
            ExternalPluginTaskFormSubmissionResult(
                documentId = result.resultingDocument().orElseThrow().id().toString()
            )
        }
    }

    /**
     * Splits the submission map by value-resolver prefix:
     * - `pv:foo` (and unprefixed keys) → process variables (`pv:` stripped);
     * - anything else with a `:` prefix (`doc:/x`, `case:x`, custom resolvers) → value-resolver
     *   values applied against the resulting document, exactly like a form.io submission.
     */
    private fun categorize(submission: JsonNode): Categorized {
        val processVariables = mutableMapOf<String, Any>()
        val valueResolverValues = mutableMapOf<String, Any?>()
        submission.fields().forEach { (key, valueNode) ->
            val value: Any? = if (valueNode.isNull) null else objectMapper.treeToValue(valueNode, Any::class.java)
            when {
                key.startsWith("$PV_PREFIX$DELIMITER") -> value?.let { processVariables[key.substringAfter(DELIMITER)] = it }
                !key.contains(DELIMITER) -> value?.let { processVariables[key] = it }
                else -> valueResolverValues[key] = value
            }
        }
        return Categorized(processVariables, valueResolverValues)
    }

    // ---- Level 1 hook plumbing ----

    private fun resolveSubmitHook(processLink: ExternalPluginTaskFormProcessLink): SubmitHook? {
        val configuration = configurationService.get(processLink.externalPluginConfigurationId)
        val definition = definitionService.get(configuration.definitionId)
        val bundle = findTaskFormBundle(definition, processLink.bundleKey) ?: return null
        if (bundle.get("submitHandler")?.asBoolean() != true) return null
        // The plugin registers its handler under the bundle key (`submit("review", …)`), so the key
        // is required to route the hook.
        val submitKey = bundle.get("key")?.asText() ?: return null
        val host = hostService.get(definition.hostId)
        // Version always comes from the resolved configuration's definition, never from the link's
        // (design-time-only) reference — same rule as ExternalPluginServiceTaskStartListener. See
        // PluginConfigurationReference / D1.
        return SubmitHook(
            baseUrl = host.baseUrl,
            pluginId = definition.pluginId,
            version = definition.version,
            submitKey = submitKey,
            hostSecret = hostService.decryptedSecret(host),
        )
    }

    private fun findTaskFormBundle(definition: ExternalPluginDefinition, bundleKey: String?): JsonNode? {
        val bundles = definition.manifestJson?.get("frontendBundles") ?: return null
        if (!bundles.isArray) return null
        val typed = bundles.filter { it.get("type")?.asText() == TASK_FORM_BUNDLE_TYPE }
        return when {
            bundleKey != null -> typed.firstOrNull { it.get("key")?.asText() == bundleKey }
            else -> typed.singleOrNull() ?: typed.firstOrNull()
        }
    }

    private fun invokeHook(
        hook: SubmitHook,
        processLink: ExternalPluginTaskFormProcessLink,
        submission: JsonNode,
        task: OperatonTask?,
        documentId: String?,
    ): ExternalPluginHostClient.ActionResponse {
        val payload = objectMapper.createObjectNode().apply {
            put("configurationId", processLink.externalPluginConfigurationId.toString())
            task?.id?.let { put("taskId", it) }
            task?.processInstance?.id?.let { put("processInstanceId", it) }
            documentId?.let { put("documentId", it) }
            set<JsonNode>("submission", submission)
        }
        return hostClient.invokeSubmit(
            baseUrl = hook.baseUrl,
            pluginId = hook.pluginId,
            version = hook.version,
            submitKey = hook.submitKey,
            payload = payload,
            hostSecret = hook.hostSecret,
        )
    }

    /**
     * Turns a Level 1 hook's `{variables, documentContent}` output into the same value-resolver-
     * prefixed submission map [complete] categorises, so both levels flow through one code path.
     */
    private fun normalizeHookOutput(body: JsonNode?): ObjectNode {
        val normalized = objectMapper.createObjectNode()
        body?.get("variables")?.takeIf { it.isObject }?.fields()?.forEach { (key, value) ->
            normalized.set<JsonNode>("$PV_PREFIX$DELIMITER$key", value)
        }
        body?.get("documentContent")?.takeIf { it.isObject }?.fields()?.forEach { (path, value) ->
            val pointer = if (path.startsWith("/")) path else "/$path"
            normalized.set<JsonNode>("$DOC_PREFIX$DELIMITER$pointer", value)
        }
        return normalized
    }

    private fun hookRejection(body: JsonNode?): ExternalPluginTaskFormSubmissionResult {
        val fieldErrors = body?.get("fieldErrors")?.takeIf { it.isObject }
            ?.let { node -> node.fields().asSequence().associate { (k, v) -> k to v.asText() } }
            ?: emptyMap()
        val message = (body?.get("errorMessage") ?: body?.get("message"))?.asText()
        val errors = buildList {
            if (message != null) add(message)
            if (isEmpty() && fieldErrors.isEmpty()) add("Submission was rejected by the plugin")
        }
        logger.info { "External plugin task-form submit hook rejected the submission (fieldErrors=${fieldErrors.keys})" }
        return ExternalPluginTaskFormSubmissionResult(errors = errors, fieldErrors = fieldErrors)
    }

    private data class Categorized(
        val processVariables: Map<String, Any>,
        val valueResolverValues: Map<String, Any?>,
    )

    private data class SubmitHook(
        val baseUrl: String,
        val pluginId: String,
        val version: String,
        val submitKey: String,
        val hostSecret: String,
    )

    companion object {
        private const val TASK_FORM_BUNDLE_TYPE = "task-form"
        private val logger = KotlinLogging.logger {}
    }
}
