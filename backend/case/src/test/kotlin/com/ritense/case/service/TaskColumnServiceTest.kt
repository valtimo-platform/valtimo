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

package com.ritense.case.service

import com.ritense.authorization.AuthorizationService
import com.ritense.case.domain.TaskListColumn
import com.ritense.case.domain.TaskListColumnId
import com.ritense.case.repository.HiddenTaskListColumnRepository
import com.ritense.case.repository.TaskListColumnRepository
import com.ritense.case.web.rest.dto.HiddenTaskListColumnDto
import com.ritense.document.service.DocumentDefinitionService
import com.ritense.search.domain.DisplayType
import com.ritense.search.domain.EmptyDisplayTypeParameter
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valueresolver.ValueResolverService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyList
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional

class TaskColumnServiceTest {
    lateinit var taskListColumnRepository: TaskListColumnRepository
    lateinit var hiddenTaskListColumnRepository: HiddenTaskListColumnRepository
    lateinit var documentDefinitionService: DocumentDefinitionService
    lateinit var valueResolverService: ValueResolverService
    lateinit var authorizationService: AuthorizationService
    lateinit var caseDefinitionChecker: CaseDefinitionChecker
    lateinit var service: TaskColumnService

    @BeforeEach
    fun setUp() {
        taskListColumnRepository = mock()
        hiddenTaskListColumnRepository = mock()
        documentDefinitionService = mock()
        valueResolverService = mock()
        authorizationService = mock()
        caseDefinitionChecker = mock()
        service = TaskColumnService(
            taskListColumnRepository,
            hiddenTaskListColumnRepository,
            documentDefinitionService,
            valueResolverService,
            authorizationService,
            caseDefinitionChecker
        )
    }

    @Test
    fun `should save hidden task list columns when columns exist`() {
        val caseDefinitionName = "aKey"
        val userId = "user1"
        val columnKey = "myColumn"
        val hiddenDtos = listOf(HiddenTaskListColumnDto(columnKey))
        val taskListColumn = TaskListColumn(
            id = TaskListColumnId(caseDefinitionName, columnKey),
            title = "My Column",
            path = "doc:myField",
            displayType = DisplayType("text", EmptyDisplayTypeParameter()),
            sortable = false,
            defaultSort = null,
            order = 0
        )

        whenever(documentDefinitionService.findActiveByName(caseDefinitionName))
            .thenReturn(Optional.of(mock()))
        whenever(taskListColumnRepository.findByIdCaseDefinitionNameAndIdKey(caseDefinitionName, columnKey))
            .thenReturn(taskListColumn)

        service.saveHiddenTaskListColumns(caseDefinitionName, hiddenDtos, userId)

        verify(hiddenTaskListColumnRepository).deleteAllByUserIdAndTaskListColumnIdCaseDefinitionName(
            userId,
            caseDefinitionName
        )
        verify(hiddenTaskListColumnRepository).saveAll(anyList())
    }

    @Test
    fun `should save empty list when columns do not exist`() {
        val caseDefinitionName = "aKey"
        val userId = "user1"
        val columnKey = "nonExistent"
        val hiddenDtos = listOf(HiddenTaskListColumnDto(columnKey))

        whenever(documentDefinitionService.findActiveByName(caseDefinitionName))
            .thenReturn(Optional.of(mock()))
        whenever(taskListColumnRepository.findByIdCaseDefinitionNameAndIdKey(caseDefinitionName, columnKey))
            .thenReturn(null)

        service.saveHiddenTaskListColumns(caseDefinitionName, hiddenDtos, userId)

        verify(hiddenTaskListColumnRepository).deleteAllByUserIdAndTaskListColumnIdCaseDefinitionName(
            userId,
            caseDefinitionName
        )
        verify(hiddenTaskListColumnRepository).saveAll(emptyList())
    }

    @Test
    fun `should delete hidden columns when deleting a task list column`() {
        val caseDefinitionName = "aKey"
        val columnKey = "myColumn"
        val taskListColumn = TaskListColumn(
            id = TaskListColumnId(caseDefinitionName, columnKey),
            title = "My Column",
            path = "doc:myField",
            displayType = DisplayType("text", EmptyDisplayTypeParameter()),
            sortable = false,
            defaultSort = null,
            order = 0
        )

        whenever(documentDefinitionService.findActiveByName(caseDefinitionName))
            .thenReturn(Optional.of(mock()))
        whenever(taskListColumnRepository.findByIdCaseDefinitionNameAndIdKey(caseDefinitionName, columnKey))
            .thenReturn(taskListColumn)

        service.deleteTaskListColumn(caseDefinitionName, columnKey)

        verify(hiddenTaskListColumnRepository).deleteAllByTaskListColumnIdCaseDefinitionNameAndTaskListColumnIdKey(
            caseDefinitionName,
            columnKey
        )
        verify(taskListColumnRepository).delete(taskListColumn)
    }
}
