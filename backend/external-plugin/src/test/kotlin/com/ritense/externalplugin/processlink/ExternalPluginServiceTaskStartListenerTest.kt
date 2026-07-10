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
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.event.OperatonExecutionEvent
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
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
        listener = ExternalPluginServiceTaskStartListener(
            processLinkRepository,
            configurationService,
            definitionService,
            hostService,
            hostClient,
            valueResolverService,
            objectMapper,
        )

        val configuration = mock<ExternalPluginConfiguration> {
            on { id } doReturn configurationId
            on { this.definitionId } doReturn definitionId
        }
        val definition = mock<ExternalPluginDefinition> {
            on { this.hostId } doReturn hostId
            on { pluginId } doReturn "case-summary"
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

    private fun globalProcessServiceTaskEvent(): OperatonExecutionEvent {
        val processLink = ExternalPluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "process-def-id",
            activityId = "ServiceTask_ExternalPlugin",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = configurationId,
            actionKey = "case-summary",
            pluginVersion = "0.1.0",
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
