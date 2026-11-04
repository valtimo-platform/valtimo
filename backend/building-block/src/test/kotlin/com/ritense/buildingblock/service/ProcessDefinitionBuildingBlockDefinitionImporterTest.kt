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

import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_DEFINITION
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.service.OperatonProcessService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.repository.DeploymentWithDefinitions
import org.operaton.bpm.engine.repository.ProcessDefinition

@ExtendWith(MockitoExtension::class)
class ProcessDefinitionBuildingBlockDefinitionImporterTest(
    @Mock private val operatonProcessService: OperatonProcessService,
    @Mock private val buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService,
) {
    private lateinit var importer: ProcessDefinitionBuildingBlockDefinitionImporter

    @BeforeEach
    fun before() {
        importer = ProcessDefinitionBuildingBlockDefinitionImporter(
            operatonProcessService,
            buildingBlockDefinitionProcessDefinitionService
        )
    }

    @Test
    fun `should be of type 'form-definition'`() {
        assertThat(importer.type()).isEqualTo("buildingblockprocessdefinition")
    }

    @Test
    fun `should depend on building block definition`() {
        assertThat(importer.dependsOn()).isEqualTo(setOf(BUILDING_BLOCK_DEFINITION))
    }

    @Test
    fun `should support document definition fileName`() {
        assertThat(importer.supports(FILENAME)).isTrue()
        assertThat(importer.supports("/bpmn/not/test.bpmn")).isTrue()
    }

    @Test
    fun `should not support invalid document definition fileName`() {
        assertThat(importer.supports("/bpmn/test.dmn")).isFalse()
        assertThat(importer.supports("/bpmn/test-bpmn")).isFalse()
    }

    @Test
    fun `should link every process in the BPMN file`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId("bezwaar", "1.0.0")
        val first = mock<ProcessDefinition> { on { id } doReturn "first:1:aaa" }
        val second = mock<ProcessDefinition> { on { id } doReturn "second:1:bbb" }
        val deployment = mock<DeploymentWithDefinitions> {
            on { deployedProcessDefinitions } doReturn listOf(first, second)
        }
        whenever(operatonProcessService.deploy(eq(buildingBlockDefinitionId), eq("test.bpmn"), any()))
            .thenReturn(deployment)

        importer.import(ImportRequest(FILENAME, ByteArray(0), buildingBlockDefinitionId = buildingBlockDefinitionId))

        verify(buildingBlockDefinitionProcessDefinitionService).setMainLink(
            buildingBlockDefinitionId,
            null,
            ProcessDefinitionId.of("first:1:aaa"),
            false
        )
        verify(buildingBlockDefinitionProcessDefinitionService).setMainLink(
            buildingBlockDefinitionId,
            null,
            ProcessDefinitionId.of("second:1:bbb"),
            false
        )
    }

    private companion object {
        const val FILENAME = "/bpmn/test.bpmn"
    }
}