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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginProcessLink
import com.ritense.externalplugin.exception.ExternalPluginActionFailedException
import com.ritense.externalplugin.repository.ExternalPluginProcessLinkRepository
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginDefinitionService
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.ritense.plugin.domain.PluginActionResultMapping
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.service.BuildingBlockPluginConfigurationResolver
import com.ritense.plugin.service.PluginActionResultHandler
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.event.OperatonExecutionEvent
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.BpmnError
import org.operaton.bpm.engine.delegate.DelegateExecution
import java.util.UUID

class ExternalPluginServiceTaskStartListenerTest {

    private lateinit var processLinkRepository: ExternalPluginProcessLinkRepository
    private lateinit var configurationService: ExternalPluginConfigurationService
    private lateinit var definitionService: ExternalPluginDefinitionService
    private lateinit var hostService: ExternalPluginHostService
    private lateinit var hostClient: ExternalPluginHostClient
    private lateinit var valueResolverService: ValueResolverService
    private lateinit var objectMapper: ObjectMapper
    private lateinit var pluginActionResultHandler: PluginActionResultHandler
    private lateinit var listener: ExternalPluginServiceTaskStartListener

    private val configurationId = UUID.randomUUID()
    private val definitionId = UUID.randomUUID()
    private val hostId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        processLinkRepository = mock()
        configurationService = mock()
        definitionService = mock()
        hostService = mock()
        hostClient = mock()
        valueResolverService = mock()
        objectMapper = ObjectMapper()
        pluginActionResultHandler = mock()
        listener = ExternalPluginServiceTaskStartListener(
            processLinkRepository,
            configurationService,
            definitionService,
            hostService,
            hostClient,
            valueResolverService,
            objectMapper,
            pluginActionResultHandler,
        )

