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

package com.ritense.processdocument.web

import com.ritense.processdocument.service.CaseTaskListSearchService
import com.ritense.valtimo.operaton.dto.TaskExtended
import com.ritense.valtimo.service.OperatonTaskService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import java.util.UUID
import kotlin.test.assertEquals

class TaskListResourceTest {

    lateinit var service: CaseTaskListSearchService
    lateinit var operatonTaskService: OperatonTaskService
    lateinit var taskListResource: TaskListResource

    @BeforeEach
    fun setUp() {
        service = mock()
        operatonTaskService = mock()
        taskListResource = TaskListResource(service, operatonTaskService)
    }

    @Test
    fun `should delegate to operatonTaskService for unfiltered task list`() {
        val task = createTaskExtended(businessKey = UUID.randomUUID().toString())

        whenever(operatonTaskService.findTasksFiltered(any(), any<Pageable>()))
            .thenReturn(PageImpl(listOf(task)))

        val response = taskListResource.getTaskList(
            OperatonTaskService.TaskFilter.ALL,
            com.ritense.processdocument.web.request.TaskListSearchDto(null),
            Pageable.unpaged()
        )

        verify(operatonTaskService).findTasksFiltered(any(), any<Pageable>())
        val page = response.body!!
        assertEquals(1, page.content.size)
    }

    @Test
    fun `should delegate to case search service when caseDefinitionKey is set`() {
        val caseDefinitionKey = "my-case"

        whenever(service.getTasksByCaseDefinition(any(), any(), any()))
            .thenReturn(PageImpl(emptyList()))

        val response = taskListResource.getTaskList(
            OperatonTaskService.TaskFilter.ALL,
            com.ritense.processdocument.web.request.TaskListSearchDto(caseDefinitionKey),
            Pageable.unpaged()
        )

        verify(service).getTasksByCaseDefinition(any(), any(), any())
        val page = response.body!!
        assertEquals(0, page.content.size)
    }

    private fun createTaskExtended(businessKey: String?): TaskExtended {
        return TaskExtended(
            id = UUID.randomUUID().toString(),
            name = "test task",
            assignee = null,
            created = null,
            due = null,
            followUp = null,
            lastUpdated = null,
            delegationState = null,
            description = null,
            executionId = null,
            owner = null,
            parentTaskId = null,
            priority = 0,
            processDefinitionId = null,
            processInstanceId = null,
            taskDefinitionKey = null,
            caseExecutionId = null,
            caseInstanceId = null,
            caseDefinitionId = null,
            suspended = false,
            tenantId = null,
            businessKey = businessKey,
            caseDocumentId = businessKey,
            processDefinitionKey = null,
            valtimoAssignee = null,
            context = null
        )
    }
}
