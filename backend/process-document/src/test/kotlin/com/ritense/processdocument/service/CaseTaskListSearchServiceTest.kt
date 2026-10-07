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

package com.ritense.processdocument.service

import com.ritense.authorization.AuthorizationService
import com.ritense.case.domain.TaskListColumn
import com.ritense.case.domain.TaskListColumnId
import com.ritense.case.repository.TaskListColumnRepository
import com.ritense.processdocument.domain.CaseTask
import com.ritense.processdocument.tasksearch.AdvancedSearchRequest
import com.ritense.processdocument.tasksearch.SearchWithConfigRequest
import com.ritense.search.domain.DisplayType
import com.ritense.search.domain.EmptyDisplayTypeParameter
import com.ritense.search.service.SearchFieldV2Service
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.database.QueryDialectHelper
import com.ritense.valtimo.service.OperatonTaskService.TaskFilter
import com.ritense.valtimo.task.service.UserTaskOpenedStatusService
import com.ritense.valueresolver.ValueResolverService
import jakarta.persistence.EntityManager
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.spy
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.security.core.context.SecurityContextHolder
import java.time.LocalDateTime
import java.util.UUID

class CaseTaskListSearchServiceTest {

    private val entityManager: EntityManager = mock()
    private val valueResolverService: ValueResolverService = mock()
    private val taskListColumnRepository: TaskListColumnRepository = mock()
    private val userManagementService: UserManagementService = mock()
    private val authorizationService: AuthorizationService = mock()
    private val searchFieldV2Service: SearchFieldV2Service = mock()
    private val queryDialectHelper: QueryDialectHelper = mock()
    private val userTaskOpenedStatusService: UserTaskOpenedStatusService = mock()

    private lateinit var service: CaseTaskListSearchService

    private val documentId = UUID.randomUUID()
    private val caseTask = CaseTask(
        taskId = "task-1",
        createTime = LocalDateTime.of(2026, 1, 1, 12, 0),
        name = "My task",
        assignee = null,
        dueDate = null,
        processInstanceId = "process-1",
        documentInstanceId = documentId
    )

    @BeforeEach
    fun setUp() {
        SecurityContextHolder.clearContext()
        service = spy(
            CaseTaskListSearchService(
                entityManager,
                valueResolverService,
                taskListColumnRepository,
                userManagementService,
                authorizationService,
                searchFieldV2Service,
                queryDialectHelper,
                userTaskOpenedStatusService
            )
        )
        whenever(taskListColumnRepository.findByIdCaseDefinitionNameOrderByOrderAsc(KEY)).thenReturn(
            listOf(
                column("street", "doc:street", 1),
                column("identificatie", "zaak:identificatie", 2),
                column("name", "task:name", 3)
            )
        )
        whenever(valueResolverService.resolveValuesOrNull(documentId.toString(), listOf("doc:street", "zaak:identificatie")))
            .thenReturn(mapOf("doc:street" to "Funenpark", "zaak:identificatie" to null))
    }

    @AfterEach
    fun tearDown() {
        SecurityContextHolder.clearContext()
    }

    @Test
    fun `getTasksByCaseDefinition resolves non-task paths with resolveValuesOrNull`() {
        doReturn(PageImpl(listOf(caseTask))).whenever(service).search(eq(KEY), any<AdvancedSearchRequest>(), any())

        val result = service.getTasksByCaseDefinition(KEY, TaskFilter.ALL, PageRequest.of(0, 10))

        assertRow(result.content.single().items.associate { it.key to it.value })
        verifyResolution()
    }

    @Test
    fun `searchTaskListRows resolves non-task paths with resolveValuesOrNull`() {
        doReturn(PageImpl(listOf(caseTask))).whenever(service).search(eq(KEY), any<SearchWithConfigRequest>(), any())

        val result = service.searchTaskListRows(KEY, SearchWithConfigRequest(), PageRequest.of(0, 10))

        assertRow(result.content.single().items.associate { it.key to it.value })
        verifyResolution()
    }

    private fun assertRow(items: Map<String, Any?>) {
        assertEquals(setOf("street", "identificatie", "name"), items.keys)
        assertEquals("Funenpark", items["street"])
        assertEquals(null, items["identificatie"])
        assertEquals("My task", items["name"])
    }

    private fun verifyResolution() {
        verify(valueResolverService).resolveValuesOrNull(documentId.toString(), listOf("doc:street", "zaak:identificatie"))
        verify(valueResolverService, never()).resolveValues(any<String>(), any())
    }

    private fun column(key: String, path: String, order: Int) = TaskListColumn(
        id = TaskListColumnId(KEY, key),
        title = key,
        path = path,
        displayType = DisplayType("string", EmptyDisplayTypeParameter()),
        sortable = false,
        defaultSort = null,
        order = order
    )

    companion object {
        private const val KEY = "test-case"
    }
}
