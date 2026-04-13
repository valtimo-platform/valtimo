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

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.plugin.repository.PluginProcessLinkRepository
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinitionId
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processdocument.service.result.NewDocumentAndStartProcessResult
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.service.ProcessPropertyService
import java.time.LocalDateTime
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argThat
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.runtime.Execution
import org.operaton.bpm.engine.runtime.ExecutionQuery
import org.operaton.bpm.engine.runtime.MessageCorrelationBuilder
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.CatchEvent
import org.operaton.bpm.model.bpmn.instance.Message
import org.operaton.bpm.model.bpmn.instance.MessageEventDefinition

class NotificatiesApiNotificationProcessLinkListenerTest {

    lateinit var pluginProcessLinkRepository: PluginProcessLinkRepository
    lateinit var runtimeService: RuntimeService
    lateinit var repositoryService: RepositoryService
    lateinit var processPropertyService: ProcessPropertyService
    lateinit var processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService
    lateinit var processDocumentService: ProcessDocumentService
    lateinit var caseDefinitionService: CaseDefinitionService
    lateinit var listener: NotificatiesApiNotificationProcessLinkListener

    val objectMapper = ObjectMapper()

    @BeforeEach
    fun setup() {
        pluginProcessLinkRepository = mock()
        runtimeService = mock()
        repositoryService = mock()
        processPropertyService = mock()
        processDefinitionCaseDefinitionService = mock()
        processDocumentService = mock()
        caseDefinitionService = mock()

        listener = NotificatiesApiNotificationProcessLinkListener(
            pluginProcessLinkRepository,
            runtimeService,
            repositoryService,
            processPropertyService,
            processDefinitionCaseDefinitionService,
            processDocumentService,
            caseDefinitionService,
            objectMapper,
        )
    }

    @Test
    fun `should signal receive task when notification matches`() {
        val processLink = createProcessLink(
            activityType = ActivityTypeWithEventName.RECEIVE_TASK_END,
        )
        val execution: Execution = mock()
        whenever(execution.id).thenReturn("exec-1")
        whenever(execution.processInstanceId).thenReturn("pi-1")

        whenever(pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(any(), any()))
            .thenReturn(listOf(processLink))

        val executionQuery: ExecutionQuery = mock()
        whenever(runtimeService.createExecutionQuery()).thenReturn(executionQuery)
        whenever(executionQuery.processDefinitionId(any())).thenReturn(executionQuery)
        whenever(executionQuery.activityId(any())).thenReturn(executionQuery)
        whenever(executionQuery.list()).thenReturn(listOf(execution))

        val event = createEvent()
        listener.onNotificationReceived(event)

        verify(runtimeService).signal(eq("exec-1"), argThat<Map<String, Any>> {
            this["notificatieKanaal"] == "zaken" &&
                this["notificatieActie"] == "create" &&
                this["notificatieResourceUrl"] == "https://example.com/api/v1/zaken/123"
        })
    }

    @Test
    fun `should correlate message event when notification matches intermediate catch event`() {
        val processLink = createProcessLink(
            activityType = ActivityTypeWithEventName.INTERMEDIATE_CATCH_EVENT_END,
        )
        val execution: Execution = mock()
        whenever(execution.id).thenReturn("exec-1")
        whenever(execution.processInstanceId).thenReturn("pi-1")

        whenever(pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(any(), any()))
            .thenReturn(listOf(processLink))

        val executionQuery: ExecutionQuery = mock()
        whenever(runtimeService.createExecutionQuery()).thenReturn(executionQuery)
        whenever(executionQuery.processDefinitionId(any())).thenReturn(executionQuery)
        whenever(executionQuery.activityId(any())).thenReturn(executionQuery)
        whenever(executionQuery.list()).thenReturn(listOf(execution))

        mockBpmnModel("test-message")

        val event = createEvent()
        listener.onNotificationReceived(event)

        verify(runtimeService).messageEventReceived(eq("test-message"), eq("exec-1"), argThat<Map<String, Any>> {
            this["notificatieKanaal"] == "zaken"
        })
    }

