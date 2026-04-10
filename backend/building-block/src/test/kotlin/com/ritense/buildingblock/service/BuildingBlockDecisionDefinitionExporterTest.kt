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

package com.ritense.buildingblock.service

import com.ritense.exporter.request.BuildingBlockDecisionDefinitionExportRequest
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.DecisionDefinition
import java.io.ByteArrayInputStream

@ExtendWith(MockitoExtension::class)
class BuildingBlockDecisionDefinitionExporterTest(
    @Mock private val repositoryService: RepositoryService,
) {

    private lateinit var exporter: BuildingBlockDecisionDefinitionExporter

    private val buildingBlockDefinitionId = BuildingBlockDefinitionId("my-bb", "1.2.3")

    @BeforeEach
    fun setUp() {
        exporter = BuildingBlockDecisionDefinitionExporter(repositoryService)
    }

    @Test
    fun `should support BuildingBlockDecisionDefinitionExportRequest`() {
        assertThat(exporter.supports()).isEqualTo(BuildingBlockDecisionDefinitionExportRequest::class.java)
    }

    @Test
    fun `should export decision definition as dmn file`() {
        val dmnContent = "<definitions>test</definitions>"
        val decisionDefinition = mock<DecisionDefinition> {
            on { id } doReturn "decision-def-id"
            on { key } doReturn "my-decision"
        }

        whenever(repositoryService.getDecisionDefinition("decision-def-id")).thenReturn(decisionDefinition)
        whenever(repositoryService.getDecisionModel("decision-def-id"))
            .thenReturn(ByteArrayInputStream(dmnContent.toByteArray()))

        val request = BuildingBlockDecisionDefinitionExportRequest("decision-def-id", buildingBlockDefinitionId)
        val result = exporter.export(request)

        assertThat(result.exportFiles).hasSize(1)
        val exportFile = result.exportFiles.first()
        assertThat(exportFile.path).isEqualTo("config/building-block/my-bb/1-2-3/dmn/my-decision.dmn")
        assertThat(String(exportFile.content)).isEqualTo(dmnContent)
    }
}