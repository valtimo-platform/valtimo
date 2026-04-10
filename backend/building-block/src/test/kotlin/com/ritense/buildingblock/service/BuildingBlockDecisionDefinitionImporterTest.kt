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

import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.service.OperatonProcessService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify

@ExtendWith(MockitoExtension::class)
class BuildingBlockDecisionDefinitionImporterTest(
    @Mock private val operatonProcessService: OperatonProcessService,
) {

    private lateinit var importer: BuildingBlockDecisionDefinitionImporter

    private val buildingBlockDefinitionId = BuildingBlockDefinitionId("my-building-block", "1.0.0")

    @BeforeEach
    fun setUp() {
        importer = BuildingBlockDecisionDefinitionImporter(operatonProcessService)
    }

    @Test
    fun `should be of type buildingblockdecisiondefinition`() {
        assertThat(importer.type()).isEqualTo(ValtimoImportTypes.BUILDING_BLOCK_DECISION_DEFINITION)
    }

    @Test
    fun `should depend on building block definition and process definition`() {
        assertThat(importer.dependsOn()).containsExactlyInAnyOrder(
            ValtimoImportTypes.BUILDING_BLOCK_DEFINITION,
            ValtimoImportTypes.BUILDING_BLOCK_PROCESS_DEFINITION
        )
    }

    @Test
    fun `should support dmn file names`() {
        assertThat(importer.supports("/dmn/my-decision.dmn")).isTrue()
        assertThat(importer.supports("/dmn/subfolder/my-decision.dmn")).isTrue()
        assertThat(importer.supports("/dmn/deep/nested/path/my-decision.dmn")).isTrue()
    }

    @Test
    fun `should not support invalid file names`() {
        assertThat(importer.supports("/dmn/my-decision.xml")).isFalse()
        assertThat(importer.supports("/bpmn/my-process.bpmn")).isFalse()
        assertThat(importer.supports("/form/my-form.form.json")).isFalse()
        assertThat(importer.supports("my-decision.dmn")).isFalse()
    }

    @Test
    fun `should be part of building block definition`() {
        assertThat(importer.partOfBuildingBlockDefinition()).isTrue()
    }

    @Test
    fun `should not be part of case definition`() {
        assertThat(importer.partOfCaseDefinition()).isFalse()
    }

    @Test
    fun `should throw when building block definition id is missing`() {
        val request = ImportRequest(
            fileName = "/dmn/my-decision.dmn",
            content = "<definitions/>".toByteArray()
        )

        val exception = assertThrows<IllegalArgumentException> {
            importer.import(request)
        }

        assertThat(exception.message).contains("Building block definition ID is required")
    }

    @Test
    fun `should deploy dmn file`() {
        val dmnContent = "<definitions>test</definitions>"
        val request = ImportRequest(
            fileName = "/dmn/my-decision.dmn",
            content = dmnContent.toByteArray(),
            buildingBlockDefinitionId = buildingBlockDefinitionId
        )

        importer.import(request)

        verify(operatonProcessService).deploy(eq(buildingBlockDefinitionId), eq("my-decision.dmn"), any())
    }

    @Test
    fun `should extract file name from nested path`() {
        val dmnContent = "<definitions>test</definitions>"
        val request = ImportRequest(
            fileName = "/dmn/subfolder/nested/my-nested-decision.dmn",
            content = dmnContent.toByteArray(),
            buildingBlockDefinitionId = buildingBlockDefinitionId
        )

        importer.import(request)

        verify(operatonProcessService).deploy(eq(buildingBlockDefinitionId), eq("my-nested-decision.dmn"), any())
    }
}