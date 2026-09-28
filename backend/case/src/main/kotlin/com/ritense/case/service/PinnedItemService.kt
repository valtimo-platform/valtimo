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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.case.domain.group.CaseDefinitionGroupMember
import com.ritense.case.domain.PinnedItem
import com.ritense.case.domain.PinnedItemType
import com.ritense.case.exception.PinnedItemAccessDeniedException
import com.ritense.case.exception.PinnedItemAlreadyExistsException
import com.ritense.case.exception.PinnedItemNotFoundException
import com.ritense.case.repository.CaseDefinitionGroupRepository
import com.ritense.case.repository.PinnedItemRepository
import com.ritense.case.web.rest.dto.PinnedItemResponseDto
import com.ritense.case_.authorization.CaseDefinitionActionProvider
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.authorization.UserManagementServiceHolder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Transactional(readOnly = true)
@Service
@SkipComponentScan
class PinnedItemService(
    private val pinnedItemRepository: PinnedItemRepository,
    private val caseDefinitionService: CaseDefinitionService,
    private val groupRepository: CaseDefinitionGroupRepository,
    private val authorizationService: AuthorizationService
) {

    fun getPinnedItems(): List<PinnedItemResponseDto> {
        val currentUserId = UserManagementServiceHolder.currentInstance.currentUserId
        val pinnedItems = pinnedItemRepository.findByUserIdOrderByPinnedAtDesc(currentUserId)

        return pinnedItems
            .mapIndexedNotNull { index, pinnedItem ->
                toResponseDto(pinnedItem, index)
            }
    }

    @Transactional
    fun pinItem(itemType: PinnedItemType, itemKey: String) {
        val currentUserId = UserManagementServiceHolder.currentInstance.currentUserId

        if (pinnedItemRepository.existsByUserIdAndItemTypeAndItemKey(currentUserId, itemType, itemKey)) {
            throw PinnedItemAlreadyExistsException(itemType, itemKey)
        }

        checkAccess(itemType, itemKey)

        pinnedItemRepository.save(
            PinnedItem(
                userId = currentUserId,
                itemType = itemType,
                itemKey = itemKey
            )
        )
    }

    @Transactional
    fun unpinItem(itemType: PinnedItemType, itemKey: String) {
        val currentUserId = UserManagementServiceHolder.currentInstance.currentUserId
        pinnedItemRepository.deleteByUserIdAndItemTypeAndItemKey(currentUserId, itemType, itemKey)
    }

    private fun toResponseDto(pinnedItem: PinnedItem, order: Int): PinnedItemResponseDto? {
        return when (pinnedItem.itemType) {
            PinnedItemType.CASE_DEFINITION -> {
                val caseDefinition = runWithoutAuthorization {
                    caseDefinitionService.getActiveCaseDefinition(pinnedItem.itemKey)
                } ?: return null

                if (!hasViewPermission(caseDefinition)) {
                    return null
                }

                PinnedItemResponseDto(
                    itemType = pinnedItem.itemType,
                    itemKey = pinnedItem.itemKey,
                    order = order,
                    displayName = caseDefinition.name,
                    color = caseDefinition.color
                )
            }
            PinnedItemType.CASE_DEFINITION_GROUP -> {
                val group = groupRepository.findById(pinnedItem.itemKey).orElse(null)
                    ?: return null

                if (!hasAccessToGroupMembers(group.members)) {
                    return null
                }

                PinnedItemResponseDto(
                    itemType = pinnedItem.itemType,
                    itemKey = pinnedItem.itemKey,
                    order = order,
                    displayName = group.title,
                    color = group.color
                )
            }
        }
    }

    private fun checkAccess(itemType: PinnedItemType, itemKey: String) {
        when (itemType) {
            PinnedItemType.CASE_DEFINITION -> {
                val caseDefinition = runWithoutAuthorization {
                    caseDefinitionService.getActiveCaseDefinition(itemKey)
                } ?: throw PinnedItemNotFoundException(itemType, itemKey)

                if (!hasViewPermission(caseDefinition)) {
                    throw PinnedItemAccessDeniedException(itemType, itemKey)
                }
            }
            PinnedItemType.CASE_DEFINITION_GROUP -> {
                val group = groupRepository.findById(itemKey).orElse(null)
                    ?: throw PinnedItemNotFoundException(itemType, itemKey)

                if (!hasAccessToGroupMembers(group.members)) {
                    throw PinnedItemAccessDeniedException(itemType, itemKey)
                }
            }
        }
    }

    private fun hasViewPermission(caseDefinition: CaseDefinition): Boolean {
        return try {
            authorizationService.hasPermission(
                EntityAuthorizationRequest(
                    CaseDefinition::class.java,
                    CaseDefinitionActionProvider.VIEW_LIST,
                    caseDefinition
                )
            )
        } catch (e: Exception) {
            false
        }
    }

    private fun hasAccessToGroupMembers(members: List<CaseDefinitionGroupMember>): Boolean {
        return members.any { member ->
            val caseDefinition = runWithoutAuthorization {
                caseDefinitionService.getActiveCaseDefinition(member.id.caseDefinitionKey)
            }
            caseDefinition != null && hasViewPermission(caseDefinition)
        }
    }
}