    @Test
    fun `should start system process by message when notification matches message start event`() {
        val processLink = createProcessLink(
            activityType = ActivityTypeWithEventName.MESSAGE_START_EVENT_START,
        )

        whenever(pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(any(), any()))
            .thenReturn(listOf(processLink))
        whenever(processPropertyService.isSystemProcessById("proc-def-1")).thenReturn(true)

        mockBpmnModel("start-message")
        val correlationBuilder: MessageCorrelationBuilder = mock()
        whenever(runtimeService.createMessageCorrelation("start-message")).thenReturn(correlationBuilder)
        whenever(correlationBuilder.processDefinitionId(any())).thenReturn(correlationBuilder)
        whenever(correlationBuilder.setVariables(any())).thenReturn(correlationBuilder)

        val event = createEvent()
        listener.onNotificationReceived(event)

        verify(correlationBuilder).processDefinitionId("proc-def-1")
        verify(correlationBuilder).setVariables(argThat<Map<String, Any>> {
            this["notificatieKanaal"] == "zaken"
        })
        verify(correlationBuilder).correlateStartMessage()
    }

    @Test
    fun `should start document process when notification matches message start event for case process`() {
        val processLink = createProcessLink(
            activityType = ActivityTypeWithEventName.MESSAGE_START_EVENT_START,
        )

        whenever(pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(any(), any()))
            .thenReturn(listOf(processLink))
        whenever(processPropertyService.isSystemProcessById("proc-def-1")).thenReturn(false)

        val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")
        val processDefinitionCaseDefinition = ProcessDefinitionCaseDefinition(
            id = ProcessDefinitionCaseDefinitionId(
                ProcessDefinitionId("proc-def-1"),
                caseDefinitionId
            ),
            canInitializeDocument = true,
        )
        processDefinitionCaseDefinition.processDefinitionKey = "my-process"

        whenever(processDefinitionCaseDefinitionService.findByProcessDefinitionIdOrNull(ProcessDefinitionId("proc-def-1")))
            .thenReturn(processDefinitionCaseDefinition)

        val activeCaseDefinition: CaseDefinition = mock()
        whenever(activeCaseDefinition.id).thenReturn(caseDefinitionId)
        whenever(caseDefinitionService.getActiveCaseDefinition("my-case")).thenReturn(activeCaseDefinition)

        val result: NewDocumentAndStartProcessResult = mock()
        whenever(result.errors()).thenReturn(emptyList())
        whenever(processDocumentService.newDocumentAndStartProcess(any())).thenReturn(result)

        val event = createEvent()
        listener.onNotificationReceived(event)

        verify(processDocumentService).newDocumentAndStartProcess(argThat {
            processDefinitionKey() == "my-process" &&
                newDocumentRequest().caseDefinitionVersionTag() == "1.0.0"
        })
    }

    @Test
    fun `should not signal when no matching process links exist`() {
        whenever(pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(any(), any()))
            .thenReturn(emptyList())

        val event = createEvent()
        listener.onNotificationReceived(event)

        verify(runtimeService, never()).signal(any(), any<Map<String, Any>>())
        verify(runtimeService, never()).messageEventReceived(any(), any(), any())
        verify(runtimeService, never()).createMessageCorrelation(any())
    }

    @Test
    fun `should filter by kanaal`() {
        val properties = objectMapper.createObjectNode().put("kanaal", "documenten")
        val processLink = createProcessLink(
            activityType = ActivityTypeWithEventName.RECEIVE_TASK_END,
            actionProperties = properties,
        )

        whenever(pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(any(), any()))
            .thenReturn(listOf(processLink))

        val event = createEvent(kanaal = "zaken")
        listener.onNotificationReceived(event)

        verifyNoInteractions(runtimeService)
    }

    @Test
    fun `should filter by actie`() {
        val properties = objectMapper.createObjectNode().put("actie", "destroy")
        val processLink = createProcessLink(
            activityType = ActivityTypeWithEventName.RECEIVE_TASK_END,
            actionProperties = properties,
        )

        whenever(pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(any(), any()))
            .thenReturn(listOf(processLink))

        val event = createEvent(actie = "create")
        listener.onNotificationReceived(event)

        verifyNoInteractions(runtimeService)
    }

