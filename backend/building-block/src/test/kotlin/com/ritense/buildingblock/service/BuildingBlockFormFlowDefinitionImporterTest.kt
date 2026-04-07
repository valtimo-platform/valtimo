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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.formflow.service.FormFlowService
import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.core.io.ResourceLoader

@ExtendWith(MockitoExtension::class)
class BuildingBlockFormFlowDefinitionImporterTest(
    @Mock private val formFlowService: FormFlowService,
    @Mock private val objectMapper: ObjectMapper,
    @Mock private val resourceLoader: ResourceLoader,
) {
    private lateinit var importer: BuildingBlockFormFlowDefinitionImporter

    @BeforeEach
    fun setUp() {
        importer = BuildingBlockFormFlowDefinitionImporter(formFlowService, objectMapper, resourceLoader)
    }

    @Test
    fun `type returns BUILDING_BLOCK_FORM_FLOW_DEFINITION`() {
        assertThat(importer.type()).isEqualTo(ValtimoImportTypes.BUILDING_BLOCK_FORM_FLOW_DEFINITION)
    }

    @Test
    fun `dependsOn returns BUILDING_BLOCK_DEFINITION and BUILDING_BLOCK_FORM_DEFINITION`() {
        assertThat(importer.dependsOn()).containsExactlyInAnyOrder(
            ValtimoImportTypes.BUILDING_BLOCK_DEFINITION,
            ValtimoImportTypes.BUILDING_BLOCK_FORM_DEFINITION
        )
    }

    @Test
    fun `supports valid form-flow file paths`() {
        assertThat(importer.supports("/form-flow/my-flow.form-flow.json")).isTrue()
        assertThat(importer.supports("/form-flow/another-flow.form-flow.json")).isTrue()
    }

    @Test
    fun `does not support invalid file paths`() {
        assertThat(importer.supports("/form-flow/my-flow.json")).isFalse()
        assertThat(importer.supports("/form/my-flow.form-flow.json")).isFalse()
        assertThat(importer.supports("my-flow.form-flow.json")).isFalse()
        assertThat(importer.supports("/form-flow/nested/my-flow.form-flow.json")).isFalse()
    }

    @Test
    fun `partOfBuildingBlockDefinition returns true`() {
        assertThat(importer.partOfBuildingBlockDefinition()).isTrue()
    }

    @Test
    fun `partOfCaseDefinition returns false`() {
        assertThat(importer.partOfCaseDefinition()).isFalse()
    }

    @Test
    fun `import without buildingBlockDefinitionId throws IllegalArgumentException`() {
        val request = ImportRequest(
            fileName = "/form-flow/my-flow.form-flow.json",
            content = "{}".toByteArray()
        )

        assertThrows<IllegalArgumentException> { importer.import(request) }
    }
}
