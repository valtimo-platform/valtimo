package com.ritense.form.listener

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.form.domain.FormDefinition
import com.ritense.form.domain.FormProcessLink
import com.ritense.form.domain.request.CreateFormDefinitionRequest
import com.ritense.form.service.FormDefinitionService
import com.ritense.form.web.rest.dto.FormProcessLinkUpdateRequestDto
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.domain.ProcessLinksCopiedEvent
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.UUID

class FormCaseEventListenerTest {

    private val objectMapper = ObjectMapper()

    private lateinit var formDefinitionService: FormDefinitionService
    private lateinit var processLinkService: ProcessLinkService
    private lateinit var listener: FormCaseEventListener

    @BeforeEach
    fun setUp() {
        formDefinitionService = mock()
        processLinkService = mock()
        listener = FormCaseEventListener(formDefinitionService, processLinkService)
    }

    @Test
    fun `should update all form process links even when preceding link has different type`() {
        val targetCaseDefinitionId = CaseDefinitionId.of("target", "1.0.0")
        val sourceCaseDefinitionId = CaseDefinitionId.of("source", "1.0.0")
        val sourceFormId = UUID.randomUUID()
        val targetFormId = UUID.randomUUID()
        val unmappedFormId = UUID.randomUUID()

        val sourceDefinition = formDefinition(sourceFormId, "shared-form")
        val targetDefinition = formDefinition(targetFormId, "shared-form")

        whenever(formDefinitionService.getFormDefinitions(targetCaseDefinitionId))
            .thenReturn(listOf(targetDefinition))
        whenever(formDefinitionService.getFormDefinitions(sourceCaseDefinitionId))
            .thenReturn(listOf(sourceDefinition))

        val nonFormProcessLink = DummyProcessLink()
        val mappedFormProcessLink = formProcessLink(formDefinitionId = sourceFormId)
        val secondFormProcessLink = formProcessLink(formDefinitionId = unmappedFormId)

        val event = ProcessLinksCopiedEvent(
            copiedProcessLinks = listOf(nonFormProcessLink, mappedFormProcessLink, secondFormProcessLink),
            processDefinitionId = "process-definition",
            caseDefinitionId = targetCaseDefinitionId,
            basedOnProcessDefinitionId = "source-process-definition",
            basedOnCaseDefinitionId = sourceCaseDefinitionId
        )

        listener.handleProcessLinksCopiedEvent(event)

        val requestCaptor = argumentCaptor<FormProcessLinkUpdateRequestDto>()
        verify(processLinkService, times(2)).updateProcessLink(requestCaptor.capture(), eq(targetCaseDefinitionId))

        val requestsByProcessLinkId = requestCaptor.allValues.associateBy { it.id }
        assertThat(requestsByProcessLinkId[mappedFormProcessLink.id]?.formDefinitionId).isEqualTo(targetFormId)
        assertThat(requestsByProcessLinkId[secondFormProcessLink.id]?.formDefinitionId).isEqualTo(unmappedFormId)
    }

    @Test
    fun `should copy form definitions when target case definition has none`() {
        val targetCaseDefinitionId = CaseDefinitionId.of("target", "2.0.0")
        val sourceCaseDefinitionId = CaseDefinitionId.of("source", "2.0.0")

        val oldFormDefinitionOne = formDefinition(UUID.randomUUID(), "first-form", readOnly = false)
        val oldFormDefinitionTwo = formDefinition(UUID.randomUUID(), "second-form", readOnly = true)

        val newFormDefinitionOne = formDefinition(UUID.randomUUID(), "first-form")
        val newFormDefinitionTwo = formDefinition(UUID.randomUUID(), "second-form")

        whenever(formDefinitionService.getFormDefinitions(targetCaseDefinitionId)).thenReturn(emptyList())
        whenever(formDefinitionService.getFormDefinitions(sourceCaseDefinitionId))
            .thenReturn(listOf(oldFormDefinitionOne, oldFormDefinitionTwo))
        whenever(formDefinitionService.createFormDefinition(eq(targetCaseDefinitionId), any<CreateFormDefinitionRequest>()))
            .thenReturn(newFormDefinitionOne, newFormDefinitionTwo)

        val firstLink = formProcessLink(formDefinitionId = oldFormDefinitionOne.id)
        val secondLink = formProcessLink(formDefinitionId = oldFormDefinitionTwo.id)

        val event = ProcessLinksCopiedEvent(
            copiedProcessLinks = listOf(firstLink, secondLink),
            processDefinitionId = "process-definition",
            caseDefinitionId = targetCaseDefinitionId,
            basedOnProcessDefinitionId = "source-process-definition",
            basedOnCaseDefinitionId = sourceCaseDefinitionId
        )

        listener.handleProcessLinksCopiedEvent(event)

        verify(formDefinitionService, times(2)).createFormDefinition(eq(targetCaseDefinitionId), any<CreateFormDefinitionRequest>())

        val requestCaptor = argumentCaptor<FormProcessLinkUpdateRequestDto>()
        verify(processLinkService, times(2)).updateProcessLink(requestCaptor.capture(), eq(targetCaseDefinitionId))

        val requestsByProcessLinkId = requestCaptor.allValues.associateBy { it.id }
        assertThat(requestsByProcessLinkId[firstLink.id]?.formDefinitionId).isEqualTo(newFormDefinitionOne.id)
        assertThat(requestsByProcessLinkId[secondLink.id]?.formDefinitionId).isEqualTo(newFormDefinitionTwo.id)
    }

    private fun formProcessLink(
        id: UUID = UUID.randomUUID(),
        processDefinitionId: String = "process-definition",
        activityId: String = "activity-id",
        formDefinitionId: UUID = UUID.randomUUID()
    ): FormProcessLink = FormProcessLink(
        id = id,
        processDefinitionId = processDefinitionId,
        activityId = activityId,
        activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
        formDefinitionId = formDefinitionId
    )

    private fun formDefinition(id: UUID, name: String, readOnly: Boolean = false): FormDefinition {
        val formDefinition = mock<FormDefinition>()
        whenever(formDefinition.id).thenReturn(id)
        whenever(formDefinition.name).thenReturn(name)
        whenever(formDefinition.isReadOnly).thenReturn(readOnly)
        whenever(formDefinition.formDefinition).thenReturn(objectMapper.readTree("{}"))
        return formDefinition
    }

    private class DummyProcessLink(
        id: UUID = UUID.randomUUID(),
        processDefinitionId: String = "dummy-process-definition",
        activityId: String = "dummy-activity-id"
    ) : ProcessLink(
        id,
        processDefinitionId,
        activityId,
        ActivityTypeWithEventName.USER_TASK_CREATE,
        "dummy"
    ) {
        override fun copy(id: UUID, processDefinitionId: String): ProcessLink = DummyProcessLink(
            id = id,
            processDefinitionId = processDefinitionId,
            activityId = activityId
        )
    }
}
