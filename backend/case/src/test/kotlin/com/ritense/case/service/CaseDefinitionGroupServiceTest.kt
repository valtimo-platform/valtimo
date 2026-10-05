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
import com.ritense.case.domain.group.CaseDefinitionGroup
import com.ritense.case.domain.group.CaseDefinitionGroupMember
import com.ritense.case.domain.ColumnDefaultSort
import com.ritense.case.domain.group.CaseDefinitionGroupMemberId
import com.ritense.case.domain.group.GroupListColumn
import com.ritense.case.domain.group.GroupListColumnId
import com.ritense.case.domain.group.GroupListColumnPathMapping
import com.ritense.case.domain.group.GroupListColumnPathMappingId
import com.ritense.case.exception.InvalidGroupListColumnSortException
import com.ritense.case.web.rest.dto.GroupListColumnDto
import com.ritense.case.web.rest.dto.GroupListColumnPathMappingDto
import com.ritense.search.domain.DisplayType
import com.ritense.search.domain.EmptyDisplayTypeParameter
import com.ritense.case.repository.CaseDefinitionGroupMemberRepository
import com.ritense.case.repository.CaseDefinitionGroupRepository
import com.ritense.case.repository.GroupListColumnPathMappingRepository
import com.ritense.case.repository.GroupListColumnRepository
import com.ritense.case.repository.GroupSearchFieldPathMappingRepository
import com.ritense.case.repository.GroupSearchFieldRepository
import com.ritense.case_.repository.CaseDefinitionRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import com.ritense.authorization.request.EntityAuthorizationRequest
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.ZonedDateTime
import java.util.Optional
import kotlin.test.assertEquals

class CaseDefinitionGroupServiceTest {

    lateinit var groupRepository: CaseDefinitionGroupRepository
    lateinit var memberRepository: CaseDefinitionGroupMemberRepository
    lateinit var listColumnRepository: GroupListColumnRepository
    lateinit var listColumnPathMappingRepository: GroupListColumnPathMappingRepository
    lateinit var searchFieldRepository: GroupSearchFieldRepository
    lateinit var searchFieldPathMappingRepository: GroupSearchFieldPathMappingRepository
    lateinit var caseDefinitionRepository: CaseDefinitionRepository
    lateinit var authorizationService: AuthorizationService
    lateinit var service: CaseDefinitionGroupService

    @BeforeEach
    fun setUp() {
        groupRepository = mock()
        memberRepository = mock()
        listColumnRepository = mock()
        listColumnPathMappingRepository = mock()
        searchFieldRepository = mock()
        searchFieldPathMappingRepository = mock()
        caseDefinitionRepository = mock()
        authorizationService = mock()

        service = CaseDefinitionGroupService(
            groupRepository,
            memberRepository,
            listColumnRepository,
            listColumnPathMappingRepository,
            searchFieldRepository,
            searchFieldPathMappingRepository,
            caseDefinitionRepository,
            authorizationService
        )
    }

    @Test
    fun `should create group with generated key`() {
        val title = "My Test Group"
        val description = "A test group description"

        whenever(groupRepository.findMaxOrder()).thenReturn(0)
        whenever(groupRepository.existsByKey("my_test_group")).thenReturn(false)
        whenever(groupRepository.save(any<CaseDefinitionGroup>())).thenAnswer { it.arguments[0] }

        val result = service.createGroup(title, description)

        val captor = argumentCaptor<CaseDefinitionGroup>()
        verify(groupRepository).save(captor.capture())

        assertEquals("my_test_group", captor.firstValue.key)
        assertEquals(title, captor.firstValue.title)
        assertEquals(description, captor.firstValue.description)
        assertEquals(1, captor.firstValue.order)
    }

    @Test
    fun `should generate unique key when key already exists`() {
        val title = "Test Group"

        whenever(groupRepository.findMaxOrder()).thenReturn(0)
        whenever(groupRepository.existsByKey("test_group")).thenReturn(true)
        whenever(groupRepository.existsByKey("test_group_2")).thenReturn(false)
        whenever(groupRepository.save(any<CaseDefinitionGroup>())).thenAnswer { it.arguments[0] }

        service.createGroup(title, null)

        val captor = argumentCaptor<CaseDefinitionGroup>()
        verify(groupRepository).save(captor.capture())

        assertEquals("test_group_2", captor.firstValue.key)
    }

