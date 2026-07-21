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
import com.ritense.authorization.AuthorizationService
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginTaskFormProcessLink
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginDefinitionService
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.operaton.domain.OperatonTask
import com.ritense.valtimo.service.OperatonTaskService
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.UUID

class ExternalPluginTaskFormSubmissionServiceTest {

    private lateinit var processLinkService: ProcessLinkService
    private lateinit var configurationService: ExternalPluginConfigurationService
    private lateinit var definitionService: ExternalPluginDefinitionService
    private lateinit var hostService: ExternalPluginHostService
    private lateinit var hostClient: ExternalPluginHostClient
    private lateinit var processDocumentService: ProcessDocumentService
    private lateinit var documentService: JsonSchemaDocumentService
    private lateinit var operatonTaskService: OperatonTaskService
    private lateinit var authorizationService: AuthorizationService
    private lateinit var valueResolverService: ValueResolverService
    private lateinit var objectMapper: ObjectMapper
    private lateinit var service: ExternalPluginTaskFormSubmissionService

    private val processLinkId = UUID.randomUUID()
    private val configurationId = UUID.randomUUID()
    private val definitionId = UUID.randomUUID()
    private val hostId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        processLinkService = mock()
        configurationService = mock()
        definitionService = mock()
        hostService = mock()
        hostClient = mock()
        processDocumentService = mock()
        documentService = mock()
        operatonTaskService = mock()
        authorizationService = mock()
        valueResolverService = mock()
        objectMapper = ObjectMapper()
        service = ExternalPluginTaskFormSubmissionService(
            processLinkService,
            configurationService,
            definitionService,
            hostService,
            hostClient,
            processDocumentService,
            documentService,
            operatonTaskService,
            authorizationService,
            valueResolverService,
            objectMapper,
        )
    }

    @Test
    fun `Level 1 hook rejection surfaces field errors and never completes the task`() {
        givenProcessLink(bundleKey = "review")
        givenTask()
        givenManifestWithTaskFormBundle(key = "review", submitHandler = true)
        givenHook()
        whenever(hostClient.invokeSubmit(any(), any(), any(), any(), any(), any())).thenReturn(
            ExternalPluginHostClient.ActionResponse(
                status = 422,
                body = objectMapper.readTree(
                    """{"status":"error","errorMessage":"A comment is required when rejecting.","fieldErrors":{"comment":"Please explain."}}""",
                ),
            ),
        )

        val result = service.handleSubmission(
            processLinkId,
            objectMapper.readTree("""{"decision":"reject","comment":""}"""),
            documentId = "doc-1",
            taskInstanceId = "task-1",
        )

        assertThat(result.fieldErrors).containsEntry("comment", "Please explain.")
        assertThat(result.errors).contains("A comment is required when rejecting.")
        // The task must NOT be completed when the plugin rejects the submission.
        verify(processDocumentService, never()).dispatch(any())
        verify(operatonTaskService, never()).completeTaskWithFormData(any(), any())
    }

    @Test
    fun `Level 0 without a submit handler categorizes values and completes the task itself (no document)`() {
        givenProcessLink(bundleKey = "approve")
        givenTask()
        // Bundle exists but does not declare a submit handler → the hook is skipped (Level 0).
        givenManifestWithTaskFormBundle(key = "approve", submitHandler = false)

        val result = service.handleSubmission(
            processLinkId,
            objectMapper.readTree("""{"caseApproved":true,"pv:score":5}"""),
            documentId = null,
            taskInstanceId = "task-1",
        )

        // No plugin backend was called, and GZAC completed the task with the categorized variables.
        verify(hostClient, never()).invokeSubmit(any(), any(), any(), any(), any(), any())
        val captor = argumentCaptor<Map<String, Any>>()
        verify(operatonTaskService).completeTaskWithFormData(eq("task-1"), captor.capture())
        assertThat(captor.firstValue).containsEntry("caseApproved", true)
        assertThat(captor.firstValue).containsEntry("score", 5)
        assertThat(result.errors).isEmpty()
        assertThat(result.fieldErrors).isEmpty()
    }

    private fun givenProcessLink(bundleKey: String?) {
        val processLink = ExternalPluginTaskFormProcessLink(
            id = processLinkId,
            processDefinitionId = "process-def-id",
            activityId = "UserTask_Review",
            activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
            externalPluginConfigurationId = configurationId,
            bundleKey = bundleKey,
            pluginConfigurationReference = PluginConfigurationReference(
                type = PluginConfigurationReferenceType.FIXED,
                pluginDefinitionKey = "case-summary",
                pluginDefinitionVersion = "0.1.0",
            ),
        )
        whenever(
            processLinkService.getProcessLink(processLinkId, ExternalPluginTaskFormProcessLink::class.java),
        ).thenReturn(processLink)
    }

    private fun givenTask() {
        val task = mock<OperatonTask> {
            on { id } doReturn "task-1"
        }
        whenever(operatonTaskService.findTaskById("task-1")).thenReturn(task)
    }

    private fun givenManifestWithTaskFormBundle(key: String, submitHandler: Boolean) {
        val bundle = objectMapper.createObjectNode().apply {
            put("type", "task-form")
            put("key", key)
            if (submitHandler) put("submitHandler", true)
        }
        val manifest: ObjectNode = objectMapper.createObjectNode().apply {
            set<JsonNode>("frontendBundles", objectMapper.createArrayNode().add(bundle))
        }
        val configuration = mock<ExternalPluginConfiguration> {
            on { this.definitionId } doReturn definitionId
        }
        val definition = mock<ExternalPluginDefinition> {
            on { manifestJson } doReturn manifest
            on { this.hostId } doReturn hostId
            on { pluginId } doReturn "case-summary"
            on { version } doReturn "0.1.0"
        }
        whenever(configurationService.get(configurationId)).thenReturn(configuration)
        whenever(definitionService.get(definitionId)).thenReturn(definition)
    }

    private fun givenHook() {
        val host = mock<ExternalPluginHost> {
            on { baseUrl } doReturn "http://localhost:8090"
        }
        whenever(hostService.get(hostId)).thenReturn(host)
        whenever(hostService.decryptedSecret(host)).thenReturn("secret")
    }
}
