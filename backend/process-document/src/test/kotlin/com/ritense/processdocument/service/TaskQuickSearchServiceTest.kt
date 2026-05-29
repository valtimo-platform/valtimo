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
import com.ritense.case.service.CaseDefinitionService
import com.ritense.processdocument.domain.TaskQuickSearch
import com.ritense.processdocument.repository.TaskQuickSearchRepository
import com.ritense.processdocument.web.request.TaskQuickSearchDto
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import kotlin.test.assertEquals

class TaskQuickSearchServiceTest {

    private lateinit var service: TaskQuickSearchService
    private lateinit var taskQuickSearchRepository: TaskQuickSearchRepository
    private lateinit var caseDefinitionService: CaseDefinitionService
    private lateinit var authorizationService: AuthorizationService

    @BeforeEach
    fun setUp() {
        taskQuickSearchRepository = mock()
        caseDefinitionService = mock()
        authorizationService = mock()
        service = TaskQuickSearchService(
            taskQuickSearchRepository,
            caseDefinitionService,
            authorizationService,
        )
    }

    @Test
    fun `should store quick search`() {
        whenever(
            taskQuickSearchRepository.existsByCaseDefinitionKeyAndUserIdAndTitle(
                CASE_DEFINITION_KEY, USER_ID, TITLE
            )
        ).thenReturn(false)

        service.storeQuickSearch(
            CASE_DEFINITION_KEY,
            TaskQuickSearchDto(QUERY_PATH, TITLE),
            USER_ID
        )

        verify(taskQuickSearchRepository, times(1)).save(any())
    }

    @Test
    fun `should fail to store quick search when title already exists`() {
        whenever(
            taskQuickSearchRepository.existsByCaseDefinitionKeyAndUserIdAndTitle(
                CASE_DEFINITION_KEY, USER_ID, TITLE
            )
        ).thenReturn(true)

        assertThrows<IllegalArgumentException> {
            service.storeQuickSearch(
                CASE_DEFINITION_KEY,
                TaskQuickSearchDto(QUERY_PATH, TITLE),
                USER_ID
            )
        }

        verify(taskQuickSearchRepository, never()).save(any())
    }

    @Test
    fun `should delete quick search`() {
        whenever(
            taskQuickSearchRepository.existsByCaseDefinitionKeyAndUserIdAndTitle(
                CASE_DEFINITION_KEY, USER_ID, TITLE
            )
        ).thenReturn(true)

        service.deleteQuickSearch(CASE_DEFINITION_KEY, USER_ID, TITLE)

        verify(taskQuickSearchRepository, times(1))
            .deleteByCaseDefinitionKeyAndUserIdAndTitle(CASE_DEFINITION_KEY, USER_ID, TITLE)
    }

    @Test
    fun `should fail to delete quick search when it does not exist`() {
        whenever(
            taskQuickSearchRepository.existsByCaseDefinitionKeyAndUserIdAndTitle(
                CASE_DEFINITION_KEY, USER_ID, TITLE
            )
        ).thenReturn(false)

        assertThrows<IllegalArgumentException> {
            service.deleteQuickSearch(CASE_DEFINITION_KEY, USER_ID, TITLE)
        }

        verify(taskQuickSearchRepository, never())
            .deleteByCaseDefinitionKeyAndUserIdAndTitle(any(), any(), any())
    }

    @Test
    fun `should get quick search list`() {
        val quickSearchItems = listOf(
            TaskQuickSearch(queryPath = QUERY_PATH, title = TITLE, caseDefinitionKey = CASE_DEFINITION_KEY, userId = USER_ID),
            TaskQuickSearch(queryPath = "other-path", title = "other-title", caseDefinitionKey = CASE_DEFINITION_KEY, userId = USER_ID),
        )
        whenever(
            taskQuickSearchRepository.findAllByCaseDefinitionKeyAndUserId(CASE_DEFINITION_KEY, USER_ID)
        ).thenReturn(quickSearchItems)

        val result = service.getQuickSearchList(CASE_DEFINITION_KEY, USER_ID)

        assertEquals(2, result.size)
        assertEquals(TITLE, result[0].title)
        assertEquals(QUERY_PATH, result[0].queryPath)
    }

    @Test
    fun `should return empty list when no quick searches exist`() {
        whenever(
            taskQuickSearchRepository.findAllByCaseDefinitionKeyAndUserId(CASE_DEFINITION_KEY, USER_ID)
        ).thenReturn(emptyList())

        val result = service.getQuickSearchList(CASE_DEFINITION_KEY, USER_ID)

        assertEquals(0, result.size)
    }

    companion object {
        private const val CASE_DEFINITION_KEY = "my-case-definition"
        private const val USER_ID = "test-user"
        private const val TITLE = "my-saved-search"
        private const val QUERY_PATH = "search=eyJmaWVsZCI6InZhbHVlIn0%3D&selectedTaskType=MINE"
    }
}
