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

package com.ritense.valtimo.exporter

import com.ritense.exporter.request.GlobalDecisionDefinitionExportRequest
import com.ritense.exporter.request.GlobalProcessDefinitionExportRequest
import com.ritense.valtimo.operaton.domain.OperatonDecisionDefinition
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.springframework.data.jpa.domain.Specification
import java.io.ByteArrayInputStream

@ExtendWith(MockitoExtension::class)
class GlobalProcessDefinitionExporterTest {

    @Mock
    lateinit var operatonRepositoryService: OperatonRepositoryService

    @Mock
    lateinit var repositoryService: RepositoryService

    private lateinit var exporter: GlobalProcessDefinitionExporter

    @BeforeEach
    fun before() {
        exporter = GlobalProcessDefinitionExporter(operatonRepositoryService, repositoryService)
    }

    @Test
    fun `should export the bpmn into the global folder structure`() {
        mockRootProcess(bpmn())

        val result = exporter.export(GlobalProcessDefinitionExportRequest(ROOT_ID))

        assertThat(result.exportFiles.single().path).isEqualTo("config/global/bpmn/$ROOT_KEY.bpmn")
    }

    @Test
    fun `should walk a call activity and a business rule task into related requests`() {
        mockRootProcess(bpmn(callActivityCalling = "sub-process", decisionRef = "my-decision"))
        val subDefinition = mock<OperatonProcessDefinition>()
        whenever(subDefinition.id).thenReturn("sub-id")
        val decisionDefinition = mock<OperatonDecisionDefinition>()
        whenever(decisionDefinition.id).thenReturn("dec-id")
        whenever(operatonRepositoryService.findProcessDefinition(any<Specification<OperatonProcessDefinition>>()))
            .thenReturn(subDefinition)
        whenever(operatonRepositoryService.findDecisionDefinition(any<Specification<OperatonDecisionDefinition>>()))
            .thenReturn(decisionDefinition)

        val result = exporter.export(GlobalProcessDefinitionExportRequest(ROOT_ID))

        assertThat(result.relatedRequests).containsExactlyInAnyOrder(
            GlobalProcessDefinitionExportRequest("sub-id"),
            GlobalDecisionDefinitionExportRequest("dec-id"),
        )
    }

    @Test
    fun `should skip a building-block-tagged call activity`() {
        mockRootProcess(bpmn(callActivityCalling = "bb-process", callActivityVersionTag = "BB:some-block"))

        val result = exporter.export(GlobalProcessDefinitionExportRequest(ROOT_ID))

        assertThat(result.relatedRequests).isEmpty()
    }

    @Test
    fun `should not emit a request for a deployment-bound call activity`() {
        mockRootProcess(bpmn(callActivityCalling = "sub-process", callActivityBinding = "deployment"))

        val result = exporter.export(GlobalProcessDefinitionExportRequest(ROOT_ID))

        assertThat(result.relatedRequests).isEmpty()
    }

    @Test
    fun `should skip an expression based called element and decision reference`() {
        mockRootProcess(bpmn(callActivityCalling = "\${processKey}", decisionRef = "\${decisionKey}"))

        val result = exporter.export(GlobalProcessDefinitionExportRequest(ROOT_ID))

        assertThat(result.relatedRequests).isEmpty()
    }

    @Test
    fun `should fail when a referenced process definition is not deployed`() {
        mockRootProcess(bpmn(callActivityCalling = "sub-process"))

        assertThatThrownBy { exporter.export(GlobalProcessDefinitionExportRequest(ROOT_ID)) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("sub-process")
    }

    @Test
    fun `should fail when a referenced decision definition is not deployed`() {
        mockRootProcess(bpmn(decisionRef = "my-decision"))

        assertThatThrownBy { exporter.export(GlobalProcessDefinitionExportRequest(ROOT_ID)) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("my-decision")
    }

    @Test
    fun `should support the global process definition export request`() {
        assertThat(exporter.supports()).isEqualTo(GlobalProcessDefinitionExportRequest::class.java)
    }

    private fun mockRootProcess(bpmn: String) {
        val processDefinition = mock<OperatonProcessDefinition>()
        whenever(processDefinition.id).thenReturn(ROOT_ID)
        // The key is only read once the walk succeeds and the export file is written, so it is
        // lenient: the "fail when a reference is not deployed" tests throw before reaching it.
        Mockito.lenient().`when`(processDefinition.key).thenReturn(ROOT_KEY)
        whenever(operatonRepositoryService.findProcessDefinitionById(ROOT_ID)).thenReturn(processDefinition)
        whenever(repositoryService.getProcessModel(ROOT_ID)).thenReturn(ByteArrayInputStream(bpmn.toByteArray()))
    }

    private fun bpmn(
        callActivityCalling: String? = null,
        callActivityBinding: String? = null,
        callActivityVersionTag: String? = null,
        decisionRef: String? = null,
    ): String {
        val callActivity = callActivityCalling?.let {
            val binding = callActivityBinding?.let { b -> """ camunda:calledElementBinding="$b"""" } ?: ""
            val versionTag = callActivityVersionTag?.let { v -> """ camunda:calledElementVersionTag="$v"""" } ?: ""
            """<bpmn:callActivity id="CallActivity_1" calledElement="$it"$binding$versionTag />"""
        } ?: ""
        val businessRuleTask = decisionRef?.let {
            """<bpmn:businessRuleTask id="BusinessRuleTask_1" camunda:decisionRef="$it" />"""
        } ?: ""

        return """
            <?xml version="1.0" encoding="UTF-8"?>
            <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                              xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                              id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
              <bpmn:process id="$ROOT_KEY" isExecutable="true">
                <bpmn:startEvent id="StartEvent_1" />
                $callActivity
                $businessRuleTask
              </bpmn:process>
            </bpmn:definitions>
        """.trimIndent()
    }

    private companion object {
        const val ROOT_ID = "root-id"
        const val ROOT_KEY = "my-process"
    }
}
