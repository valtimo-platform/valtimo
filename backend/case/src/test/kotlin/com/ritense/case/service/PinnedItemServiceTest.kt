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

import com.ritense.BaseTest
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.case.domain.PinnedItem
import com.ritense.case.domain.PinnedItemType
import com.ritense.case.domain.group.CaseDefinitionGroup
import com.ritense.case.domain.group.CaseDefinitionGroupMember
import com.ritense.case.domain.group.CaseDefinitionGroupMemberId
import com.ritense.case.exception.PinnedItemAccessDeniedException
import com.ritense.case.exception.PinnedItemAlreadyExistsException
import com.ritense.case.exception.PinnedItemNotFoundException
import com.ritense.case.repository.CaseDefinitionGroupRepository
import com.ritense.case.repository.PinnedItemRepository
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.authorization.UserManagementServiceHolder
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.LocalDateTime
import java.util.Optional
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PinnedItemServiceTest : BaseTest() {

    lateinit var pinnedItemRepository: PinnedItemRepository
    lateinit var caseDefinitionService: CaseDefinitionService
    lateinit var groupRepository: CaseDefinitionGroupRepository
    lateinit var authorizationService: AuthorizationService
    lateinit var userManagementService: UserManagementService
    lateinit var service: PinnedItemService

    @BeforeEach
    fun setUp() {
        pinnedItemRepository = mock()
        caseDefinitionService = mock()
        groupRepository = mock()
        authorizationService = mock()
        userManagementService = mock()

        whenever(userManagementService.currentUserId).thenReturn(TEST_USER_ID)
        UserManagementServiceHolder(userManagementService)

        service = PinnedItemService(
            pinnedItemRepository,
            caseDefinitionService,
            groupRepository,
            authorizationService
        )
    }

    // PIN scenarios

    @Test
    fun `pinItem should create pin for case definition when user has VIEW_LIST access`() {
        val caseDefinitionKey = "my-case"
        val caseDefinition = caseDefinition(id = CaseDefinitionId(caseDefinitionKey, "1.0.0"))

        whenever(pinnedItemRepository.existsByUserIdAndItemTypeAndItemKey(TEST_USER_ID, PinnedItemType.CASE_DEFINITION, caseDefinitionKey))
            .thenReturn(false)
        whenever(caseDefinitionService.getActiveCaseDefinition(caseDefinitionKey))
            .thenReturn(caseDefinition)
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<CaseDefinition>>()))
            .thenReturn(true)
        whenever(pinnedItemRepository.save(any<PinnedItem>())).thenAnswer { it.arguments[0] }

        service.pinItem(PinnedItemType.CASE_DEFINITION, caseDefinitionKey)

        val captor = argumentCaptor<PinnedItem>()
        verify(pinnedItemRepository).save(captor.capture())

        assertEquals(TEST_USER_ID, captor.firstValue.userId)
        assertEquals(PinnedItemType.CASE_DEFINITION, captor.firstValue.itemType)
        assertEquals(caseDefinitionKey, captor.firstValue.itemKey)
    }

    @Test
    fun `pinItem should create pin for case definition group when user has access`() {
        val groupKey = "my-group"
        val caseDefinitionKey = "my-case"
        val caseDefinition = caseDefinition(id = CaseDefinitionId(caseDefinitionKey, "1.0.0"))
        val group = createGroup(groupKey, listOf(caseDefinitionKey))

        whenever(pinnedItemRepository.existsByUserIdAndItemTypeAndItemKey(TEST_USER_ID, PinnedItemType.CASE_DEFINITION_GROUP, groupKey))
            .thenReturn(false)
        whenever(groupRepository.findById(groupKey)).thenReturn(Optional.of(group))
        whenever(caseDefinitionService.getActiveCaseDefinition(caseDefinitionKey))
            .thenReturn(caseDefinition)
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<CaseDefinition>>()))
            .thenReturn(true)
        whenever(pinnedItemRepository.save(any<PinnedItem>())).thenAnswer { it.arguments[0] }

        service.pinItem(PinnedItemType.CASE_DEFINITION_GROUP, groupKey)

        val captor = argumentCaptor<PinnedItem>()
        verify(pinnedItemRepository).save(captor.capture())

        assertEquals(TEST_USER_ID, captor.firstValue.userId)
        assertEquals(PinnedItemType.CASE_DEFINITION_GROUP, captor.firstValue.itemType)
        assertEquals(groupKey, captor.firstValue.itemKey)
    }

    @Test
    fun `pinItem should throw when case definition not found`() {
        val caseDefinitionKey = "non-existent-case"

        whenever(pinnedItemRepository.existsByUserIdAndItemTypeAndItemKey(TEST_USER_ID, PinnedItemType.CASE_DEFINITION, caseDefinitionKey))
            .thenReturn(false)
        whenever(caseDefinitionService.getActiveCaseDefinition(caseDefinitionKey))
            .thenReturn(null)

        val exception = assertThrows<PinnedItemNotFoundException> {
            service.pinItem(PinnedItemType.CASE_DEFINITION, caseDefinitionKey)
        }

        assertTrue(exception.message!!.contains("not found"))
        verify(pinnedItemRepository, never()).save(any())
    }

    @Test
    fun `pinItem should throw when case definition group not found`() {
        val groupKey = "non-existent-group"

        whenever(pinnedItemRepository.existsByUserIdAndItemTypeAndItemKey(TEST_USER_ID, PinnedItemType.CASE_DEFINITION_GROUP, groupKey))
            .thenReturn(false)
        whenever(groupRepository.findById(groupKey)).thenReturn(Optional.empty())

        val exception = assertThrows<PinnedItemNotFoundException> {
            service.pinItem(PinnedItemType.CASE_DEFINITION_GROUP, groupKey)
        }

        assertTrue(exception.message!!.contains("not found"))
        verify(pinnedItemRepository, never()).save(any())
    }

    @Test
    fun `pinItem should throw when user lacks VIEW_LIST permission on case definition`() {
        val caseDefinitionKey = "restricted-case"
        val caseDefinition = caseDefinition(id = CaseDefinitionId(caseDefinitionKey, "1.0.0"))

        whenever(pinnedItemRepository.existsByUserIdAndItemTypeAndItemKey(TEST_USER_ID, PinnedItemType.CASE_DEFINITION, caseDefinitionKey))
            .thenReturn(false)
        whenever(caseDefinitionService.getActiveCaseDefinition(caseDefinitionKey))
            .thenReturn(caseDefinition)
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<CaseDefinition>>()))
            .thenReturn(false)

        val exception = assertThrows<PinnedItemAccessDeniedException> {
            service.pinItem(PinnedItemType.CASE_DEFINITION, caseDefinitionKey)
        }

        assertTrue(exception.message!!.contains("Access denied"))
        verify(pinnedItemRepository, never()).save(any())
    }

    @Test
    fun `pinItem should throw when user has no access to group`() {
        val groupKey = "restricted-group"
        val caseDefinitionKey = "restricted-case"
        val caseDefinition = caseDefinition(id = CaseDefinitionId(caseDefinitionKey, "1.0.0"))
        val group = createGroup(groupKey, listOf(caseDefinitionKey))

        whenever(pinnedItemRepository.existsByUserIdAndItemTypeAndItemKey(TEST_USER_ID, PinnedItemType.CASE_DEFINITION_GROUP, groupKey))
            .thenReturn(false)
        whenever(groupRepository.findById(groupKey)).thenReturn(Optional.of(group))
        whenever(caseDefinitionService.getActiveCaseDefinition(caseDefinitionKey))
            .thenReturn(caseDefinition)
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<CaseDefinition>>()))
            .thenReturn(false)

        val exception = assertThrows<PinnedItemAccessDeniedException> {
            service.pinItem(PinnedItemType.CASE_DEFINITION_GROUP, groupKey)
        }

        assertTrue(exception.message!!.contains("Access denied"))
        verify(pinnedItemRepository, never()).save(any())
    }

    @Test
    fun `pinItem should throw when item already pinned`() {
        val caseDefinitionKey = "my-case"

        whenever(pinnedItemRepository.existsByUserIdAndItemTypeAndItemKey(TEST_USER_ID, PinnedItemType.CASE_DEFINITION, caseDefinitionKey))
            .thenReturn(true)

        val exception = assertThrows<PinnedItemAlreadyExistsException> {
            service.pinItem(PinnedItemType.CASE_DEFINITION, caseDefinitionKey)
        }

        assertTrue(exception.message!!.contains("already pinned"))
        verify(pinnedItemRepository, never()).save(any())
    }

    // LIST scenarios

    @Test
    fun `getPinnedItems should return empty list when no pins`() {
        whenever(pinnedItemRepository.findByUserIdOrderByPinnedAtDesc(TEST_USER_ID))
            .thenReturn(emptyList())

        val result = service.getPinnedItems()

        assertTrue(result.isEmpty())
    }

    @Test
    fun `getPinnedItems should return pins ordered by pinnedAt descending`() {
        val now = LocalDateTime.now()
        val caseDefinition1 = caseDefinition(id = CaseDefinitionId("case-1", "1.0.0"), name = "Case 1", color = "#FF0000")
        val caseDefinition2 = caseDefinition(id = CaseDefinitionId("case-2", "1.0.0"), name = "Case 2", color = "#00FF00")

        val pinnedItems = listOf(
            PinnedItem(userId = TEST_USER_ID, itemType = PinnedItemType.CASE_DEFINITION, itemKey = "case-1", pinnedAt = now),
            PinnedItem(userId = TEST_USER_ID, itemType = PinnedItemType.CASE_DEFINITION, itemKey = "case-2", pinnedAt = now.minusHours(1))
        )

        whenever(pinnedItemRepository.findByUserIdOrderByPinnedAtDesc(TEST_USER_ID))
            .thenReturn(pinnedItems)
        whenever(caseDefinitionService.getActiveCaseDefinition("case-1")).thenReturn(caseDefinition1)
        whenever(caseDefinitionService.getActiveCaseDefinition("case-2")).thenReturn(caseDefinition2)
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<CaseDefinition>>()))
            .thenReturn(true)

        val result = service.getPinnedItems()

        assertEquals(2, result.size)
        assertEquals("case-1", result[0].itemKey)
        assertEquals("case-2", result[1].itemKey)
    }

    @Test
    fun `getPinnedItems should filter out case definitions user lost access to`() {
        val now = LocalDateTime.now()
        val caseDefinition1 = caseDefinition(id = CaseDefinitionId("case-1", "1.0.0"), name = "Case 1")
        val caseDefinition2 = caseDefinition(id = CaseDefinitionId("case-2", "1.0.0"), name = "Case 2")

        val pinnedItems = listOf(
            PinnedItem(userId = TEST_USER_ID, itemType = PinnedItemType.CASE_DEFINITION, itemKey = "case-1", pinnedAt = now),
            PinnedItem(userId = TEST_USER_ID, itemType = PinnedItemType.CASE_DEFINITION, itemKey = "case-2", pinnedAt = now.minusHours(1))
        )

        whenever(pinnedItemRepository.findByUserIdOrderByPinnedAtDesc(TEST_USER_ID))
            .thenReturn(pinnedItems)
        whenever(caseDefinitionService.getActiveCaseDefinition("case-1")).thenReturn(caseDefinition1)
        whenever(caseDefinitionService.getActiveCaseDefinition("case-2")).thenReturn(caseDefinition2)
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<CaseDefinition>>()))
            .thenAnswer { invocation ->
                val request = invocation.getArgument<EntityAuthorizationRequest<CaseDefinition>>(0)
                request.entities.firstOrNull()?.id?.key == "case-1"
            }

        val result = service.getPinnedItems()

        assertEquals(1, result.size)
        assertEquals("case-1", result[0].itemKey)
    }

    @Test
    fun `getPinnedItems should filter out groups user lost access to`() {
        val now = LocalDateTime.now()
        val groupKey = "my-group"
        val group = createGroup(groupKey, listOf("restricted-case"))
        val caseDefinition = caseDefinition(id = CaseDefinitionId("restricted-case", "1.0.0"))

        val pinnedItems = listOf(
            PinnedItem(userId = TEST_USER_ID, itemType = PinnedItemType.CASE_DEFINITION_GROUP, itemKey = groupKey, pinnedAt = now)
        )

        whenever(pinnedItemRepository.findByUserIdOrderByPinnedAtDesc(TEST_USER_ID))
            .thenReturn(pinnedItems)
        whenever(groupRepository.findById(groupKey)).thenReturn(Optional.of(group))
        whenever(caseDefinitionService.getActiveCaseDefinition("restricted-case")).thenReturn(caseDefinition)
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<CaseDefinition>>()))
            .thenReturn(false)

        val result = service.getPinnedItems()

        assertTrue(result.isEmpty())
    }

    @Test
    fun `getPinnedItems should return correct order index`() {
        val now = LocalDateTime.now()
        val caseDefinition1 = caseDefinition(id = CaseDefinitionId("case-1", "1.0.0"), name = "Case 1")
        val caseDefinition2 = caseDefinition(id = CaseDefinitionId("case-2", "1.0.0"), name = "Case 2")
        val caseDefinition3 = caseDefinition(id = CaseDefinitionId("case-3", "1.0.0"), name = "Case 3")

        val pinnedItems = listOf(
            PinnedItem(userId = TEST_USER_ID, itemType = PinnedItemType.CASE_DEFINITION, itemKey = "case-1", pinnedAt = now),
            PinnedItem(userId = TEST_USER_ID, itemType = PinnedItemType.CASE_DEFINITION, itemKey = "case-2", pinnedAt = now.minusHours(1)),
            PinnedItem(userId = TEST_USER_ID, itemType = PinnedItemType.CASE_DEFINITION, itemKey = "case-3", pinnedAt = now.minusHours(2))
        )

        whenever(pinnedItemRepository.findByUserIdOrderByPinnedAtDesc(TEST_USER_ID))
            .thenReturn(pinnedItems)
        whenever(caseDefinitionService.getActiveCaseDefinition("case-1")).thenReturn(caseDefinition1)
        whenever(caseDefinitionService.getActiveCaseDefinition("case-2")).thenReturn(caseDefinition2)
        whenever(caseDefinitionService.getActiveCaseDefinition("case-3")).thenReturn(caseDefinition3)
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<CaseDefinition>>()))
            .thenReturn(true)

        val result = service.getPinnedItems()

        assertEquals(3, result.size)
        assertEquals(0, result[0].order)
        assertEquals(1, result[1].order)
        assertEquals(2, result[2].order)
    }

    @Test
    fun `getPinnedItems should include displayName and color`() {
        val now = LocalDateTime.now()
        val caseDefinition = caseDefinition(id = CaseDefinitionId("my-case", "1.0.0"), name = "My Case Name", color = "#FF5733")

        val pinnedItems = listOf(
            PinnedItem(userId = TEST_USER_ID, itemType = PinnedItemType.CASE_DEFINITION, itemKey = "my-case", pinnedAt = now)
        )

        whenever(pinnedItemRepository.findByUserIdOrderByPinnedAtDesc(TEST_USER_ID))
            .thenReturn(pinnedItems)
        whenever(caseDefinitionService.getActiveCaseDefinition("my-case")).thenReturn(caseDefinition)
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<CaseDefinition>>()))
            .thenReturn(true)

        val result = service.getPinnedItems()

        assertEquals(1, result.size)
        assertEquals("My Case Name", result[0].displayName)
        assertEquals("#FF5733", result[0].color)
    }

    @Test
    fun `getPinnedItems should include displayName and color for groups`() {
        val now = LocalDateTime.now()
        val groupKey = "my-group"
        val caseDefinitionKey = "my-case"
        val group = createGroup(groupKey, listOf(caseDefinitionKey), title = "My Group", color = "#123456")
        val caseDefinition = caseDefinition(id = CaseDefinitionId(caseDefinitionKey, "1.0.0"))

        val pinnedItems = listOf(
            PinnedItem(userId = TEST_USER_ID, itemType = PinnedItemType.CASE_DEFINITION_GROUP, itemKey = groupKey, pinnedAt = now)
        )

        whenever(pinnedItemRepository.findByUserIdOrderByPinnedAtDesc(TEST_USER_ID))
            .thenReturn(pinnedItems)
        whenever(groupRepository.findById(groupKey)).thenReturn(Optional.of(group))
        whenever(caseDefinitionService.getActiveCaseDefinition(caseDefinitionKey)).thenReturn(caseDefinition)
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<CaseDefinition>>()))
            .thenReturn(true)

        val result = service.getPinnedItems()

        assertEquals(1, result.size)
        assertEquals("My Group", result[0].displayName)
        assertEquals("#123456", result[0].color)
    }

    @Test
    fun `getPinnedItems should return null for deleted case definition`() {
        val now = LocalDateTime.now()

        val pinnedItems = listOf(
            PinnedItem(userId = TEST_USER_ID, itemType = PinnedItemType.CASE_DEFINITION, itemKey = "deleted-case", pinnedAt = now)
        )

        whenever(pinnedItemRepository.findByUserIdOrderByPinnedAtDesc(TEST_USER_ID))
            .thenReturn(pinnedItems)
        whenever(caseDefinitionService.getActiveCaseDefinition("deleted-case")).thenReturn(null)

        val result = service.getPinnedItems()

        assertTrue(result.isEmpty())
    }

    @Test
    fun `getPinnedItems should return null for deleted group`() {
        val now = LocalDateTime.now()
        val groupKey = "deleted-group"

        val pinnedItems = listOf(
            PinnedItem(userId = TEST_USER_ID, itemType = PinnedItemType.CASE_DEFINITION_GROUP, itemKey = groupKey, pinnedAt = now)
        )

        whenever(pinnedItemRepository.findByUserIdOrderByPinnedAtDesc(TEST_USER_ID))
            .thenReturn(pinnedItems)
        whenever(groupRepository.findById(groupKey)).thenReturn(Optional.empty())

        val result = service.getPinnedItems()

        assertTrue(result.isEmpty())
    }

    // UNPIN scenarios

    @Test
    fun `unpinItem should delete pin for current user`() {
        val caseDefinitionKey = "my-case"

        service.unpinItem(PinnedItemType.CASE_DEFINITION, caseDefinitionKey)

        verify(pinnedItemRepository).deleteByUserIdAndItemTypeAndItemKey(
            TEST_USER_ID,
            PinnedItemType.CASE_DEFINITION,
            caseDefinitionKey
        )
    }

    @Test
    fun `unpinItem should succeed when pin does not exist (idempotent)`() {
        val caseDefinitionKey = "non-existent-pin"

        service.unpinItem(PinnedItemType.CASE_DEFINITION, caseDefinitionKey)

        verify(pinnedItemRepository).deleteByUserIdAndItemTypeAndItemKey(
            TEST_USER_ID,
            PinnedItemType.CASE_DEFINITION,
            caseDefinitionKey
        )
    }

    @Test
    fun `unpinItem should delete group pin for current user`() {
        val groupKey = "my-group"

        service.unpinItem(PinnedItemType.CASE_DEFINITION_GROUP, groupKey)

        verify(pinnedItemRepository).deleteByUserIdAndItemTypeAndItemKey(
            TEST_USER_ID,
            PinnedItemType.CASE_DEFINITION_GROUP,
            groupKey
        )
    }

    private fun createGroup(
        key: String,
        memberKeys: List<String> = emptyList(),
        title: String = "Test Group",
        color: String? = null
    ): CaseDefinitionGroup {
        val group = CaseDefinitionGroup(
            key = key,
            title = title,
            description = null,
            order = 0,
            color = color
        )
        memberKeys.forEachIndexed { index, caseDefKey ->
            group.members.add(
                CaseDefinitionGroupMember(
                    id = CaseDefinitionGroupMemberId(key, caseDefKey),
                    group = group,
                    order = index
                )
            )
        }
        return group
    }

    companion object {
        const val TEST_USER_ID = "test-user-id"
    }
}