        val configuration = mock<ExternalPluginConfiguration> {
            on { id } doReturn configurationId
            on { this.definitionId } doReturn definitionId
        }
        val definition = mock<ExternalPluginDefinition> {
            on { this.hostId } doReturn hostId
            on { pluginId } doReturn "case-summary"
            on { version } doReturn "0.1.0"
        }
        val host = mock<ExternalPluginHost> {
            on { baseUrl } doReturn "http://localhost:8090"
        }
        whenever(configurationService.get(configurationId)).thenReturn(configuration)
        whenever(definitionService.get(definitionId)).thenReturn(definition)
        whenever(hostService.get(hostId)).thenReturn(host)
        whenever(hostService.decryptedSecret(host)).thenReturn("secret")
    }

    /**
     * A global (no-case) process has a null business key, so a case-bound plugin returns a 4xx. The
     * listener must surface the plugin's real error as a plain [ExternalPluginActionFailedException]
     * — never a BpmnError, which the @Transactional event bridge would mask as an opaque
     * "Transaction silently rolled back" incident (see #769).
     */
    @Test
    fun `4xx plugin error surfaces as ExternalPluginActionFailedException with the real message`() {
        whenever(hostClient.invokeAction(any(), any(), any(), any(), any(), any())).thenReturn(
            ExternalPluginHostClient.ActionResponse(
                status = 422,
                body = objectMapper.readTree(
                    """{"errorCode":"NO_BUSINESS_KEY","errorMessage":"Process has no business key — case-summary requires a case-bound process"}""",
                ),
            ),
        )

        val event = globalProcessServiceTaskEvent()

        assertThatThrownBy { listener.notify(event) }
            .isInstanceOf(ExternalPluginActionFailedException::class.java)
            .isNotInstanceOf(BpmnError::class.java)
            .hasMessageContaining("NO_BUSINESS_KEY")
            .hasMessageContaining("Process has no business key")
            .hasMessageContaining("422")

        val exception = runCatching { listener.notify(globalProcessServiceTaskEvent()) }.exceptionOrNull()
        assertThat((exception as ExternalPluginActionFailedException).errorCode).isEqualTo("NO_BUSINESS_KEY")
    }

    @Test
    fun `5xx host error surfaces as ExternalPluginActionFailedException`() {
        whenever(hostClient.invokeAction(any(), any(), any(), any(), any(), any())).thenReturn(
            ExternalPluginHostClient.ActionResponse(status = 500, body = null),
        )

        assertThatThrownBy { listener.notify(globalProcessServiceTaskEvent()) }
            .isInstanceOf(ExternalPluginActionFailedException::class.java)
            .isNotInstanceOf(BpmnError::class.java)
            .hasMessageContaining("500")
            .hasMessageContaining("case-summary")
    }

    @Test
    fun `BUILDING_BLOCK reference resolves the configuration via the namespaced key`() {
        val resolver = mock<BuildingBlockPluginConfigurationResolver>()
        val listenerWithResolver = ExternalPluginServiceTaskStartListener(
            processLinkRepository,
            configurationService,
            definitionService,
            hostService,
            hostClient,
            valueResolverService,
            objectMapper,
            pluginActionResultHandler,
            resolver,
        )

        val processLink = buildingBlockProcessLink(pluginId = "case-summary", version = "0.1.0")
        val execution = executionFor(processLink)

        whenever(resolver.resolve(execution, "external-plugin:case-summary@0.1.0")).thenReturn(configurationId)
        whenever(hostClient.invokeAction(any(), any(), any(), any(), any(), any())).thenReturn(
            ExternalPluginHostClient.ActionResponse(status = 200, body = objectMapper.createObjectNode()),
        )

        listenerWithResolver.notify(OperatonExecutionEvent(execution, "start"))

        verify(resolver).resolve(execution, "external-plugin:case-summary@0.1.0")
        verify(hostClient).invokeAction(
            baseUrl = eq("http://localhost:8090"),
            pluginId = eq("case-summary"),
            version = eq("0.1.0"),
            actionKey = eq("case-summary"),
            payload = any(),
            hostSecret = eq("secret"),
        )
    }

    @Test
    fun `BUILDING_BLOCK reference with mismatched pluginId throws a clear error`() {
        val resolver = mock<BuildingBlockPluginConfigurationResolver>()
        val listenerWithResolver = ExternalPluginServiceTaskStartListener(
            processLinkRepository,
            configurationService,
            definitionService,
            hostService,
            hostClient,
            valueResolverService,
            objectMapper,
            pluginActionResultHandler,
            resolver,
        )

        // configurationId resolves to a definition with pluginId "case-summary" (see setUp),
        // but the reference expects a different plugin — must not silently invoke the wrong plugin.
        val processLink = buildingBlockProcessLink(pluginId = "other-plugin", version = "0.1.0")
        val execution = executionFor(processLink)

        whenever(resolver.resolve(execution, "external-plugin:other-plugin@0.1.0")).thenReturn(configurationId)

        assertThatThrownBy { listenerWithResolver.notify(OperatonExecutionEvent(execution, "start")) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("other-plugin")
            .hasMessageContaining("case-summary")
    }

    @Test
    fun `BUILDING_BLOCK reference with a version mismatch proceeds with the resolved configuration's version`() {
        val resolver = mock<BuildingBlockPluginConfigurationResolver>()
        val listenerWithResolver = ExternalPluginServiceTaskStartListener(
            processLinkRepository,
            configurationService,
            definitionService,
            hostService,
            hostClient,
            valueResolverService,
            objectMapper,
            pluginActionResultHandler,
            resolver,
        )

        // setUp wires the definition to version "0.1.0"; the reference is pinned to "0.0.9".
        val processLink = buildingBlockProcessLink(pluginId = "case-summary", version = "0.0.9")
        val execution = executionFor(processLink)

        whenever(resolver.resolve(execution, "external-plugin:case-summary@0.0.9")).thenReturn(configurationId)
        whenever(hostClient.invokeAction(any(), any(), any(), any(), any(), any())).thenReturn(
            ExternalPluginHostClient.ActionResponse(status = 200, body = objectMapper.createObjectNode()),
        )

        listenerWithResolver.notify(OperatonExecutionEvent(execution, "start"))

        verify(hostClient).invokeAction(
            baseUrl = any(),
            pluginId = eq("case-summary"),
            version = eq("0.1.0"),
            actionKey = any(),
            payload = any(),
            hostSecret = any(),
        )
    }

    @Test
    fun `BUILDING_BLOCK reference to a definition whose manifest no longer declares the action key throws a clear error`() {
        val resolver = mock<BuildingBlockPluginConfigurationResolver>()
        val listenerWithResolver = ExternalPluginServiceTaskStartListener(
            processLinkRepository,
            configurationService,
            definitionService,
            hostService,
            hostClient,
            valueResolverService,
            objectMapper,
            pluginActionResultHandler,
            resolver,
        )

        val staleDefinitionId = UUID.randomUUID()
        val staleConfigurationId = UUID.randomUUID()
        val staleConfiguration = mock<ExternalPluginConfiguration> {
            on { id } doReturn staleConfigurationId
            on { this.definitionId } doReturn staleDefinitionId
        }
        val staleDefinition = mock<ExternalPluginDefinition> {
            on { this.hostId } doReturn hostId
            on { pluginId } doReturn "case-summary"
            on { version } doReturn "0.2.0"
            on { manifestJson } doReturn objectMapper.readTree(
                """{"actions":[{"key":"some-other-action"}]}""",
            ) as com.fasterxml.jackson.databind.node.ObjectNode
        }
        whenever(configurationService.get(staleConfigurationId)).thenReturn(staleConfiguration)
        whenever(definitionService.get(staleDefinitionId)).thenReturn(staleDefinition)

        val processLink = buildingBlockProcessLink(pluginId = "case-summary", version = "0.2.0")
        val execution = executionFor(processLink)

        whenever(resolver.resolve(execution, "external-plugin:case-summary@0.2.0")).thenReturn(staleConfigurationId)

        assertThatThrownBy { listenerWithResolver.notify(OperatonExecutionEvent(execution, "start")) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("case-summary")
            .hasMessageContaining("does not declare")
    }

    @Test
    fun `BUILDING_BLOCK reference without a resolver bean throws a clear error`() {
        // listener from setUp() was constructed with a null resolver (the default)
        val processLink = buildingBlockProcessLink(pluginId = "case-summary", version = "0.1.0")
        val execution = executionFor(processLink)

        assertThatThrownBy { listener.notify(OperatonExecutionEvent(execution, "start")) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("resolver")
    }

    @Test
    fun `BUILDING_BLOCK reference with no mapping throws a clear error`() {
        val resolver = mock<BuildingBlockPluginConfigurationResolver>()
        val listenerWithResolver = ExternalPluginServiceTaskStartListener(
            processLinkRepository,
            configurationService,
            definitionService,
            hostService,
            hostClient,
            valueResolverService,
            objectMapper,
            pluginActionResultHandler,
            resolver,
        )

        val processLink = buildingBlockProcessLink(pluginId = "case-summary", version = "0.1.0")
        val execution = executionFor(processLink)

        whenever(resolver.resolve(execution, "external-plugin:case-summary@0.1.0")).thenReturn(null)

        assertThatThrownBy { listenerWithResolver.notify(OperatonExecutionEvent(execution, "start")) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("external-plugin:case-summary@0.1.0")
    }

    private fun buildingBlockProcessLink(pluginId: String, version: String): ExternalPluginProcessLink =
        ExternalPluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "process-def-id",
            activityId = "ServiceTask_ExternalPlugin",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = null,
            actionKey = "case-summary",
            pluginConfigurationReference = PluginConfigurationReference(
                type = PluginConfigurationReferenceType.BUILDING_BLOCK,
                pluginDefinitionKey = pluginId,
                pluginDefinitionVersion = version,
            ),
            actionProperties = null,
        )

    private fun executionFor(processLink: ExternalPluginProcessLink): DelegateExecution {
        whenever(
            processLinkRepository.findByProcessDefinitionIdAndActivityIdAndActivityType(
                "process-def-id",
                "ServiceTask_ExternalPlugin",
                ActivityTypeWithEventName.SERVICE_TASK_START,
            ),
        ).thenReturn(listOf(processLink))

        return mock<DelegateExecution> {
            on { processDefinitionId } doReturn "process-def-id"
            on { currentActivityId } doReturn "ServiceTask_ExternalPlugin"
            on { processInstanceId } doReturn "process-instance-id"
            on { processBusinessKey } doReturn "business-key"
        }
    }

    private fun globalProcessServiceTaskEvent(): OperatonExecutionEvent {
        val processLink = ExternalPluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "process-def-id",
            activityId = "ServiceTask_ExternalPlugin",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = configurationId,
            actionKey = "case-summary",
            pluginConfigurationReference = PluginConfigurationReference(
                type = PluginConfigurationReferenceType.FIXED,
                pluginDefinitionKey = "case-summary",
                pluginDefinitionVersion = "0.1.0",
            ),
            actionProperties = null,
        )
        whenever(
            processLinkRepository.findByProcessDefinitionIdAndActivityIdAndActivityType(
                "process-def-id",
                "ServiceTask_ExternalPlugin",
                ActivityTypeWithEventName.SERVICE_TASK_START,
            ),
        ).thenReturn(listOf(processLink))

        val execution = mock<DelegateExecution> {
            on { processDefinitionId } doReturn "process-def-id"
            on { currentActivityId } doReturn "ServiceTask_ExternalPlugin"
            on { processInstanceId } doReturn "process-instance-id"
            on { processBusinessKey } doReturn null // global process: no case / document
        }
        return OperatonExecutionEvent(execution, "start")
    }
}
