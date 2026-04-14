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

package com.ritense.buildingblock.processlink.service

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockSyncTiming
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX
import com.ritense.valtimo.event.OperatonExecutionEvent
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import java.time.LocalDateTime
import java.util.UUID

class BuildingBlockCallActivityListenerTest {

    private val processLinkService = mock<ProcessLinkService>()
    private val buildingBlockInstanceService = mock<BuildingBlockInstanceService>()
    private val valueResolverService = mock<ValueResolverService>()
    private val objectMapper = MapperSingleton.get()
    private val operatonRepositoryService = mock<OperatonRepositoryService>()

    private val listener = BuildingBlockCallActivityListener(
        processLinkService,
        buildingBlockInstanceService,
        valueResolverService,
        objectMapper,
        operatonRepositoryService,
    )

    @Test
    fun `should create instance when process link is available from case process`() {
        val caseDocumentId = UUID.randomUUID()
        val buildingBlockInstance: BuildingBlockInstance = mock()
        val execution = mock<DelegateExecution> {
            on { currentActivityId } doReturn "callActivity"
            on { processDefinitionId } doReturn "case-process"
            on { processInstanceId } doReturn "case-process-instance"
            on { businessKey } doReturn caseDocumentId.toString()
            on { processBusinessKey } doReturn caseDocumentId.toString()
            on { this.eventName } doReturn "start"
        }
        val inputMappings = listOf(
            BuildingBlockInputMapping(
                source = "doc:/person/name",
                target = "name"
            )
        )
        val link = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "case-process",
            activityId = "callActivity",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = BuildingBlockDefinitionId.of("bb", "1.0.0"),
            pluginConfigurationMappings = emptyMap(),
            inputMappings = inputMappings
        )
        whenever(processLinkService.getProcessLinks("case-process", "callActivity")).thenReturn(listOf(link))
        whenever(valueResolverService.resolveValues(eq(caseDocumentId.toString()), eq(inputMappings.map { it.source })))
            .thenReturn(mapOf("doc:/person/name" to "Ada Lovelace"))

        whenever(buildingBlockInstance.documentId).thenReturn(UUID.randomUUID())

        whenever(buildingBlockInstanceService.getByDocumentId(caseDocumentId)).thenReturn(null)

        val processDefinition = mock<OperatonProcessDefinition> {
            on { versionTag } doReturn "${OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX}my-case:1.0.0"
        }
        whenever(operatonRepositoryService.findProcessDefinitionById("case-process")).thenReturn(processDefinition)

        val requestCaptor = argumentCaptor<NewDocumentRequest>()
        whenever(
            buildingBlockInstanceService.create(
                requestCaptor.capture(),
                eq(caseDocumentId),
                eq("callActivity"),
                isNull(),
                isNull(),
                eq("case-process")
            )
        )
        .thenReturn(buildingBlockInstance)

        listener.onCallActivityStart(OperatonExecutionEvent(execution))

