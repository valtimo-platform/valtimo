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

package com.ritense.buildingblock.service

import com.ritense.exporter.request.BuildingBlockProcessDefinitionExportRequest
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.Bpmn
import java.io.ByteArrayInputStream
import java.nio.charset.StandardCharsets

@ExtendWith(MockitoExtension::class)
class BuildingBlockProcessDefinitionExporterTest(
    @Mock private val operatonRepositoryService: OperatonRepositoryService,
    @Mock private val repositoryService: RepositoryService,
) {

    private lateinit var exporter: BuildingBlockProcessDefinitionExporter
    private val buildingBlockDefinitionId = BuildingBlockDefinitionId("bb-process", "1.0.0")

    private val processDefinition = OperatonProcessDefinition(
        id = "process-definition-id",
        revision = 1,
        category = null,
        name = "Main process",
        key = "process-key",
        version = 1,
        deploymentId = null,
        resourceName = null,
        diagramResourceName = null,
        hasStartFormKey = false,
        suspensionState = 1,
        tenantId = null,
        versionTag = "BB:bb-process:1.0.0",
        historyTimeToLive = null,
        isStartableInTasklist = true
    )

    private val subProcessDefinition = OperatonProcessDefinition(
        id = "sub-process-definition-id",
        revision = 1,
        category = null,
        name = "Sub process",
        key = "sub-process-key",
        version = 1,
        deploymentId = null,
        resourceName = null,
        diagramResourceName = null,
        hasStartFormKey = false,
        suspensionState = 1,
        tenantId = null,
        versionTag = null,
        historyTimeToLive = null,
        isStartableInTasklist = true
    )

    @BeforeEach
    fun setUp() {
        exporter = BuildingBlockProcessDefinitionExporter(operatonRepositoryService, repositoryService)
    }

    @Test
    fun `should export process definition without related call activities`() {
        val bpmnContent = """
            <?xml version="1.0" encoding="UTF-8"?>
            <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="Examples">
              <bpmn:process id="process-key" isExecutable="true">
                <bpmn:startEvent id="start"/>
                <bpmn:callActivity id="callSub" calledElement="sub-process-key"/>
                <bpmn:endEvent id="end"/>
                <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="callSub"/>
                <bpmn:sequenceFlow id="flow2" sourceRef="callSub" targetRef="end"/>
              </bpmn:process>
            </bpmn:definitions>
        """.trimIndent()

        whenever(operatonRepositoryService.findProcessDefinitionById(processDefinition.id)).thenReturn(processDefinition)
        whenever(operatonRepositoryService.findProcessDefinition(any())).thenReturn(subProcessDefinition)
        whenever(repositoryService.getProcessModel(processDefinition.id)).thenReturn(
            ByteArrayInputStream(bpmnContent.toByteArray(StandardCharsets.UTF_8))
        )

        val result = exporter.export(
            BuildingBlockProcessDefinitionExportRequest(
                processDefinitionId = processDefinition.id,
                buildingBlockDefinitionId = buildingBlockDefinitionId
            )
        )

        assertThat(result.exportFiles).hasSize(1)
        val exportFile = result.exportFiles.first()
        assertThat(exportFile.path).isEqualTo(
            "config/building-block/bb-process/1-0-0/bpmn/process-key.bpmn"
        )

        val exportedModel = Bpmn.readModelFromStream(ByteArrayInputStream(exportFile.content))
        val callActivities = exportedModel.getModelElementsByType(org.operaton.bpm.model.bpmn.instance.CallActivity::class.java)
        assertThat(callActivities).hasSize(1)
        assertThat(callActivities.first().calledElement).isEqualTo("sub-process-key")

        assertThat(result.relatedRequests).doesNotContain(
            BuildingBlockProcessDefinitionExportRequest(
                processDefinitionId = subProcessDefinition.id,
                buildingBlockDefinitionId = buildingBlockDefinitionId
            )
        )
    }
}
