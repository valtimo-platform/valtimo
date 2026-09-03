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
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case.domain.group.CaseDefinitionGroup
import com.ritense.case.domain.group.CaseDefinitionGroupMember
import com.ritense.case.domain.group.CaseDefinitionGroupMemberId
import com.ritense.case.domain.group.GroupListColumn
import com.ritense.case.domain.group.GroupListColumnId
import com.ritense.case.domain.group.GroupQuickSearch
import com.ritense.case.repository.CaseDefinitionGroupMemberRepository
import com.ritense.case.repository.CaseDefinitionGroupRepository
import com.ritense.case.repository.GroupListColumnPathMappingRepository
import com.ritense.case.repository.GroupListColumnRepository
import com.ritense.case.repository.GroupQuickSearchRepository
import com.ritense.case.repository.GroupSearchFieldPathMappingRepository
import com.ritense.case.repository.GroupSearchFieldRepository
import com.ritense.case.web.rest.dto.CaseDefinitionQuickSearchDto
import com.ritense.document.domain.InternalCaseStatus
import com.ritense.document.domain.InternalCaseStatusColor
import com.ritense.document.domain.InternalCaseStatusId
import com.ritense.document.domain.search.SearchWithConfigRequest
import com.ritense.document.service.DocumentSearchService
import com.ritense.document.service.InternalCaseStatusService
import com.ritense.search.domain.DisplayType
import com.ritense.search.domain.EmptyDisplayTypeParameter
import com.ritense.valueresolver.ValueResolverService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class GroupCaseInstanceServiceTest {

    lateinit var groupRepository: CaseDefinitionGroupRepository
    lateinit var memberRepository: CaseDefinitionGroupMemberRepository
    lateinit var listColumnRepository: GroupListColumnRepository
    lateinit var listColumnPathMappingRepository: GroupListColumnPathMappingRepository
    lateinit var searchFieldRepository: GroupSearchFieldRepository
    lateinit var searchFieldPathMappingRepository: GroupSearchFieldPathMappingRepository
    lateinit var quickSearchRepository: GroupQuickSearchRepository
    lateinit var documentSearchService: DocumentSearchService
    lateinit var valueResolverService: ValueResolverService
    lateinit var authorizationService: AuthorizationService
    lateinit var caseDefinitionService: CaseDefinitionService
    lateinit var internalCaseStatusService: InternalCaseStatusService
    lateinit var service: GroupCaseInstanceService

    @BeforeEach
    fun setUp() {
        groupRepository = mock()
        memberRepository = mock()
        listColumnRepository = mock()
        listColumnPathMappingRepository = mock()
        searchFieldRepository = mock()
        searchFieldPathMappingRepository = mock()
        quickSearchRepository = mock()
        documentSearchService = mock()
        valueResolverService = mock()
        authorizationService = mock()
        caseDefinitionService = mock()
        internalCaseStatusService = mock()

        service = GroupCaseInstanceService(
            groupRepository,
            memberRepository,
            listColumnRepository,
            listColumnPathMappingRepository,
            searchFieldRepository,
            searchFieldPathMappingRepository,
            quickSearchRepository,
            documentSearchService,
            valueResolverService,
            authorizationService,
            caseDefinitionService,
            internalCaseStatusService
        )
    }

    @Test
    fun `should get group by key`() {
        val groupKey = "test_group"
        val group = createTestGroup(groupKey)

        whenever(groupRepository.findById(groupKey)).thenReturn(Optional.of(group))

        val result = service.getGroup(groupKey)

        assertEquals(groupKey, result.key)
        assertEquals("Test Group", result.title)
    }

    @Test
    fun `should return empty list when no accessible groups`() {
        whenever(groupRepository.findAllByOrderByOrderAsc()).thenReturn(emptyList())

        val result = service.getAccessibleGroups()

        assertTrue(result.isEmpty())
    }

    @Test
    fun `should get list columns for group`() {
        val groupKey = "test_group"
        val group = createTestGroup(groupKey)
        val column = GroupListColumn(
            id = GroupListColumnId(groupKey = groupKey, columnKey = "name"),
            group = group,
            title = "Name",
            displayType = DisplayType("string", EmptyDisplayTypeParameter()),
            sortable = true,
            defaultSort = null,
            order = 0,
            exportable = true
        )

        whenever(listColumnRepository.findByIdGroupKeyOrderByOrderAsc(groupKey)).thenReturn(listOf(column))

        val result = service.getListColumns(groupKey)

        assertEquals(1, result.size)
        assertEquals("name", result[0].id.columnKey)
    }

    @Test
    fun `should get internal case statuses for group members`() {
        val groupKey = "test_group"
        val statuses = listOf(
            InternalCaseStatus(
                id = InternalCaseStatusId("test-case", "open"),
                title = "Open",
                visibleInCaseListByDefault = true,
                order = 0,
                retentionPeriodInDays = -1,
                color = InternalCaseStatusColor.GRAY
            ),
            InternalCaseStatus(
                id = InternalCaseStatusId("test-case", "closed"),
                title = "Closed",
                visibleInCaseListByDefault = false,
                order = 1,
                retentionPeriodInDays = -1,
                color = InternalCaseStatusColor.GRAY
            )
        )

        mockAccessibleGroup(groupKey)
        whenever(internalCaseStatusService.getInternalCaseStatusesByKeys(listOf("test-case"))).thenReturn(statuses)

        val result = service.getInternalCaseStatuses(groupKey)

        assertEquals(2, result.size)
        assertEquals("open", result[0].id.key)
        assertEquals("closed", result[1].id.key)
    }

    @Test
    fun `should return empty list when no accessible members for internal statuses`() {
        val groupKey = "test_group"

        whenever(memberRepository.findByIdGroupKeyOrderByOrderAsc(groupKey)).thenReturn(emptyList())

        val result = service.getInternalCaseStatuses(groupKey)

        assertTrue(result.isEmpty())
        verify(internalCaseStatusService).getInternalCaseStatusesByKeys(emptyList())
    }

    @Test
    fun `should return empty page when no accessible members`() {
        val groupKey = "test_group"

        whenever(memberRepository.findByIdGroupKeyOrderByOrderAsc(groupKey)).thenReturn(emptyList())

        val searchRequest = SearchWithConfigRequest()
        val result = service.search(groupKey, searchRequest, Pageable.ofSize(10))

        assertEquals(0, result.totalElements)
        assertTrue(result.content.isEmpty())
    }

    @Test
    fun `should get quick search list for group and user`() {
        val groupKey = "test_group"
        val userId = "user123"
        val quickSearches = listOf(
            GroupQuickSearch(
                id = UUID.randomUUID(),
                queryPath = "?status=open",
                title = "Open Cases",
                groupKey = groupKey,
                userId = userId
            ),
            GroupQuickSearch(
                id = UUID.randomUUID(),
                queryPath = "?assignee=me",
                title = "My Cases",
                groupKey = groupKey,
                userId = userId
            )
        )

        mockAccessibleGroup(groupKey)
        whenever(quickSearchRepository.findAllByGroupKeyAndUserId(groupKey, userId)).thenReturn(quickSearches)

        val result = service.getQuickSearchList(groupKey, userId)

        assertEquals(2, result.size)
        assertEquals("Open Cases", result[0].title)
        assertEquals("My Cases", result[1].title)
    }

    @Test
    fun `should store new quick search`() {
        val groupKey = "test_group"
        val userId = "user123"
        val request = CaseDefinitionQuickSearchDto("?status=open", "Open Cases")

        mockAccessibleGroup(groupKey)
        whenever(quickSearchRepository.existsByGroupKeyAndUserIdAndTitle(groupKey, userId, request.title))
            .thenReturn(false)

        service.storeQuickSearch(groupKey, request, userId)

        verify(quickSearchRepository, times(1)).save(any())
    }

    @Test
    fun `should throw when storing duplicate quick search`() {
        val groupKey = "test_group"
        val userId = "user123"
        val request = CaseDefinitionQuickSearchDto("?status=open", "Open Cases")

        whenever(quickSearchRepository.existsByGroupKeyAndUserIdAndTitle(groupKey, userId, request.title))
            .thenReturn(true)

        assertThrows<IllegalArgumentException> {
            service.storeQuickSearch(groupKey, request, userId)
        }

        verify(quickSearchRepository, never()).save(any())
    }

    @Test
    fun `should delete existing quick search`() {
        val groupKey = "test_group"
        val userId = "user123"
        val title = "Open Cases"

        mockAccessibleGroup(groupKey)
        whenever(quickSearchRepository.existsByGroupKeyAndUserIdAndTitle(groupKey, userId, title))
            .thenReturn(true)

        service.deleteQuickSearch(groupKey, userId, title)

        verify(quickSearchRepository, times(1)).deleteByGroupKeyAndUserIdAndTitle(groupKey, userId, title)
    }

    @Test
    fun `should throw when deleting non-existing quick search`() {
        val groupKey = "test_group"
        val userId = "user123"
        val title = "Nonexistent"

        whenever(quickSearchRepository.existsByGroupKeyAndUserIdAndTitle(groupKey, userId, title))
            .thenReturn(false)

        assertThrows<IllegalArgumentException> {
            service.deleteQuickSearch(groupKey, userId, title)
        }

        verify(quickSearchRepository, never()).deleteByGroupKeyAndUserIdAndTitle(any(), any(), any())
    }

    private fun createTestGroup(key: String): CaseDefinitionGroup {
        return CaseDefinitionGroup(
            key = key,
            title = "Test Group",
            description = null,
            order = 0,
            createdBy = "admin"
        )
    }

    private fun mockAccessibleGroup(groupKey: String) {
        val group = createTestGroup(groupKey)
        val member = CaseDefinitionGroupMember(
            id = CaseDefinitionGroupMemberId(groupKey = groupKey, caseDefinitionKey = "test-case"),
            group = group,
            order = 0
        )
        val caseDefinition = mock<CaseDefinition>()

        whenever(memberRepository.findByIdGroupKeyOrderByOrderAsc(groupKey)).thenReturn(listOf(member))
        whenever(caseDefinitionService.getActiveCaseDefinition("test-case")).thenReturn(caseDefinition)
        whenever(authorizationService.hasPermission(any<AuthorizationRequest<CaseDefinition>>())).thenReturn(true)
    }
}