        val capturedContent = requestCaptor.firstValue.content()
        assertThat(capturedContent.get("name").asText()).isEqualTo("Ada Lovelace")
    }

    @Test
    fun `should create nested instance when called from building block process`() {
        val caseDocumentId = UUID.randomUUID()
        val parentBBDocumentId = UUID.randomUUID()
        val parentBBInstanceId = UUID.randomUUID()
        val newBBDocumentId = UUID.randomUUID()

        val parentBBDefinition = BuildingBlockDefinition(
            BuildingBlockDefinitionId.of("parent-bb", "1.0.0"),
            "Parent BB",
            "desc",
            "tester",
            LocalDateTime.now(),
            null,
            false
        )
        val parentBBInstance = BuildingBlockInstance(
            id = parentBBInstanceId,
            documentId = parentBBDocumentId,
            caseDocumentId = caseDocumentId,
            activityId = "parentCallActivity",
            definition = parentBBDefinition
        )

        val newBBInstance: BuildingBlockInstance = mock {
            on { documentId } doReturn newBBDocumentId
        }

        // Execution is in the parent BB process calling a new BB
        val execution = mock<DelegateExecution> {
            on { currentActivityId } doReturn "nestedCallActivity"
            on { processDefinitionId } doReturn "parent-bb-process"
            on { processInstanceId } doReturn "parent-bb-process-instance"
            on { businessKey } doReturn parentBBDocumentId.toString()
            on { processBusinessKey } doReturn parentBBDocumentId.toString()
            on { this.eventName } doReturn "start"
        }

        val inputMappings = listOf(
            BuildingBlockInputMapping(
                source = "doc:/data",
                target = "input"
            )
        )
        val link = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "parent-bb-process",
            activityId = "nestedCallActivity",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = BuildingBlockDefinitionId.of("nested-bb", "1.0.0"),
            pluginConfigurationMappings = emptyMap(),
            inputMappings = inputMappings
        )
        whenever(processLinkService.getProcessLinks("parent-bb-process", "nestedCallActivity")).thenReturn(listOf(link))
        whenever(valueResolverService.resolveValues(eq(parentBBDocumentId.toString()), eq(inputMappings.map { it.source })))
            .thenReturn(mapOf("doc:/data" to "parent data"))

        // Parent BB instance is found because we're calling from a BB process
        whenever(buildingBlockInstanceService.getByDocumentId(parentBBDocumentId)).thenReturn(parentBBInstance)

        val requestCaptor = argumentCaptor<NewDocumentRequest>()
        whenever(
            buildingBlockInstanceService.create(
                requestCaptor.capture(),
                eq(caseDocumentId),  // Root case document ID from parent chain
                eq("nestedCallActivity"),
                eq(parentBBInstanceId),  // Parent building block instance ID
                isNull(),
                eq("parent-bb-process")
            )
        )
        .thenReturn(newBBInstance)

        listener.onCallActivityStart(OperatonExecutionEvent(execution))

        val capturedContent = requestCaptor.firstValue.content()
        assertThat(capturedContent.get("input").asText()).isEqualTo("parent data")
    }

    @Test
    fun `should not create instance when no building block link is found`() {
        val execution = mock<DelegateExecution> {
            on { currentActivityId } doReturn "callActivity"
            on { processDefinitionId } doReturn "case-process"
            on { businessKey } doReturn UUID.randomUUID().toString()
            on { this.eventName } doReturn "start"
        }
        whenever(processLinkService.getProcessLinks("case-process", "callActivity")).thenReturn(emptyList())

        listener.onCallActivityStart(OperatonExecutionEvent(execution))

        verify(buildingBlockInstanceService, never()).create(any(), any(), any(), any(), any(), any())
    }

    @Test
    fun `should write end sync output mappings to case document`() {
        val buildingBlockDocumentId = UUID.randomUUID()
        val caseDocumentId = UUID.randomUUID()
        val activityId = "callActivity"
        val testProcessDefinitionId = "case-process"
        val execution = mock<DelegateExecution> {
            on { businessKey } doReturn caseDocumentId.toString()
            on { processDefinitionId } doReturn testProcessDefinitionId
            on { getVariableLocal("buildingBlockDocumentId") } doReturn buildingBlockDocumentId.toString()
            on { this.eventName } doReturn "start"
        }

        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("bb", "1.0.0")
        val definition = BuildingBlockDefinition(
            buildingBlockDefinitionId,
            "Test block",
            "desc",
            "tester",
            LocalDateTime.now(),
            null,
            false
        )
        whenever(buildingBlockInstanceService.getByDocumentId(buildingBlockDocumentId)).thenReturn(
            BuildingBlockInstance(
                documentId = buildingBlockDocumentId,
                caseDocumentId = caseDocumentId,
                activityId = activityId,
                definition = definition
            )
        )

        val outputMappings = listOf(
            BuildingBlockOutputMapping(
                source = "result",
                target = "doc:/result",
                syncTiming = BuildingBlockSyncTiming.END
            ),
            BuildingBlockOutputMapping(
                source = "ignored",
                target = "doc:/ignored",
                syncTiming = BuildingBlockSyncTiming.CONTINUOUS
            )
        )
        val processLink = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = testProcessDefinitionId,
            activityId = activityId,
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_END,
            buildingBlockDefinitionId = buildingBlockDefinitionId,
            pluginConfigurationMappings = emptyMap(),
            inputMappings = emptyList(),
            outputMappings = outputMappings
        )
        whenever(processLinkService.getProcessLinks(testProcessDefinitionId, activityId)).thenReturn(listOf(processLink))
        whenever(
            valueResolverService.resolveValues(
                buildingBlockDocumentId.toString(),
                listOf("doc:/result")
            )
        ).thenReturn(mapOf("doc:/result" to "value"))

        listener.onCallActivityEnd(OperatonExecutionEvent(execution))

        verify(valueResolverService).handleValues(caseDocumentId, mapOf("doc:/result" to "value"))
    }
}
