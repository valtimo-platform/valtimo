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
            .associate { (it.id.itemKey to it.id.itemType) to it.sortOrder }

        return allItems
            .map { item ->
                ManagementStartableItemDto(
                    type = item.type,
                    name = item.name,
                    key = item.key,
                    versionTag = item.versionTag,
                    processDefinitionId = item.processDefinitionId,
                    sortOrder = sortOrderMap[item.key to item.type]
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
                id = StartableItemId(caseDefinitionId, item.key, item.type),
                sortOrder = maxSortOrder + 1
            )
        )

        return item
    }

    @Transactional
    fun deleteItem(
        caseDefinitionId: CaseDefinitionId,
        itemKey: String,
        versionTag: String
    ) {
        val existingItems = startableItemProviders.flatMap { it.getStartableItems(caseDefinitionId) }
        val item = existingItems.find { it.key == itemKey && it.versionTag == versionTag }
            ?: throw NoSuchElementException("Startable item not found: $itemKey:$versionTag")

        val provider = startableItemProviders.find { it.type == item.type }
            ?: throw UnsupportedOperationException("No provider found for type: ${item.type}")

        provider.deleteItem(caseDefinitionId, itemKey, versionTag)

        startableItemRepository.deleteById(StartableItemId(caseDefinitionId, itemKey, item.type))
    }

    @Transactional
    fun updateOrder(
        caseDefinitionId: CaseDefinitionId,
        items: List<StartableItemOrderEntry>
    ): List<ManagementStartableItemDto> {
        val existingItems = startableItemProviders.flatMap { it.getStartableItems(caseDefinitionId) }
        val existingItemsByKeyAndType = existingItems.associateBy { it.key to it.type }

        val entities = items.mapNotNull { entry ->
            existingItemsByKeyAndType[entry.key to entry.type] ?: return@mapNotNull null
            StartableItem(
                id = StartableItemId(caseDefinitionId, entry.key, entry.type),
                sortOrder = entry.sortOrder
            )
        }

        startableItemRepository.deleteAllByIdCaseDefinitionId(caseDefinitionId)
        startableItemRepository.saveAll(entities)

        return getStartableItems(caseDefinitionId)
    }
}
