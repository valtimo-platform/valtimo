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
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.DecisionDefinition
import java.io.ByteArrayInputStream

@ExtendWith(MockitoExtension::class)
class GlobalDecisionDefinitionExporterTest {

    @Mock
    lateinit var repositoryService: RepositoryService

    private lateinit var exporter: GlobalDecisionDefinitionExporter

    @BeforeEach
    fun before() {
        exporter = GlobalDecisionDefinitionExporter(repositoryService)
    }

    @Test
    fun `should export the dmn into the global folder structure`() {
        val decisionDefinition = mock<DecisionDefinition>()
        whenever(decisionDefinition.id).thenReturn(DECISION_ID)
        whenever(decisionDefinition.key).thenReturn("my-decision")
        whenever(repositoryService.getDecisionDefinition(DECISION_ID)).thenReturn(decisionDefinition)
        whenever(repositoryService.getDecisionModel(DECISION_ID))
            .thenReturn(ByteArrayInputStream(DMN.toByteArray()))

        val result = exporter.export(GlobalDecisionDefinitionExportRequest(DECISION_ID))

        val exportFile = result.exportFiles.single()
        assertThat(exportFile.path).isEqualTo("config/global/dmn/my-decision.dmn")
        assertThat(exportFile.content.toString(Charsets.UTF_8)).isEqualTo(DMN)
    }

    @Test
    fun `should support the global decision definition export request`() {
        assertThat(exporter.supports()).isEqualTo(GlobalDecisionDefinitionExportRequest::class.java)
    }

    private companion object {
        const val DECISION_ID = "decision-id"
        const val DMN = "<definitions>dmn</definitions>"
    }
}
