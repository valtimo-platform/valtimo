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

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.case.domain.StartableItem
import com.ritense.case.domain.StartableItemId
import com.ritense.case.repository.StartableItemRepository
import com.ritense.case.web.rest.dto.ManagementStartableItemDto
import com.ritense.case.web.rest.dto.StartableItemDto
import com.ritense.case.web.rest.dto.StartableItemOrderEntry
import com.ritense.case.web.rest.dto.StartableItemType
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@SkipComponentScan
@Service
class StartableItemManagementService(
    private val startableItemProviders: List<StartableItemProvider>,
    private val startableItemRepository: StartableItemRepository,
) {

    @Transactional(readOnly = true)
    fun getStartableItems(caseDefinitionId: CaseDefinitionId): List<ManagementStartableItemDto> {
        val allItems = startableItemProviders.flatMap { provider ->
            provider.getStartableItems(caseDefinitionId)
        }

        val sortOrderMap = startableItemRepository
            .findAllByIdCaseDefinitionId(caseDefinitionId)
            .associate { Triple(it.id.itemKey, it.id.itemType, it.id.itemVersionTag) to it.sortOrder }

        return allItems
            .map { item ->
                ManagementStartableItemDto(
                    type = item.type,
                    name = item.name,
                    key = item.key,
                    versionTag = item.versionTag,
                    processDefinitionId = item.processDefinitionId,
                    sortOrder = sortOrderMap[Triple(item.key, item.type, item.versionTag.orEmpty())]
                )
            }
            .sortedWith(compareBy(
                { it.sortOrder ?: Int.MAX_VALUE },
                { it.name ?: it.key }
            ))
    }

    @Transactional
    fun createItem(
        caseDefinitionId: CaseDefinitionId,
        type: StartableItemType,
        properties: JsonNode
    ): StartableItemDto {
        val provider = startableItemProviders.find { it.type == type }
            ?: throw UnsupportedOperationException("No provider found for type: $type")
        val item = provider.createItem(caseDefinitionId, properties)

        val maxSortOrder = startableItemRepository
            .findAllByIdCaseDefinitionId(caseDefinitionId)
            .maxOfOrNull { it.sortOrder } ?: -1

        startableItemRepository.save(
            StartableItem(
                id = StartableItemId(caseDefinitionId, item.key, item.type, item.versionTag.orEmpty()),
                sortOrder = maxSortOrder + 1
            )
        )

        return item
    }

    @Transactional
    fun updateItem(
        caseDefinitionId: CaseDefinitionId,
        oldItemKey: String,
        oldVersionTag: String?,
        newType: StartableItemType,
        newProperties: JsonNode
    ): StartableItemDto {
        val existingItems = startableItemProviders.flatMap { it.getStartableItems(caseDefinitionId) }
        val oldItem = existingItems.find { it.key == oldItemKey && it.versionTag == oldVersionTag }
            ?: throw NoSuchElementException("Startable item not found: $oldItemKey:$oldVersionTag")

        val oldSortOrder = startableItemRepository
            .findAllByIdCaseDefinitionId(caseDefinitionId)
            .find { it.id.itemKey == oldItemKey && it.id.itemType == oldItem.type && it.id.itemVersionTag == oldVersionTag.orEmpty() }
            ?.sortOrder

        if (oldItem.type == newType) {
            val provider = startableItemProviders.find { it.type == newType }
                ?: throw UnsupportedOperationException("No provider found for type: $newType")
            return provider.updateItem(caseDefinitionId, oldItemKey, oldVersionTag, newProperties)
        }

        val oldProvider = startableItemProviders.find { it.type == oldItem.type }
            ?: throw UnsupportedOperationException("No provider found for type: ${oldItem.type}")
        oldProvider.deleteItem(caseDefinitionId, oldItemKey, oldVersionTag)
        startableItemRepository.deleteById(StartableItemId(caseDefinitionId, oldItemKey, oldItem.type, oldVersionTag.orEmpty()))

        val newProvider = startableItemProviders.find { it.type == newType }
            ?: throw UnsupportedOperationException("No provider found for type: $newType")
        val newItem = newProvider.createItem(caseDefinitionId, newProperties)

        val sortOrder = oldSortOrder ?: (startableItemRepository
            .findAllByIdCaseDefinitionId(caseDefinitionId)
            .maxOfOrNull { it.sortOrder }?.plus(1) ?: 0)

        startableItemRepository.save(
            StartableItem(
                id = StartableItemId(caseDefinitionId, newItem.key, newItem.type, newItem.versionTag.orEmpty()),
                sortOrder = sortOrder
            )
        )

        return newItem
    }

    @Transactional
    fun deleteItem(
        caseDefinitionId: CaseDefinitionId,
        itemKey: String,
        versionTag: String?
    ) {
        val existingItems = startableItemProviders.flatMap { it.getStartableItems(caseDefinitionId) }
        val item = existingItems.find { it.key == itemKey && it.versionTag == versionTag }
            ?: throw NoSuchElementException("Startable item not found: $itemKey:$versionTag")

        val provider = startableItemProviders.find { it.type == item.type }
            ?: throw UnsupportedOperationException("No provider found for type: ${item.type}")

        provider.deleteItem(caseDefinitionId, itemKey, versionTag)

        startableItemRepository.deleteById(StartableItemId(caseDefinitionId, itemKey, item.type, versionTag.orEmpty()))
    }

    @Transactional(readOnly = true)
    fun getItemProperties(
        caseDefinitionId: CaseDefinitionId,
        itemKey: String,
        versionTag: String?,
        type: StartableItemType
    ): JsonNode {
        val provider = startableItemProviders.find { it.type == type }
            ?: throw UnsupportedOperationException("No provider found for type: $type")
        return provider.getItemProperties(caseDefinitionId, itemKey, versionTag)
            ?: throw UnsupportedOperationException("Provider for type $type does not support item properties")
    }

    @Transactional
    fun updateOrder(
        caseDefinitionId: CaseDefinitionId,
        items: List<StartableItemOrderEntry>
    ): List<ManagementStartableItemDto> {
        val existingItems = startableItemProviders.flatMap { it.getStartableItems(caseDefinitionId) }
        val existingItemsByIdentity = existingItems.associateBy { Triple(it.key, it.type, it.versionTag.orEmpty()) }

        val entities = items.mapNotNull { entry ->
            existingItemsByIdentity[Triple(entry.key, entry.type, entry.versionTag.orEmpty())] ?: return@mapNotNull null
            StartableItem(
                id = StartableItemId(caseDefinitionId, entry.key, entry.type, entry.versionTag.orEmpty()),
                sortOrder = entry.sortOrder
            )
        }

        startableItemRepository.deleteAllByIdCaseDefinitionId(caseDefinitionId)
        startableItemRepository.saveAll(entities)

        return getStartableItems(caseDefinitionId)
    }
}
