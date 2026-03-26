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

package com.ritense.form.autodeployment

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.form.domain.FormDefinitionBlueprintId
import com.ritense.form.domain.FormIoFormDefinition
import com.ritense.form.repository.FormDefinitionRepository
import com.ritense.form.service.FormDefinitionService
import java.util.Optional
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationEventPublisher
import org.springframework.core.io.ResourceLoader

@ExtendWith(MockitoExtension::class)
class FormDefinitionDeploymentServiceTest(
    @Mock private val resourceLoader: ResourceLoader,
    @Mock private val formDefinitionService: FormDefinitionService,
    @Mock private val formDefinitionRepository: FormDefinitionRepository,
    @Mock private val applicationEventPublisher: ApplicationEventPublisher
) {
    private lateinit var deploymentService: FormDefinitionDeploymentService
    private val objectMapper = ObjectMapper()

    @BeforeEach
    fun before() {
        deploymentService = FormDefinitionDeploymentService(
            resourceLoader,
            formDefinitionService,
            formDefinitionRepository,
            applicationEventPublisher,
            objectMapper
        )
    }

    @Test
    fun `should create new global form when it does not exist`() {
        val formJson = """{"display": "form", "components": []}"""
        whenever(formDefinitionRepository.findByNameAndBlueprintIdIsNull("my-form"))
            .thenReturn(Optional.empty())
        whenever(formDefinitionRepository.save(any<FormIoFormDefinition>()))
            .thenAnswer { it.arguments[0] }

        val result = deploymentService.deployGlobalForm("my-form", formJson, false)

        assertThat(result).isPresent
        val captor = argumentCaptor<FormIoFormDefinition>()
        verify(formDefinitionRepository).save(captor.capture())
        assertThat(captor.firstValue.name).isEqualTo("my-form")
        assertThat(captor.firstValue.blueprintId).isEmpty
    }

    @Test
    fun `should update existing global form when content differs`() {
        val existingId = UUID.randomUUID()
        val existingForm = FormIoFormDefinition(
            existingId, "my-form", """{"display": "form", "components": []}""",
            null as FormDefinitionBlueprintId?, false
        )
        val updatedJson = """{"display": "form", "components": [{"type": "textfield"}]}"""

        whenever(formDefinitionRepository.findByNameAndBlueprintIdIsNull("my-form"))
            .thenReturn(Optional.of(existingForm))
        whenever(formDefinitionService.modifyFormDefinition(any(), any(), any(), any()))
            .thenReturn(existingForm)

        val result = deploymentService.deployGlobalForm("my-form", updatedJson, false)

        assertThat(result).isPresent
        verify(formDefinitionService).modifyFormDefinition(
            eq(existingId), eq("my-form"), any(), eq(false)
        )
    }

    @Test
    fun `should not update global form when content is identical`() {
        val formJson = """{"display":"form","components":[]}"""
        val existingForm = FormIoFormDefinition(
            UUID.randomUUID(), "my-form", formJson,
            null as FormDefinitionBlueprintId?, false
        )

        whenever(formDefinitionRepository.findByNameAndBlueprintIdIsNull("my-form"))
            .thenReturn(Optional.of(existingForm))

        val result = deploymentService.deployGlobalForm("my-form", formJson, false)

        assertThat(result).isEmpty
        verify(formDefinitionService, never()).modifyFormDefinition(any(), any(), any(), any())
        verify(formDefinitionRepository, never()).save(any<FormIoFormDefinition>())
    }
}
