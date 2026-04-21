/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.form.mapper

import com.ritense.exporter.request.FormDefinitionExportRequest
import com.ritense.form.domain.FormDefinitionBlueprintId
import com.ritense.form.domain.FormDisplayType
import com.ritense.form.domain.FormIoFormDefinition
import com.ritense.form.domain.FormProcessLink
import com.ritense.form.domain.FormSizes
import com.ritense.form.processlink.dto.FormProcessLinkDeployDto
import com.ritense.form.service.FormDefinitionService
import com.ritense.form.web.rest.dto.FormProcessLinkCreateRequestDto
import com.ritense.form.web.rest.dto.FormProcessLinkResponseDto
import com.ritense.form.web.rest.dto.FormProcessLinkUpdateRequestDto
import com.ritense.processlink.domain.ActivityTypeWithEventName.USER_TASK_CREATE
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

internal class FormProcessLinkMapperTest {

    @Mock
    lateinit var formDefinitionService: FormDefinitionService

    private lateinit var formProcessLinkMapper: FormProcessLinkMapper

    val caseDefinitionId = CaseDefinitionId.of("person", "1.0.0")
    val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("subsidy-calculator", "1.0.0")

    @BeforeEach
    fun beforeEach() {
        MockitoAnnotations.openMocks(this)
        formProcessLinkMapper = FormProcessLinkMapper(
            MapperSingleton.get(),
            formDefinitionService,
        )
    }

    @Test
    fun `should map FormProcessLink entity to dto`() {
        val formProcessLink = FormProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "processDefinitionId",
            activityId = "activityId",
            activityType = USER_TASK_CREATE,
            formDefinitionId = UUID.randomUUID(),
            viewModelEnabled = false,
            formDisplayType = FormDisplayType.panel,
            formSize = FormSizes.small,
            subtitles = SUBTITLES,
        )

        val formProcessLinkResponseDto = formProcessLinkMapper.toProcessLinkResponseDto(formProcessLink)

