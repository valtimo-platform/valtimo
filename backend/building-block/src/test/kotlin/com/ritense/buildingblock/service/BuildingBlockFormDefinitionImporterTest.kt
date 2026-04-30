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

import com.ritense.form.domain.FormDefinitionBlueprintId
import com.ritense.form.domain.FormIoFormDefinition
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
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class BuildingBlockFormDefinitionImporterTest(
    @Mock private val buildingBlockFormDefinitionService: BuildingBlockFormDefinitionService
) {
    private lateinit var importer: BuildingBlockFormDefinitionImporter

    private val buildingBlockDefinitionId = BuildingBlockDefinitionId("my-building-block", "1.0.0")
    private val formDefinitionJson = """{"display": "form", "components": []}"""

    @BeforeEach
    fun setUp() {
        importer = BuildingBlockFormDefinitionImporter(buildingBlockFormDefinitionService)
    }

    @Test
    fun `should be of type buildingblockformdefinition`() {
        assertThat(importer.type()).isEqualTo(ValtimoImportTypes.BUILDING_BLOCK_FORM_DEFINITION)
    }

    @Test
    fun `should depend on building block definition and process definition`() {
        assertThat(importer.dependsOn()).containsExactlyInAnyOrder(
            ValtimoImportTypes.BUILDING_BLOCK_DEFINITION,
            ValtimoImportTypes.BUILDING_BLOCK_PROCESS_DEFINITION
        )
    }

    @Test
    fun `should support form definition file names`() {
        assertThat(importer.supports("/form/my-form.form.json")).isTrue()
        assertThat(importer.supports("/form/subfolder/my-form.form.json")).isTrue()
        assertThat(importer.supports("/form/deep/nested/path/my-form.form.json")).isTrue()
    }

    @Test
    fun `should not support invalid file names`() {
        assertThat(importer.supports("/form/my-form.json")).isFalse()
        assertThat(importer.supports("/forms/my-form.form.json")).isFalse()
        assertThat(importer.supports("/other/my-form.form.json")).isFalse()
        assertThat(importer.supports("my-form.form.json")).isFalse()
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
            fileName = "/form/my-form.form.json",
            content = formDefinitionJson.toByteArray()
        )

        val exception = assertThrows<IllegalArgumentException> {
            importer.import(request)
        }

        assertThat(exception.message).contains("Building block definition ID is required")
    }

    @Test
    fun `should create new form definition when it does not exist`() {
        val request = ImportRequest(
            fileName = "/form/new-form.form.json",
            content = formDefinitionJson.toByteArray(),
            buildingBlockDefinitionId = buildingBlockDefinitionId
        )

        whenever(
            buildingBlockFormDefinitionService.getFormDefinitionByName(
                eq(buildingBlockDefinitionId),
                eq("new-form")
            )
        ).thenReturn(Optional.empty())

        importer.import(request)

        verify(buildingBlockFormDefinitionService).createFormDefinition(
            eq(buildingBlockDefinitionId),
            eq("new-form"),
            eq(formDefinitionJson),
            eq(false)
        )
    }

    @Test
    fun `should update existing form definition when it already exists`() {
        val existingFormId = UUID.randomUUID()
        val blueprintId = FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId)
        val existingForm = FormIoFormDefinition(existingFormId, "existing-form", "{}", blueprintId, false)

        val updatedFormDefinition = """{"display": "form", "components": [{"type": "textfield"}]}"""
        val request = ImportRequest(
            fileName = "/form/existing-form.form.json",
            content = updatedFormDefinition.toByteArray(),
            buildingBlockDefinitionId = buildingBlockDefinitionId
        )

        whenever(
            buildingBlockFormDefinitionService.getFormDefinitionByName(
                eq(buildingBlockDefinitionId),
                eq("existing-form")
            )
        ).thenReturn(Optional.of(existingForm))

        importer.import(request)

        verify(buildingBlockFormDefinitionService).updateFormDefinition(
            eq(buildingBlockDefinitionId),
            eq(existingFormId),
            eq("existing-form"),
            eq(updatedFormDefinition)
        )
    }

    @Test
    fun `should extract form name from nested path`() {
        val request = ImportRequest(
            fileName = "/form/subfolder/nested/my-nested-form.form.json",
            content = formDefinitionJson.toByteArray(),
            buildingBlockDefinitionId = buildingBlockDefinitionId
        )

        whenever(
            buildingBlockFormDefinitionService.getFormDefinitionByName(
                eq(buildingBlockDefinitionId),
                eq("my-nested-form")
            )
        ).thenReturn(Optional.empty())

        importer.import(request)

        verify(buildingBlockFormDefinitionService).createFormDefinition(
            eq(buildingBlockDefinitionId),
            eq("my-nested-form"),
            any(),
            eq(false)
        )
    }
}
