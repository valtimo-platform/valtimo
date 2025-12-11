/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import java.time.LocalDateTime
import java.util.UUID

class BuildingBlockCallActivityListenerTest {

    private val processLinkService = mock<ProcessLinkService>()
    private val buidingBlockInstanceService = mock<BuildingBlockInstanceService>()
    private val valueResolverService = mock<ValueResolverService>()
    private val objectMapper = MapperSingleton.get()

    private val listener = BuildingBlockCallActivityListener(
        processLinkService,
        buidingBlockInstanceService,
        valueResolverService,
        objectMapper,
    )

    @Test
    fun `should create instance when process link is available`() {
        val caseDocumentId = UUID.randomUUID()
        val buildingBlockInstance: BuildingBlockInstance = mock()
        val execution = mock<DelegateExecution> {
            on { currentActivityId } doReturn "callActivity"
            on { processDefinitionId } doReturn "case-process"
            on { businessKey } doReturn caseDocumentId.toString()
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
        whenever(valueResolverService.resolveValues(caseDocumentId.toString(), inputMappings.map { it.source }))
            .thenReturn(mapOf("doc:/person/name" to "Ada Lovelace"))

        whenever(buildingBlockInstance.documentId).thenReturn(UUID.randomUUID())

        val requestCaptor = argumentCaptor<NewDocumentRequest>()
        whenever(
            buidingBlockInstanceService.create(
                requestCaptor.capture(),
                eq(caseDocumentId),
                eq("callActivity")
            )
        )
        .thenReturn(buildingBlockInstance)

        listener.onCallActivityStart(execution)

        val capturedContent = requestCaptor.firstValue.content()
        assertThat(capturedContent.get("name").asText()).isEqualTo("Ada Lovelace")
    }

    @Test
    fun `should not create instance when no building block link is found`() {
        val execution = mock<DelegateExecution> {
            on { currentActivityId } doReturn "callActivity"
            on { processDefinitionId } doReturn "case-process"
            on { businessKey } doReturn UUID.randomUUID().toString()
        }
        whenever(processLinkService.getProcessLinks("case-process", "callActivity")).thenReturn(emptyList())

        listener.onCallActivityStart(execution)

        verify(buidingBlockInstanceService, never()).create(any(), any(), any())
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
            on { getVariableLocal("buildingBlockInstanceId") } doReturn buildingBlockDocumentId.toString()
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
        whenever(buidingBlockInstanceService.getByDocumentId(buildingBlockDocumentId)).thenReturn(
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

        listener.onCallActivityEnd(execution)

        verify(valueResolverService).handleValues(caseDocumentId, mapOf("doc:/result" to "value"))
    }
}