        assertTrue(formProcessLinkResponseDto is FormProcessLinkResponseDto)
        assertEquals(formProcessLink.id, formProcessLinkResponseDto.id)
        assertEquals(formProcessLink.processDefinitionId, formProcessLinkResponseDto.processDefinitionId)
        assertEquals(formProcessLink.activityId, formProcessLinkResponseDto.activityId)
        assertEquals(formProcessLink.activityType, formProcessLinkResponseDto.activityType)
        assertEquals(formProcessLink.formDefinitionId, formProcessLinkResponseDto.formDefinitionId)
        assertEquals(formProcessLink.viewModelEnabled, formProcessLinkResponseDto.viewModelEnabled)
        assertEquals(formProcessLink.formDisplayType, formProcessLinkResponseDto.formDisplayType)
        assertEquals(formProcessLink.formSize, formProcessLinkResponseDto.formSize)
        assertEquals(formProcessLink.subtitles, formProcessLinkResponseDto.subtitles)
    }

    @Test
    fun `should map createRequestDto to FormProcessLink entity`() {
        val createRequestDto = FormProcessLinkCreateRequestDto(
            processDefinitionId = "processDefinitionId",
            activityId = "activityId",
            activityType = USER_TASK_CREATE,
            formDefinitionId = UUID.randomUUID(),
            viewModelEnabled = false,
            formDisplayType = FormDisplayType.panel,
            formSize = FormSizes.small,
            subtitles = SUBTITLES,
        )
        whenever(formDefinitionService.formDefinitionExistsById(createRequestDto.formDefinitionId)).thenReturn(true)

        val formProcessLink = formProcessLinkMapper.toNewProcessLink(createRequestDto, caseDefinitionId)

        assertTrue(formProcessLink is FormProcessLink)
        assertEquals(createRequestDto.processDefinitionId, formProcessLink.processDefinitionId)
        assertEquals(createRequestDto.activityId, formProcessLink.activityId)
        assertEquals(createRequestDto.activityType, formProcessLink.activityType)
        assertEquals(createRequestDto.formDefinitionId, formProcessLink.formDefinitionId)
        assertEquals(createRequestDto.viewModelEnabled, formProcessLink.viewModelEnabled)
        assertEquals(createRequestDto.formDisplayType, formProcessLink.formDisplayType)
        assertEquals(createRequestDto.formSize, formProcessLink.formSize)
        assertEquals(createRequestDto.subtitles, formProcessLink.subtitles)
    }

    @Test
    fun `should map updateRequestDto to FormProcessLink entity`() {
        val processLinkToUpdate = FormProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "processDefinitionId",
            activityId = "activityId",
            activityType = USER_TASK_CREATE,
            formDefinitionId = UUID.randomUUID(),
            viewModelEnabled = false,
        )
        val updateRequestDto = FormProcessLinkUpdateRequestDto(
            id = processLinkToUpdate.id,
            formDefinitionId = UUID.randomUUID(),
            viewModelEnabled = false,
            formDisplayType = FormDisplayType.panel,
            formSize = FormSizes.small,
            subtitles = SUBTITLES
        )
        whenever(formDefinitionService.formDefinitionExistsById(updateRequestDto.formDefinitionId)).thenReturn(true)

        val formProcessLink = formProcessLinkMapper.toUpdatedProcessLink(processLinkToUpdate, updateRequestDto, caseDefinitionId)

        assertTrue(formProcessLink is FormProcessLink)
        assertEquals(processLinkToUpdate.processDefinitionId, formProcessLink.processDefinitionId)
        assertEquals(processLinkToUpdate.activityId, formProcessLink.activityId)
        assertEquals(processLinkToUpdate.activityType, formProcessLink.activityType)
        assertEquals(updateRequestDto.formDefinitionId, formProcessLink.formDefinitionId)
        assertEquals(updateRequestDto.viewModelEnabled, formProcessLink.viewModelEnabled)
        assertEquals(updateRequestDto.formDisplayType, formProcessLink.formDisplayType)
        assertEquals(updateRequestDto.formSize, formProcessLink.formSize)
        assertEquals(updateRequestDto.subtitles, formProcessLink.subtitles)
    }

    @Test
    fun `should throw error when formDefinition doesn't exist in toNewProcessLink`() {
        val createRequestDto = FormProcessLinkCreateRequestDto(
            processDefinitionId = "processDefinitionId",
            activityId = "activityId",
            activityType = USER_TASK_CREATE,
            formDefinitionId = UUID.randomUUID(),
            viewModelEnabled = false
        )

        val exception = assertThrows<RuntimeException> {
            formProcessLinkMapper.toNewProcessLink(createRequestDto, caseDefinitionId)
        }

        assertEquals("Form definition not found with id ${createRequestDto.formDefinitionId}", exception.message)
    }

    @Test
    fun `should throw error when formDefinition doesn't exist in toUpdatedProcessLink`() {
        val processLinkToUpdate = FormProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "processDefinitionId",
            activityId = "activityId",
            activityType = USER_TASK_CREATE,
            formDefinitionId = UUID.randomUUID(),
            viewModelEnabled = false
        )
        val updateRequestDto = FormProcessLinkUpdateRequestDto(
            id = processLinkToUpdate.id,
            formDefinitionId = UUID.randomUUID(),
            viewModelEnabled = false
        )

        val exception = assertThrows<RuntimeException> {
            formProcessLinkMapper.toUpdatedProcessLink(processLinkToUpdate, updateRequestDto, caseDefinitionId)
        }

        assertEquals("Form definition not found with id ${updateRequestDto.formDefinitionId}", exception.message)
    }

    @Test
    fun `should return related export request for form process links`() {
        val formDefinition = FormIoFormDefinition(
            UUID.randomUUID(),
            "testing",
            "{}",
            FormDefinitionBlueprintId.forCase(CaseDefinitionId.of("house", "1.0.0")),
            true
        )
        val formProcessLink = FormProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "processDefinitionId",
            activityId = "activityId",
            activityType = USER_TASK_CREATE,
            formDefinitionId = formDefinition.id!!,
            viewModelEnabled = false
        )

        whenever(formDefinitionService.getFormDefinitionById(formProcessLink.formDefinitionId))
            .thenReturn(Optional.of(formDefinition))
        val relatedExportRequests = formProcessLinkMapper.createRelatedExportRequests(formProcessLink, caseDefinitionId)

        assertThat(relatedExportRequests).contains(
            FormDefinitionExportRequest("testing", caseDefinitionId)
        )
    }

    @Test
    fun `should resolve form definition by case blueprint for deploy dto`() {
        val formDefinitionId = UUID.randomUUID()
        val formDefinition = FormIoFormDefinition(
            formDefinitionId,
            "my-case-form",
            "{}",
            FormDefinitionBlueprintId.forCase(caseDefinitionId),
            false
        )
        val deployDto = FormProcessLinkDeployDto(
            processDefinitionId = "case-process-def:1:123",
            activityId = "userTask1",
            activityType = USER_TASK_CREATE,
            formDefinitionName = "my-case-form",
            subtitles = null
        )

        whenever(formDefinitionService.getFormDefinitionByName("my-case-form", caseDefinitionId as BlueprintId))
            .thenReturn(Optional.of(formDefinition))

        val result = formProcessLinkMapper.toProcessLinkCreateRequestDto(deployDto, caseDefinitionId)

        assertTrue(result is FormProcessLinkCreateRequestDto)
        assertEquals(formDefinitionId, result.formDefinitionId)
        assertEquals("case-process-def:1:123", result.processDefinitionId)
        assertEquals("userTask1", result.activityId)
    }

    @Test
    fun `should resolve form definition by building block blueprint for deploy dto`() {
        val formDefinitionId = UUID.randomUUID()
        val formDefinition = FormIoFormDefinition(
            formDefinitionId,
            "my-bb-form",
            "{}",
            FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId),
            false
        )
        val deployDto = FormProcessLinkDeployDto(
            processDefinitionId = "bb-process-def:1:456",
            activityId = "reviewTask",
            activityType = USER_TASK_CREATE,
            formDefinitionName = "my-bb-form",
            subtitles = null
        )

        whenever(formDefinitionService.getFormDefinitionByName("my-bb-form", buildingBlockDefinitionId))
            .thenReturn(Optional.of(formDefinition))

        val result = formProcessLinkMapper.toProcessLinkCreateRequestDto(deployDto, buildingBlockDefinitionId)

        assertTrue(result is FormProcessLinkCreateRequestDto)
        assertEquals(formDefinitionId, result.formDefinitionId)
        assertEquals("bb-process-def:1:456", result.processDefinitionId)
        assertEquals("reviewTask", result.activityId)
    }

    @Test
    fun `should throw when form definition not found for deploy dto`() {
        val deployDto = FormProcessLinkDeployDto(
            processDefinitionId = "unknown-process:1:789",
            activityId = "someTask",
            activityType = USER_TASK_CREATE,
            formDefinitionName = "non-existent-form",
            subtitles = null
        )

        whenever(formDefinitionService.getFormDefinitionByName("non-existent-form", caseDefinitionId as BlueprintId))
            .thenReturn(Optional.empty())

        val exception = assertThrows<IllegalStateException> {
            formProcessLinkMapper.toProcessLinkCreateRequestDto(deployDto, caseDefinitionId)
        }

        assertEquals("Form definition non-existent-form not found", exception.message)
    }

    @Test
    fun `should resolve form definition by building block blueprint for update dto`() {
        val formDefinitionId = UUID.randomUUID()
        val formDefinition = FormIoFormDefinition(
            formDefinitionId,
            "my-bb-form",
            "{}",
            FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId),
            false
        )
        val existingProcessLinkId = UUID.randomUUID()
        val deployDto = FormProcessLinkDeployDto(
            processDefinitionId = "bb-process-def:1:456",
            activityId = "reviewTask",
            activityType = USER_TASK_CREATE,
            formDefinitionName = "my-bb-form",
            viewModelEnabled = false,
            formDisplayType = FormDisplayType.panel,
            formSize = FormSizes.medium,
            subtitles = SUBTITLES
        )

        whenever(formDefinitionService.getFormDefinitionByName("my-bb-form", buildingBlockDefinitionId))
            .thenReturn(Optional.of(formDefinition))

        val result = formProcessLinkMapper.toProcessLinkUpdateRequestDto(deployDto, existingProcessLinkId, buildingBlockDefinitionId)

        assertTrue(result is FormProcessLinkUpdateRequestDto)
        assertEquals(existingProcessLinkId, result.id)
        assertEquals(formDefinitionId, result.formDefinitionId)
    }

    @Test
    fun `should resolve form definition without blueprint when blueprintId is null`() {
        val formDefinitionId = UUID.randomUUID()
        val formDefinition = FormIoFormDefinition(
            formDefinitionId,
            "global-form",
            "{}",
            null,
            false
        )
        val deployDto = FormProcessLinkDeployDto(
            processDefinitionId = "some-process:1:001",
            activityId = "task1",
            activityType = USER_TASK_CREATE,
            formDefinitionName = "global-form",
            subtitles = null
        )

        whenever(formDefinitionService.getFormDefinitionByName("global-form"))
            .thenReturn(Optional.of(formDefinition))

        val result = formProcessLinkMapper.toProcessLinkCreateRequestDto(deployDto, null)

        assertTrue(result is FormProcessLinkCreateRequestDto)
        assertEquals(formDefinitionId, result.formDefinitionId)
    }

    companion object {
        val SUBTITLES = listOf("test", "test2")
    }
}
