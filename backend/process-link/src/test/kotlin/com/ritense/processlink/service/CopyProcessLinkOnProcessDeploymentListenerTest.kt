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

package com.ritense.processlink.service

import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.domain.TestProcessLink
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.event.ProcessDefinitionDeployedEvent
import com.ritense.valtimo.operaton.domain.OperatonDeploymentSource
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.service.OperatonProcessService.DETACHED_PROCESS_DEFINITION_PREFIX
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.model.bpmn.Bpmn
import org.springframework.context.ApplicationEventPublisher
import java.util.UUID
import kotlin.test.assertEquals

class CopyProcessLinkOnProcessDeploymentListenerTest {

    private lateinit var processLinkRepository: ProcessLinkRepository
    private lateinit var operatonRepositoryService: OperatonRepositoryService
    private lateinit var applicationEventPublisher: ApplicationEventPublisher
    private lateinit var listener: CopyProcessLinkOnProcessDeploymentListener

    @BeforeEach
    fun beforeEach() {
        processLinkRepository = mock()
        operatonRepositoryService = mock()
        applicationEventPublisher = mock()
        listener = CopyProcessLinkOnProcessDeploymentListener(
            processLinkRepository,
            operatonRepositoryService,
            applicationEventPublisher
        )
    }

    @Test
    fun `should copy process links when the previous version belongs to the same case definition`() {
        val event = deploymentEvent(
            versionTag = "CD:autodeploy:1.0.1",
            previousVersionTag = "CD:autodeploy:1.0.0"
        )

        listener.copyProcessLinks(event)

        assertEquals(1, savedLinks().size)
        assertEquals(NEW_PROCESS_DEFINITION_ID, savedLinks().single().processDefinitionId)
    }

    @Test
    fun `should copy process links when the previous version belongs to the same building block definition`() {
        val event = deploymentEvent(
            versionTag = "BB:bijstand-uitvoeren:1.0.1",
            previousVersionTag = "BB:bijstand-uitvoeren:1.0.0"
        )

        listener.copyProcessLinks(event)

        assertEquals(1, savedLinks().size)
    }

    @Test
    fun `should copy process links when the previous version was detached by the same case definition`() {
        val event = deploymentEvent(
            versionTag = "CD:autodeploy:1.0.0",
            previousVersionTag = DETACHED_PROCESS_DEFINITION_PREFIX + "CD:autodeploy:1.0.0"
        )

        listener.copyProcessLinks(event)

        assertEquals(1, savedLinks().size)
    }

    @Test
    fun `should copy process links when neither version belongs to a blueprint`() {
        val event = deploymentEvent(versionTag = null, previousVersionTag = null)

        listener.copyProcessLinks(event)

        assertEquals(1, savedLinks().size)
    }

    @Test
    fun `should NOT copy process links from a building block definition to a case definition`() {
        val event = deploymentEvent(
            versionTag = "CD:bijstand:1.0.0",
            previousVersionTag = "BB:bijstand-uitvoeren:1.0.0"
        )

        listener.copyProcessLinks(event)

        assertNothingCopied()
    }

    @Test
    fun `should NOT copy process links from a case definition to a building block definition`() {
        val event = deploymentEvent(
            versionTag = "BB:bijstand-uitvoeren:1.0.0",
            previousVersionTag = "CD:bijstand:1.0.0"
        )

        listener.copyProcessLinks(event)

        assertNothingCopied()
    }

    @Test
    fun `should NOT copy process links from another case definition`() {
        val event = deploymentEvent(
            versionTag = "CD:bijstand:1.0.0",
            previousVersionTag = "CD:woninginspectie:1.0.0"
        )

        listener.copyProcessLinks(event)

        assertNothingCopied()
    }

    @Test
    fun `should NOT copy process links from a process without a blueprint to a case definition`() {
        val event = deploymentEvent(
            versionTag = "CD:bijstand:1.0.0",
            previousVersionTag = null
        )

        listener.copyProcessLinks(event)

        assertNothingCopied()
    }

    /**
     * The asymmetry: a blueprint's links may follow onto a deployment nothing owns, because several
     * lookups resolve a process by key alone — `byKeyOfUnlinkedProcess` for a start form, key plus latest
     * version for a user task. Refusing this left those pointing at a link-less deployment, which is what
     * broke `FormViewModelResourceIntTest`. Copying *into* a blueprint from elsewhere stays refused.
     */
    @Test
    fun `should copy process links from a case definition to a process without a blueprint`() {
        val event = deploymentEvent(
            versionTag = null,
            previousVersionTag = "CD:bijstand:1.0.0"
        )

        listener.copyProcessLinks(event)

        assertEquals(1, savedLinks().size)
    }

