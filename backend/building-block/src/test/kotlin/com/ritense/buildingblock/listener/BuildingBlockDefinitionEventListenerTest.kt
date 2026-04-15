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

package com.ritense.buildingblock.listener

import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinitionArtwork
import com.ritense.buildingblock.repository.BuildingBlockDefinitionArtworkRepository
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.service.BuildingBlockDecisionService
import com.ritense.buildingblock.service.BuildingBlockDocumentDefinitionService
import com.ritense.buildingblock.service.BuildingBlockFormDefinitionService
import com.ritense.buildingblock.service.BuildingBlockFormFlowDefinitionService
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.event.BuildingBlockDefinitionCreatedEvent
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.service.OperatonProcessService
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.repository.DecisionDefinition
import org.operaton.bpm.engine.repository.DeploymentWithDefinitions
import org.operaton.bpm.engine.repository.ProcessDefinition
import org.operaton.bpm.model.bpmn.Bpmn
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class BuildingBlockDefinitionEventListenerTest {

    @Mock
    private lateinit var buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository

    @Mock
    private lateinit var jsonSchemaDocumentDefinitionRepository: JsonSchemaDocumentDefinitionRepository

    @Mock
    private lateinit var processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository

    @Mock
    private lateinit var buildingBlockDefinitionArtworkRepository: BuildingBlockDefinitionArtworkRepository

    @Mock
    private lateinit var buildingBlockDocumentDefinitionService: BuildingBlockDocumentDefinitionService

    @Mock
    private lateinit var operatonProcessService: OperatonProcessService

    @Mock
    private lateinit var buildingBlockDecisionService: BuildingBlockDecisionService

    @Mock
    private lateinit var buildingBlockFormDefinitionService: BuildingBlockFormDefinitionService

    @Mock
    private lateinit var buildingBlockFormFlowDefinitionService: BuildingBlockFormFlowDefinitionService

    @Mock
    private lateinit var processLinkRepository: ProcessLinkRepository

    @InjectMocks
    private lateinit var listener: BuildingBlockDefinitionEventListener

    private val key = "test"
    private val basedOnId = BuildingBlockDefinitionId(key, "1.0.0")
    private val newId = BuildingBlockDefinitionId(key, "2.0.0")

    @Test
    fun `copies resources when basedOn present`() {
        val basedOnDocId = JsonSchemaDocumentDefinitionId.forBuildingBlock(key, basedOnId)
        val documentDefinition = JsonSchemaDocumentDefinition(
            basedOnDocId,
            JsonSchema.fromString("""{"${'$'}id":"test.schema","type":"object"}""")
        )
        val basedOnDefinition = BuildingBlockDefinition(basedOnId, "name", "desc", null, null, null, true)
        val newDefinition = basedOnDefinition.copy(id = newId, final = false)
        val link = ProcessDefinitionBuildingBlockDefinition(
            ProcessDefinitionBuildingBlockDefinitionId(
                ProcessDefinitionId.of("pid"),
                basedOnId
            ),
            true
        )
        val artwork = BuildingBlockDefinitionArtwork(basedOnDefinition.id, basedOnDefinition, "image")
        val originalProcessDefinition = OperatonProcessDefinition(
            id = "pid",
            revision = 1,
            category = null,
            name = "Process",
            key = "process-key",
            version = 1,
            deploymentId = "dep-1",
            resourceName = "process.bpmn",
            diagramResourceName = null,
            hasStartFormKey = false,
            suspensionState = 1,
            tenantId = null,
            versionTag = "BB:test:1.0.0",
            historyTimeToLive = null,
            isStartableInTasklist = true
        )
        val newProcessDefinition = mock<ProcessDefinition> {
            on { id } doReturn "new-pid"
        }
        val deployment = mock<DeploymentWithDefinitions> {
            on { deployedProcessDefinitions } doReturn listOf(newProcessDefinition)
        }
        val bpmnModel = Bpmn.readModelFromStream(
            """
                <?xml version="1.0" encoding="UTF-8"?>
                <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                             xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL BPMN20.xsd"
                             targetNamespace="http://camunda.org/examples">
                    <process id="test-process-2" name="Test Process 2">
                        <startEvent id="start" />
                        <endEvent id="end" />
                    </process>
                </definitions>
            """.trimIndent().byteInputStream()
        )

        whenever(buildingBlockFormDefinitionService.copyFormDefinitions(basedOnId, newId)).thenReturn(emptyMap())
        whenever(jsonSchemaDocumentDefinitionRepository.findById(basedOnDocId)).thenReturn(Optional.of(documentDefinition))
        whenever(processDefinitionBuildingBlockDefinitionRepository.findAllByIdBuildingBlockDefinitionId(basedOnId))
            .thenReturn(listOf(link))
        whenever(buildingBlockDefinitionArtworkRepository.findById(basedOnId)).thenReturn(Optional.of(artwork))
        whenever(buildingBlockDefinitionRepository.findById(newId)).thenReturn(Optional.of(newDefinition))
        whenever(operatonProcessService.getProcessDefinitionById("pid")).thenReturn(originalProcessDefinition)
        whenever(operatonProcessService.getBpmnModelInstanceByProcessDefinitionId("pid")).thenReturn(bpmnModel)
        whenever(buildingBlockDecisionService.getDecisionDefinitions(basedOnId)).thenReturn(emptyList())
        whenever(
            operatonProcessService.deploy(
                eq(newId),
                any(),
                any(),
                any(),
                any(),
                any(),
                any()
            )
        ).thenReturn(deployment)

        val event = BuildingBlockDefinitionCreatedEvent(
            buildingBlockDefinitionId = newId,
            buildingBlockDefinitionName = "name",
            basedOnBuildingBlockDefinitionId = basedOnId,
            duplicate = true
        )

        listener.handleBuildingBlockDefinitionCreated(event)

        verify(jsonSchemaDocumentDefinitionRepository).save(any<JsonSchemaDocumentDefinition>())
        verify(operatonProcessService).deploy(
            eq(newId),
            any(),
            any(),
            any(),
            any(),
            any(),
            any()
        )
        verify(buildingBlockFormDefinitionService).copyFormDefinitions(basedOnId, newId)
        verify(buildingBlockFormFlowDefinitionService).copyFormFlowDefinitions(basedOnId, newId)
        verify(processDefinitionBuildingBlockDefinitionRepository).save(any<ProcessDefinitionBuildingBlockDefinition>())
        verify(buildingBlockDefinitionArtworkRepository).save(any<BuildingBlockDefinitionArtwork>())
        verify(buildingBlockDocumentDefinitionService, never()).ensureEmptyFor(any(), any())
        verify(buildingBlockDecisionService).getDecisionDefinitions(basedOnId)
    }

    @Test
    fun `copies decision definitions when basedOn present`() {
        val basedOnDocId = JsonSchemaDocumentDefinitionId.forBuildingBlock(key, basedOnId)
        whenever(jsonSchemaDocumentDefinitionRepository.findById(basedOnDocId)).thenReturn(Optional.empty())
        whenever(processDefinitionBuildingBlockDefinitionRepository.findAllByIdBuildingBlockDefinitionId(basedOnId))
            .thenReturn(emptyList())
        whenever(buildingBlockDefinitionArtworkRepository.findById(basedOnId)).thenReturn(Optional.empty())

        val dmnBytes = "<dmn-xml/>".toByteArray()
        val decisionDefinition = mock<DecisionDefinition> {
            on { resourceName } doReturn "my-decision.dmn"
        }
        whenever(buildingBlockDecisionService.getDecisionDefinitions(basedOnId))
            .thenReturn(listOf(decisionDefinition))
        whenever(buildingBlockDecisionService.getDmnModel(decisionDefinition)).thenReturn(dmnBytes)

        val dmnDeployment = mock<DeploymentWithDefinitions>()
        whenever(operatonProcessService.deploy(eq(newId), eq("my-decision.dmn"), any()))
            .thenReturn(dmnDeployment)

        val event = BuildingBlockDefinitionCreatedEvent(
            buildingBlockDefinitionId = newId,
            buildingBlockDefinitionName = "name",
            basedOnBuildingBlockDefinitionId = basedOnId,
            duplicate = true
        )

        listener.handleBuildingBlockDefinitionCreated(event)

        verify(buildingBlockDecisionService).getDecisionDefinitions(basedOnId)
        verify(buildingBlockDecisionService).getDmnModel(decisionDefinition)
        verify(operatonProcessService).deploy(eq(newId), eq("my-decision.dmn"), any())
    }
}