    @Test
    fun `should get group by key`() {
        val groupKey = "test_group"
        val group = CaseDefinitionGroup(
            key = groupKey,
            title = "Test Group",
            description = null,
            order = 0,
            createdBy = "admin",
            createdOn = ZonedDateTime.now()
        )

        whenever(groupRepository.findById(groupKey)).thenReturn(Optional.of(group))

        val result = service.getGroup(groupKey)

        assertEquals(groupKey, result.key)
        assertEquals("Test Group", result.title)
    }

    @Test
    fun `should add member to group`() {
        val groupKey = "test_group"
        val caseDefinitionKey = "my_case"
        val group = CaseDefinitionGroup(
            key = groupKey,
            title = "Test Group",
            description = null,
            order = 0
        )

        whenever(caseDefinitionRepository.existsByIdKey(caseDefinitionKey)).thenReturn(true)
        whenever(groupRepository.findById(groupKey)).thenReturn(Optional.of(group))
        whenever(memberRepository.findMaxOrderByGroupKey(groupKey)).thenReturn(0)
        whenever(memberRepository.save(any<CaseDefinitionGroupMember>())).thenAnswer { it.arguments[0] }

        val result = service.addMember(groupKey, caseDefinitionKey)

        val captor = argumentCaptor<CaseDefinitionGroupMember>()
        verify(memberRepository).save(captor.capture())

        assertEquals(groupKey, captor.firstValue.id.groupKey)
        assertEquals(caseDefinitionKey, captor.firstValue.id.caseDefinitionKey)
        assertEquals(1, captor.firstValue.order)
    }

    @Test
    fun `should throw when adding member with non-existent case definition`() {
        val groupKey = "test_group"
        val caseDefinitionKey = "non_existent_case"

        whenever(caseDefinitionRepository.existsByIdKey(caseDefinitionKey)).thenReturn(false)

        val exception = assertThrows<IllegalArgumentException> {
            service.addMember(groupKey, caseDefinitionKey)
        }

        assertEquals("Case definition with key '$caseDefinitionKey' does not exist", exception.message)
        verify(memberRepository, never()).save(any())
    }

    @Test
    fun `should delete group`() {
        val groupKey = "test_group"

        whenever(groupRepository.findAllByOrderByOrderAsc()).thenReturn(emptyList())

        service.deleteGroup(groupKey)

        verify(groupRepository).deleteById(groupKey)
    }

    @Test
    fun `should update group`() {
        val groupKey = "test_group"
        val newTitle = "Updated Title"
        val newDescription = "Updated description"
        val group = CaseDefinitionGroup(
            key = groupKey,
            title = "Test Group",
            description = null,
            order = 0
        )

        whenever(groupRepository.findById(groupKey)).thenReturn(Optional.of(group))
        whenever(groupRepository.save(any<CaseDefinitionGroup>())).thenAnswer { it.arguments[0] }

        val result = service.updateGroup(groupKey, newTitle, newDescription)

        val captor = argumentCaptor<CaseDefinitionGroup>()
        verify(groupRepository).save(captor.capture())

        assertEquals(newTitle, captor.firstValue.title)
        assertEquals(newDescription, captor.firstValue.description)
    }

    @Test
    fun `should reject sortable column with document path`() {
        mockGroup()

        assertThrows<InvalidGroupListColumnSortException> {
            service.updateListColumns(GROUP_KEY, listOf(dto("a", true, null, mapping("doc:street"))))
        }
        verify(listColumnRepository, never()).deleteByIdGroupKey(any())
    }

    @Test
    fun `should reject sortable column with mixed case paths`() {
        mockGroup()

        assertThrows<InvalidGroupListColumnSortException> {
            service.updateListColumns(
                GROUP_KEY,
                listOf(dto("a", true, null, mapping("case:createdOn", "x"), mapping("case:modifiedOn", "y")))
            )
        }
    }

    @Test
    fun `should reject sortable column with non whitelisted case field`() {
        mockGroup()

        assertThrows<InvalidGroupListColumnSortException> {
            service.updateListColumns(GROUP_KEY, listOf(dto("a", true, null, mapping("case:assignedTeamKey"))))
        }
    }

    @Test
    fun `should reject default sort without sortable`() {
        mockGroup()

        assertThrows<InvalidGroupListColumnSortException> {
            service.updateListColumns(
                GROUP_KEY,
                listOf(dto("a", false, ColumnDefaultSort.ASC, mapping("case:createdOn")))
            )
        }
    }

    @Test
    fun `should reject two default sorts`() {
        mockGroup()

        assertThrows<InvalidGroupListColumnSortException> {
            service.updateListColumns(
                GROUP_KEY,
                listOf(
                    dto("a", true, ColumnDefaultSort.ASC, mapping("case:createdOn")),
                    dto("b", true, ColumnDefaultSort.DESC, mapping("case:modifiedOn"))
                )
            )
        }
    }

