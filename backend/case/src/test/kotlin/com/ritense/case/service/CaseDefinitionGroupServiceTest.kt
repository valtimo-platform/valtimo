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
import com.ritense.case.domain.group.CaseDefinitionGroupMemberId
import com.ritense.case.repository.CaseDefinitionGroupMemberRepository
import com.ritense.case.repository.CaseDefinitionGroupRepository
import com.ritense.case.repository.GroupListColumnPathMappingRepository
import com.ritense.case.repository.GroupListColumnRepository
import com.ritense.case.repository.GroupSearchFieldPathMappingRepository
import com.ritense.case.repository.GroupSearchFieldRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import com.ritense.authorization.request.EntityAuthorizationRequest
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
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
        authorizationService = mock()

        service = CaseDefinitionGroupService(
            groupRepository,
            memberRepository,
            listColumnRepository,
            listColumnPathMappingRepository,
            searchFieldRepository,
            searchFieldPathMappingRepository,
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
}