    @Test
    fun `should filter by kenmerken`() {
        val kenmerken = objectMapper.createObjectNode().put("bronorganisatie", "123456789")
        val properties = objectMapper.createObjectNode()
        properties.set<ObjectNode>("kenmerken", kenmerken)
        val processLink = createProcessLink(
            activityType = ActivityTypeWithEventName.RECEIVE_TASK_END,
            actionProperties = properties,
        )

        whenever(pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(any(), any()))
            .thenReturn(listOf(processLink))

        val event = createEvent(kenmerken = mapOf("bronorganisatie" to "999999999"))
        listener.onNotificationReceived(event)

        verifyNoInteractions(runtimeService)
    }

    @Test
    fun `should match when filter kenmerken match event kenmerken`() {
        val kenmerken = objectMapper.createObjectNode().put("bronorganisatie", "123456789")
        val properties = objectMapper.createObjectNode()
        properties.set<ObjectNode>("kenmerken", kenmerken)
        val processLink = createProcessLink(
            activityType = ActivityTypeWithEventName.RECEIVE_TASK_END,
            actionProperties = properties,
        )
        val execution: Execution = mock()
        whenever(execution.id).thenReturn("exec-1")
        whenever(execution.processInstanceId).thenReturn("pi-1")

        whenever(pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(any(), any()))
            .thenReturn(listOf(processLink))

        val executionQuery: ExecutionQuery = mock()
        whenever(runtimeService.createExecutionQuery()).thenReturn(executionQuery)
        whenever(executionQuery.processDefinitionId(any())).thenReturn(executionQuery)
        whenever(executionQuery.activityId(any())).thenReturn(executionQuery)
        whenever(executionQuery.list()).thenReturn(listOf(execution))

        val event = createEvent(kenmerken = mapOf("bronorganisatie" to "123456789"))
        listener.onNotificationReceived(event)

        verify(runtimeService).signal(eq("exec-1"), any<Map<String, Any>>())
    }

    @Test
    fun `should pass all notification data as process variables`() {
        val processLink = createProcessLink(
            activityType = ActivityTypeWithEventName.RECEIVE_TASK_END,
        )
        val execution: Execution = mock()
        whenever(execution.id).thenReturn("exec-1")
        whenever(execution.processInstanceId).thenReturn("pi-1")

        whenever(pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(any(), any()))
            .thenReturn(listOf(processLink))

        val executionQuery: ExecutionQuery = mock()
        whenever(runtimeService.createExecutionQuery()).thenReturn(executionQuery)
        whenever(executionQuery.processDefinitionId(any())).thenReturn(executionQuery)
        whenever(executionQuery.activityId(any())).thenReturn(executionQuery)
        whenever(executionQuery.list()).thenReturn(listOf(execution))

        val aanmaakdatum = LocalDateTime.of(2026, 4, 6, 12, 0, 0)
        val event = createEvent(
            kanaal = "zaken",
            actie = "create",
            resourceUrl = "https://example.com/resource",
            hoofdObject = "https://example.com/hoofdObject",
            aanmaakdatum = aanmaakdatum,
            kenmerken = mapOf("key1" to "val1"),
        )
        listener.onNotificationReceived(event)

        verify(runtimeService).signal(eq("exec-1"), argThat<Map<String, Any>> {
            this["notificatieKanaal"] == "zaken" &&
                this["notificatieActie"] == "create" &&
                this["notificatieResourceUrl"] == "https://example.com/resource" &&
                this["notificatieHoofdObject"] == "https://example.com/hoofdObject" &&
                this["notificatieAanmaakdatum"] == aanmaakdatum.toString() &&
                this["notificatieKenmerken"] == mapOf("key1" to "val1")
        })
    }

    @Test
    fun `should not include null hoofdObject and aanmaakdatum in process variables`() {
        val processLink = createProcessLink(
            activityType = ActivityTypeWithEventName.RECEIVE_TASK_END,
        )
        val execution: Execution = mock()
        whenever(execution.id).thenReturn("exec-1")
        whenever(execution.processInstanceId).thenReturn("pi-1")

        whenever(pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(any(), any()))
            .thenReturn(listOf(processLink))

        val executionQuery: ExecutionQuery = mock()
        whenever(runtimeService.createExecutionQuery()).thenReturn(executionQuery)
        whenever(executionQuery.processDefinitionId(any())).thenReturn(executionQuery)
        whenever(executionQuery.activityId(any())).thenReturn(executionQuery)
        whenever(executionQuery.list()).thenReturn(listOf(execution))

        val event = createEvent(hoofdObject = null, aanmaakdatum = null)
        listener.onNotificationReceived(event)

        verify(runtimeService).signal(eq("exec-1"), argThat<Map<String, Any>> {
            !this.containsKey("notificatieHoofdObject") &&
                !this.containsKey("notificatieAanmaakdatum")
        })
    }

