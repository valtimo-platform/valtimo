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

package com.ritense.form.service

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.authorization.AuthorizationService
import com.ritense.form.domain.FormIoFormDefinition
import com.ritense.form.domain.FormProcessLink
import com.ritense.form.domain.FormSpringContextHelper
import com.ritense.form.domain.IntermediateSubmission
import com.ritense.form.exception.TaskFormNotFoundException
import com.ritense.form.repository.IntermediateSubmissionRepository
import com.ritense.form.service.impl.FormIoFormDefinitionService
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.authentication.ManageableUser
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.operaton.domain.OperatonTask
import com.ritense.valtimo.service.OperatonTaskService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.springframework.context.ApplicationContext
import org.springframework.mock.env.MockEnvironment
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class IntermediateSubmissionServiceTest {

    private val repository: IntermediateSubmissionRepository = mock()
    private val userManagementService: UserManagementService = mock()
    private val authorizationService: AuthorizationService = mock()
    private val operatonTaskService: OperatonTaskService = mock()
    private val processLinkService: ProcessLinkService = mock()
    private val formDefinitionService: FormIoFormDefinitionService = mock()
    private val task: OperatonTask = mock()
    private val formDefinitionId = UUID.randomUUID()
    private val objectMapper = MapperSingleton.get()

    private lateinit var service: IntermediateSubmissionService

    @BeforeEach
    fun setUp() {
        val applicationContext: ApplicationContext = mock()
        whenever(applicationContext.environment).thenReturn(MockEnvironment())
        FormSpringContextHelper.setContext(applicationContext)
        service = IntermediateSubmissionService(
            repository,
            userManagementService,
            authorizationService,
            operatonTaskService,
            processLinkService,
            formDefinitionService
        )
        val user: ManageableUser = mock()
        whenever(user.username).thenReturn("user")
        whenever(userManagementService.currentUser).thenReturn(user)
        whenever(task.id).thenReturn(TASK_ID)
        whenever(task.taskDefinitionKey).thenReturn("task-key")
        whenever(task.getProcessDefinitionId()).thenReturn("process-def-id")
        whenever(operatonTaskService.findTaskById(TASK_ID)).thenReturn(task)
        whenever(repository.save(any<IntermediateSubmission>())).thenAnswer { it.arguments[0] }
        withFormLink()
    }

    @Test
    fun `store should strip top-level and nested previews and keep siblings`() {
        val result = service.store(submission(), TASK_ID)

        val saved = argumentCaptor<IntermediateSubmission>().also { verify(repository).save(it.capture()) }.firstValue
        assertEquals(result.content, saved.content)
        assertSanitized(saved.content)
    }

    @Test
    fun `store should strip flat dotted preview keys inside grid rows`() {
        val content = objectMapper.readTree(
            """{"mails":[{"subject":"s","mailPreview.ontvangstbevestiging":"<img src=x onerror=alert(1)>"}]}"""
        ) as ObjectNode

        service.store(content, TASK_ID)

        val saved = argumentCaptor<IntermediateSubmission>().also { verify(repository).save(it.capture()) }.firstValue
        assertFalse(saved.content["mails"][0].has("mailPreview.ontvangstbevestiging"))
        assertEquals("s", saved.content["mails"][0]["subject"].asText())
    }

    @Test
    fun `store should strip previews when updating an existing submission`() {
        val existing = IntermediateSubmission.new(
            content = objectMapper.createObjectNode(),
            taskInstanceId = TASK_ID,
            createdBy = "creator"
        )
        whenever(repository.getByTaskInstanceId(TASK_ID)).thenReturn(existing)

        service.store(submission(), TASK_ID)

        val saved = argumentCaptor<IntermediateSubmission>().also { verify(repository).save(it.capture()) }.firstValue
        assertSanitized(saved.content)
    }

    @Test
    fun `store should throw and not save when there is no process link`() {
        whenever(processLinkService.getProcessLinks("process-def-id", "task-key")).thenReturn(emptyList())

        assertThrows<TaskFormNotFoundException> { service.store(submission(), TASK_ID) }
        verify(repository, never()).save(any<IntermediateSubmission>())
    }

    @Test
    fun `store should throw and not save when only a non-form link exists`() {
        whenever(processLinkService.getProcessLinks("process-def-id", "task-key"))
            .thenReturn(listOf(mock<ProcessLink>()))

        assertThrows<TaskFormNotFoundException> { service.store(submission(), TASK_ID) }
        verify(repository, never()).save(any<IntermediateSubmission>())
    }

    @Test
    fun `store should throw and not save when task definition key is null`() {
        whenever(task.taskDefinitionKey).thenReturn(null)

        assertThrows<TaskFormNotFoundException> { service.store(submission(), TASK_ID) }
        verify(repository, never()).save(any<IntermediateSubmission>())
    }

    @Test
    fun `get should return sanitized content and leave stored entity unchanged`() {
        val stored = IntermediateSubmission.new(
            content = submission(),
            taskInstanceId = TASK_ID,
            createdBy = "creator"
        )
        whenever(repository.getByTaskInstanceId(TASK_ID)).thenReturn(stored)

        val result = service.get(TASK_ID)

        assertSanitized(result!!.content)
        assertTrue(stored.content.has("top"))
        assertEquals(submission(), stored.content)
    }

    @Test
    fun `get should throw when the task has no form link`() {
        whenever(processLinkService.getProcessLinks("process-def-id", "task-key")).thenReturn(emptyList())
        whenever(repository.getByTaskInstanceId(TASK_ID)).thenReturn(null)

        assertThrows<TaskFormNotFoundException> { service.get(TASK_ID) }
    }

    private fun withFormLink() {
        val link: FormProcessLink = mock()
        whenever(link.formDefinitionId).thenReturn(formDefinitionId)
        whenever(processLinkService.getProcessLinks("process-def-id", "task-key")).thenReturn(listOf(link))
        val formDefinition = FormIoFormDefinition(
            formDefinitionId,
            "form",
            FORM_DEFINITION,
            null,
            false
        )
        whenever(formDefinitionService.getFormDefinitionById(formDefinitionId)).thenReturn(Optional.of(formDefinition))
    }

    private fun submission(): ObjectNode = objectMapper.readTree(
        """
        {
          "top": "<b>evil</b>",
          "keep": "kept",
          "container": { "a": "A", "p": "<b>evil</b>" },
          "grid": [ { "name": "n", "p": "<b>evil</b>" } ]
        }
        """
    ) as ObjectNode

    private fun assertSanitized(content: ObjectNode) {
        assertFalse(content.has("top"))
        assertEquals("kept", content["keep"].asText())
        assertFalse(content["container"].has("p"))
        assertEquals("A", content["container"]["a"].asText())
        assertFalse(content["grid"][0].has("p"))
        assertEquals("n", content["grid"][0]["name"].asText())
    }

    companion object {
        private const val TASK_ID = "taskInstanceId"
        private const val FORM_DEFINITION = """
            {
              "components": [
                { "key": "top", "type": "valtimo-mail-preview", "input": true },
                { "key": "keep", "type": "textfield", "input": true },
                { "key": "container", "type": "container", "input": true, "components": [
                  { "key": "a", "type": "textfield", "input": true },
                  { "key": "p", "type": "valtimo-mail-preview", "input": true }
                ]},
                { "key": "grid", "type": "datagrid", "input": true, "components": [
                  { "key": "name", "type": "textfield", "input": true },
                  { "key": "p", "type": "valtimo-mail-preview", "input": true }
                ]},
                { "key": "mails", "type": "datagrid", "input": true, "components": [
                  { "key": "subject", "type": "textfield", "input": true },
                  { "key": "mailPreview.ontvangstbevestiging", "type": "valtimo-mail-preview", "input": true }
                ]}
              ]
            }
        """
    }
}