    @Test
    fun `should copy process links from a building block definition to a process without a blueprint`() {
        val event = deploymentEvent(
            versionTag = null,
            previousVersionTag = "BB:bijstand-uitvoeren:1.0.0"
        )

        listener.copyProcessLinks(event)

        assertEquals(1, savedLinks().size)
    }

    @Test
    fun `should copy process links from the original process definition regardless of its blueprint`() {
        // the deployment explicitly names the definition to copy from, as duplicating a case definition or
        // building block definition version does: that is not a guess made on the process definition key
        val event = deploymentEvent(
            versionTag = "CD:bijstand:1.0.1",
            previousVersionTag = "BB:bijstand-uitvoeren:1.0.0",
            source = OperatonDeploymentSource(false, "CD:bijstand:1.0.0", ORIGINAL_PROCESS_DEFINITION_ID)
        )

        listener.copyProcessLinks(event)

        assertEquals(1, savedLinks().size)
        verify(operatonRepositoryService, never()).findProcessDefinitionById(any())
    }

    @Test
    fun `should not copy process links when the deployment skips copying`() {
        val event = deploymentEvent(
            versionTag = "CD:autodeploy:1.0.1",
            previousVersionTag = "CD:autodeploy:1.0.0",
            source = OperatonDeploymentSource(true)
        )

        listener.copyProcessLinks(event)

        assertNothingCopied()
    }

    @Test
    fun `should not copy process links when there is no previous process definition`() {
        val event = deploymentEvent(versionTag = "CD:autodeploy:1.0.0", previousVersionTag = null)
        whenever(event.previousProcessDefinitionId).thenReturn(null)

        listener.copyProcessLinks(event)

        assertNothingCopied()
    }

    private fun assertNothingCopied() {
        verify(processLinkRepository, never()).saveAll(any<List<ProcessLink>>())
        verify(applicationEventPublisher, never()).publishEvent(any<Any>())
    }

    private fun savedLinks(): List<ProcessLink> {
        val captor = argumentCaptor<List<ProcessLink>>()
        verify(processLinkRepository).saveAll(captor.capture())
        return captor.firstValue
    }

    /**
     * A deployment of [PROCESS_DEFINITION_KEY] under [versionTag], of which the previous version - the one
     * Operaton reports for the process definition key - carries [previousVersionTag] and holds a single
     * process link on [ACTIVITY_ID].
     */
    private fun deploymentEvent(
        versionTag: String?,
        previousVersionTag: String?,
        source: OperatonDeploymentSource = OperatonDeploymentSource()
    ): ProcessDefinitionDeployedEvent {
        val previousProcessDefinition: OperatonProcessDefinition = mock()
        whenever(previousProcessDefinition.versionTag).thenReturn(previousVersionTag)
        whenever(operatonRepositoryService.findProcessDefinitionById(PREVIOUS_PROCESS_DEFINITION_ID))
            .thenReturn(previousProcessDefinition)

        val existingLink = TestProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = PREVIOUS_PROCESS_DEFINITION_ID,
            activityId = ACTIVITY_ID,
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
        )
        whenever(processLinkRepository.findByProcessDefinitionId(PREVIOUS_PROCESS_DEFINITION_ID))
            .thenReturn(listOf(existingLink))
        whenever(processLinkRepository.findByProcessDefinitionId(ORIGINAL_PROCESS_DEFINITION_ID))
            .thenReturn(listOf(existingLink.copy(processDefinitionId = ORIGINAL_PROCESS_DEFINITION_ID)))
        whenever(processLinkRepository.findByProcessDefinitionIdAndActivityId(NEW_PROCESS_DEFINITION_ID, ACTIVITY_ID))
            .thenReturn(emptyList())

        val event: ProcessDefinitionDeployedEvent = mock()
        whenever(event.source).thenReturn(source)
        whenever(event.versionTag).thenReturn(versionTag)
        whenever(event.previousProcessDefinitionId).thenReturn(PREVIOUS_PROCESS_DEFINITION_ID)
        whenever(event.processDefinitionId).thenReturn(NEW_PROCESS_DEFINITION_ID)
        whenever(event.processDefinitionKey).thenReturn(PROCESS_DEFINITION_KEY)
        whenever(event.processDefinitionModelInstance).thenReturn(
            Bpmn.readModelFromStream(
                this::class.java.getResourceAsStream("/config/case/autodeploy/1-0-0/bpmn/service-task-process.bpmn")
            )
        )
        return event
    }

    companion object {
        private const val PROCESS_DEFINITION_KEY = "service-task-process"
        private const val ACTIVITY_ID = "my-service-task"
        private const val PREVIOUS_PROCESS_DEFINITION_ID = "service-task-process:1:previous"
        private const val NEW_PROCESS_DEFINITION_ID = "service-task-process:2:new"
        private const val ORIGINAL_PROCESS_DEFINITION_ID = "service-task-process:1:original"
    }
}