    @Test
    fun `should not signal when no waiting executions found`() {
        val processLink = createProcessLink(
            activityType = ActivityTypeWithEventName.RECEIVE_TASK_END,
        )

        whenever(pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(any(), any()))
            .thenReturn(listOf(processLink))

        val executionQuery: ExecutionQuery = mock()
        whenever(runtimeService.createExecutionQuery()).thenReturn(executionQuery)
        whenever(executionQuery.processDefinitionId(any())).thenReturn(executionQuery)
        whenever(executionQuery.activityId(any())).thenReturn(executionQuery)
        whenever(executionQuery.list()).thenReturn(emptyList())

        val event = createEvent()
        listener.onNotificationReceived(event)

        verify(runtimeService, never()).signal(any(), any<Map<String, Any>>())
    }

    @Test
    fun `should reject document process when canInitializeDocument is false`() {
        val processLink = createProcessLink(
            activityType = ActivityTypeWithEventName.MESSAGE_START_EVENT_START,
        )

        whenever(pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(any(), any()))
            .thenReturn(listOf(processLink))
        whenever(processPropertyService.isSystemProcessById("proc-def-1")).thenReturn(false)

        val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")
        val processDefinitionCaseDefinition = ProcessDefinitionCaseDefinition(
            id = ProcessDefinitionCaseDefinitionId(
                ProcessDefinitionId("proc-def-1"),
                caseDefinitionId
            ),
            canInitializeDocument = false,
        )
        whenever(processDefinitionCaseDefinitionService.findByProcessDefinitionIdOrNull(ProcessDefinitionId("proc-def-1")))
            .thenReturn(processDefinitionCaseDefinition)

        val activeCaseDefinition: CaseDefinition = mock()
        whenever(activeCaseDefinition.id).thenReturn(caseDefinitionId)
        whenever(caseDefinitionService.getActiveCaseDefinition("my-case")).thenReturn(activeCaseDefinition)

        val event = createEvent()

        org.junit.jupiter.api.assertThrows<IllegalArgumentException> {
            listener.onNotificationReceived(event)
        }
    }

    private fun createProcessLink(
        activityType: ActivityTypeWithEventName,
        actionProperties: ObjectNode? = null,
    ): PluginProcessLink {
        val processLink: PluginProcessLink = mock()
        whenever(processLink.processDefinitionId).thenReturn("proc-def-1")
        whenever(processLink.activityId).thenReturn("activity-1")
        whenever(processLink.activityType).thenReturn(activityType)
        whenever(processLink.actionProperties).thenReturn(actionProperties)
        return processLink
    }

    private fun createEvent(
        kanaal: String = "zaken",
        actie: String = "create",
        resourceUrl: String = "https://example.com/api/v1/zaken/123",
        hoofdObject: String? = "https://example.com/api/v1/zaken/123",
        resource: String? = "zaak",
        aanmaakdatum: LocalDateTime? = LocalDateTime.of(2026, 4, 6, 12, 0, 0),
        kenmerken: Map<String, String> = emptyMap(),
    ): NotificatiesApiNotificationReceivedEvent {
        return NotificatiesApiNotificationReceivedEvent(
            kanaal = kanaal,
            hoofdObject = hoofdObject,
            resourceUrl = resourceUrl,
            resource = resource,
            actie = actie,
            aanmaakdatum = aanmaakdatum,
            kenmerken = kenmerken,
        )
    }

    private fun mockBpmnModel(messageName: String) {
        val model: BpmnModelInstance = mock()
        val catchEvent: CatchEvent = mock()
        val messageEventDef: MessageEventDefinition = mock()
        val message: Message = mock()
        whenever(message.name).thenReturn(messageName)
        whenever(messageEventDef.message).thenReturn(message)
        whenever(catchEvent.eventDefinitions).thenReturn(listOf(messageEventDef))
        whenever(model.getModelElementById<CatchEvent>("activity-1")).thenReturn(catchEvent)
        whenever(repositoryService.getBpmnModelInstance("proc-def-1")).thenReturn(model)
    }
}