    @Test
    fun `should accept valid sortable case column`() {
        mockGroup()
        whenever(listColumnRepository.save(any<GroupListColumn>())).thenAnswer { it.arguments[0] }

        val result = service.updateListColumns(
            GROUP_KEY,
            listOf(
                dto("a", true, ColumnDefaultSort.ASC, mapping("case:createdOn", "x"), mapping("case:createdOn", "y")),
                dto("b", false, null, mapping("doc:street"))
            )
        )

        assertEquals(2, result.size)
    }

    @Test
    fun `should validate against existing mappings when path mappings are null`() {
        mockGroup()
        val existing = column("a", false)
        whenever(listColumnRepository.findByIdGroupKeyOrderByOrderAsc(GROUP_KEY)).thenReturn(listOf(existing))
        whenever(listColumnPathMappingRepository.findByIdGroupKeyAndIdColumnKey(GROUP_KEY, "a"))
            .thenReturn(listOf(storedMapping("a", "x", "doc:street")))

        assertThrows<InvalidGroupListColumnSortException> {
            service.updateListColumns(GROUP_KEY, listOf(dto("a", true, null)))
        }
    }

    @Test
    fun `should accept sortable column when existing mappings are valid and path mappings are null`() {
        mockGroup()
        val existing = column("a", false)
        whenever(listColumnRepository.findByIdGroupKeyOrderByOrderAsc(GROUP_KEY)).thenReturn(listOf(existing))
        whenever(listColumnPathMappingRepository.findByIdGroupKeyAndIdColumnKey(GROUP_KEY, "a"))
            .thenReturn(listOf(storedMapping("a", "x", "case:sequence")))
        whenever(listColumnRepository.save(any<GroupListColumn>())).thenAnswer { it.arguments[0] }

        val result = service.updateListColumns(GROUP_KEY, listOf(dto("a", true, null)))

        assertEquals(1, result.size)
    }

    @Test
    fun `should reject path mapping change that breaks sortable column`() {
        whenever(listColumnRepository.findById(GroupListColumnId(GROUP_KEY, "a"))).thenReturn(Optional.of(column("a", true)))

        assertThrows<InvalidGroupListColumnSortException> {
            service.updateListColumnPathMappings(GROUP_KEY, "a", listOf(mapping("doc:street")))
        }
        verify(listColumnPathMappingRepository, never()).deleteByIdGroupKeyAndIdColumnKey(any(), any())
    }

    @Test
    fun `should accept any path mapping for non sortable column`() {
        whenever(listColumnRepository.findById(GroupListColumnId(GROUP_KEY, "a"))).thenReturn(Optional.of(column("a", false)))
        whenever(listColumnPathMappingRepository.save(any<GroupListColumnPathMapping>())).thenAnswer { it.arguments[0] }

        val result = service.updateListColumnPathMappings(
            GROUP_KEY, "a", listOf(mapping("doc:street", "x"), mapping("case:createdOn", "y"))
        )

        assertEquals(2, result.size)
    }

    private fun mockGroup() {
        whenever(groupRepository.findById(GROUP_KEY)).thenReturn(
            Optional.of(CaseDefinitionGroup(key = GROUP_KEY, title = "Test Group", description = null, order = 0))
        )
    }

    private fun mapping(path: String, caseDefinitionKey: String = "case") =
        GroupListColumnPathMappingDto(caseDefinitionKey, path)

    private fun dto(
        key: String,
        sortable: Boolean,
        defaultSort: ColumnDefaultSort?,
        vararg mappings: GroupListColumnPathMappingDto
    ) = GroupListColumnDto(
        key = key,
        title = key,
        displayType = DisplayType("string", EmptyDisplayTypeParameter()),
        sortable = sortable,
        defaultSort = defaultSort,
        order = null,
        pathMappings = mappings.takeIf { it.isNotEmpty() }?.toList()
    )

    private fun column(key: String, sortable: Boolean) = GroupListColumn(
        id = GroupListColumnId(GROUP_KEY, key),
        title = key,
        displayType = DisplayType("string", EmptyDisplayTypeParameter()),
        sortable = sortable,
        defaultSort = null,
        order = 0,
        exportable = false
    )

    private fun storedMapping(columnKey: String, caseDefinitionKey: String, path: String) = GroupListColumnPathMapping(
        id = GroupListColumnPathMappingId(GROUP_KEY, columnKey, caseDefinitionKey),
        path = path
    )

    companion object {
        private const val GROUP_KEY = "test_group"
    }
}
