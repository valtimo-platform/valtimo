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
import com.ritense.form.repository.FormDefinitionRepository
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import java.util.Optional
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class BuildingBlockFormDefinitionServiceTest(
    @Mock private val formDefinitionRepository: FormDefinitionRepository,
    @Mock private val definitionChecker: BuildingBlockDefinitionChecker
) {
    private lateinit var service: BuildingBlockFormDefinitionService

    private val buildingBlockDefinitionId = BuildingBlockDefinitionId("my-building-block", "1.0.0")
    private val formDefinitionJson = """{"display": "form", "components": []}"""

    @BeforeEach
    fun setUp() {
        service = BuildingBlockFormDefinitionService(formDefinitionRepository, definitionChecker)
    }

    @Test
    fun `should query form definitions without search term`() {
        val blueprintId = FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId)
        val form = FormIoFormDefinition(UUID.randomUUID(), "test-form", formDefinitionJson, blueprintId, false)
        val pageable = PageRequest.of(0, 10)

        whenever(
            formDefinitionRepository.findAllByBlueprintIdOrderByNameAsc(
                eq(BlueprintType.BUILDING_BLOCK),
                eq(buildingBlockDefinitionId.key),
                eq(buildingBlockDefinitionId.versionTag)
            )
        ).thenReturn(listOf(form))

        val result = service.queryFormDefinitions(buildingBlockDefinitionId, null, pageable)

        assertThat(result.content).hasSize(1)
        assertThat(result.content[0].name).isEqualTo("test-form")
    }

    @Test
    fun `should query form definitions with search term`() {
        val blueprintId = FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId)
        val form = FormIoFormDefinition(UUID.randomUUID(), "test-form", formDefinitionJson, blueprintId, false)
        val pageable = PageRequest.of(0, 10)
        val searchTerm = "test"

        whenever(
            formDefinitionRepository.findAllByBlueprintIdAndNameContainingIgnoreCase(
                eq(BlueprintType.BUILDING_BLOCK),
                eq(buildingBlockDefinitionId.key),
                eq(buildingBlockDefinitionId.versionTag),
                eq(searchTerm),
                eq(pageable)
            )
        ).thenReturn(PageImpl(listOf(form)))

        val result = service.queryFormDefinitions(buildingBlockDefinitionId, searchTerm, pageable)

        assertThat(result.content).hasSize(1)
        assertThat(result.content[0].name).isEqualTo("test-form")
    }

    @Test
    fun `should get form definition by id`() {
        val formId = UUID.randomUUID()
        val blueprintId = FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId)
        val form = FormIoFormDefinition(formId, "test-form", formDefinitionJson, blueprintId, false)

        whenever(
            formDefinitionRepository.findByIdAndBlueprintId(
                eq(formId),
                eq(BlueprintType.BUILDING_BLOCK),
                eq(buildingBlockDefinitionId.key),
                eq(buildingBlockDefinitionId.versionTag)
            )
        ).thenReturn(Optional.of(form))

        val result = service.getFormDefinitionById(buildingBlockDefinitionId, formId)

        assertThat(result).isPresent
        assertThat(result.get().id).isEqualTo(formId)
    }

    @Test
    fun `should get form definition by name`() {
        val blueprintId = FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId)
        val form = FormIoFormDefinition(UUID.randomUUID(), "test-form", formDefinitionJson, blueprintId, false)

        whenever(
            formDefinitionRepository.findByNameAndBlueprintId(
                eq("test-form"),
                eq(BlueprintType.BUILDING_BLOCK),
                eq(buildingBlockDefinitionId.key),
                eq(buildingBlockDefinitionId.versionTag)
            )
        ).thenReturn(Optional.of(form))

        val result = service.getFormDefinitionByName(buildingBlockDefinitionId, "test-form")

        assertThat(result).isPresent
        assertThat(result.get().name).isEqualTo("test-form")
    }

    @Test
    fun `should create form definition`() {
        whenever(
            formDefinitionRepository.findByNameAndBlueprintId(
                any(),
                eq(BlueprintType.BUILDING_BLOCK),
                eq(buildingBlockDefinitionId.key),
                eq(buildingBlockDefinitionId.versionTag)
            )
        ).thenReturn(Optional.empty())

        whenever(formDefinitionRepository.save(any<FormIoFormDefinition>())).thenAnswer { it.arguments[0] }

        val result = service.createFormDefinition(buildingBlockDefinitionId, "new-form", formDefinitionJson, false)

        assertThat(result.name).isEqualTo("new-form")
        assertThat(result.blueprintId).isPresent
        assertThat(result.blueprintId.get().blueprintType).isEqualTo(BlueprintType.BUILDING_BLOCK)
        assertThat(result.blueprintId.get().blueprintKey).isEqualTo(buildingBlockDefinitionId.key)

        val captor = argumentCaptor<FormIoFormDefinition>()
        verify(formDefinitionRepository).save(captor.capture())
        assertThat(captor.firstValue.name).isEqualTo("new-form")
    }

    @Test
    fun `should throw when creating form with duplicate name`() {
        val blueprintId = FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId)
        val existingForm = FormIoFormDefinition(UUID.randomUUID(), "existing-form", formDefinitionJson, blueprintId, false)

        whenever(
            formDefinitionRepository.findByNameAndBlueprintId(
                eq("existing-form"),
                eq(BlueprintType.BUILDING_BLOCK),
                eq(buildingBlockDefinitionId.key),
                eq(buildingBlockDefinitionId.versionTag)
            )
        ).thenReturn(Optional.of(existingForm))

        val exception = assertThrows<IllegalArgumentException> {
            service.createFormDefinition(buildingBlockDefinitionId, "existing-form", formDefinitionJson, false)
        }

        assertThat(exception.message).contains("Duplicate name")
    }

    @Test
    fun `should update form definition`() {
        val formId = UUID.randomUUID()
        val blueprintId = FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId)
        val existingForm = FormIoFormDefinition(formId, "old-name", formDefinitionJson, blueprintId, false)

        whenever(
            formDefinitionRepository.findByIdAndBlueprintId(
                eq(formId),
                eq(BlueprintType.BUILDING_BLOCK),
                eq(buildingBlockDefinitionId.key),
                eq(buildingBlockDefinitionId.versionTag)
            )
        ).thenReturn(Optional.of(existingForm))

        whenever(formDefinitionRepository.save(any<FormIoFormDefinition>())).thenAnswer { it.arguments[0] }

        val newFormDefinition = """{"display": "form", "components": [{"type": "textfield"}]}"""
        val result = service.updateFormDefinition(buildingBlockDefinitionId, formId, "new-name", newFormDefinition)

        assertThat(result.name).isEqualTo("new-name")
        verify(formDefinitionRepository).save(any())
    }

    @Test
    fun `should throw when updating non-existent form`() {
        val formId = UUID.randomUUID()

        whenever(
            formDefinitionRepository.findByIdAndBlueprintId(
                eq(formId),
                eq(BlueprintType.BUILDING_BLOCK),
                eq(buildingBlockDefinitionId.key),
                eq(buildingBlockDefinitionId.versionTag)
            )
        ).thenReturn(Optional.empty())

        val exception = assertThrows<IllegalArgumentException> {
            service.updateFormDefinition(buildingBlockDefinitionId, formId, "new-name", formDefinitionJson)
        }

        assertThat(exception.message).contains("Form definition not found")
    }

    @Test
    fun `should delete form definition`() {
        val formId = UUID.randomUUID()
        val blueprintId = FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId)
        val form = FormIoFormDefinition(formId, "test-form", formDefinitionJson, blueprintId, false)

        whenever(
            formDefinitionRepository.findByIdAndBlueprintId(
                eq(formId),
                eq(BlueprintType.BUILDING_BLOCK),
                eq(buildingBlockDefinitionId.key),
                eq(buildingBlockDefinitionId.versionTag)
            )
        ).thenReturn(Optional.of(form))

        service.deleteFormDefinition(buildingBlockDefinitionId, formId)

        verify(formDefinitionRepository).delete(form)
    }

    @Test
    fun `should throw when deleting non-existent form`() {
        val formId = UUID.randomUUID()

        whenever(
            formDefinitionRepository.findByIdAndBlueprintId(
                eq(formId),
                eq(BlueprintType.BUILDING_BLOCK),
                eq(buildingBlockDefinitionId.key),
                eq(buildingBlockDefinitionId.versionTag)
            )
        ).thenReturn(Optional.empty())

        val exception = assertThrows<IllegalArgumentException> {
            service.deleteFormDefinition(buildingBlockDefinitionId, formId)
        }

        assertThat(exception.message).contains("Form definition not found")
    }
}
