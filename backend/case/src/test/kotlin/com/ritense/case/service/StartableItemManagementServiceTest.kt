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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case.domain.StartableItem
import com.ritense.case.domain.StartableItemId
import com.ritense.case.repository.StartableItemRepository
import com.ritense.case.web.rest.dto.StartableItemDto
import com.ritense.case.web.rest.dto.StartableItemOrderEntry
import com.ritense.case.web.rest.dto.StartableItemType
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class StartableItemManagementServiceTest {

    private lateinit var processProvider: StartableItemProvider
    private lateinit var buildingBlockProvider: StartableItemProvider
    private lateinit var startableItemRepository: StartableItemRepository
    private lateinit var service: StartableItemManagementService

    private val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")

    @BeforeEach
    fun setUp() {
        processProvider = mock()
        buildingBlockProvider = mock()
        startableItemRepository = mock()

        whenever(processProvider.type).thenReturn(StartableItemType.PROCESS)
        whenever(buildingBlockProvider.type).thenReturn(StartableItemType.BUILDING_BLOCK)

        service = StartableItemManagementService(
            startableItemProviders = listOf(processProvider, buildingBlockProvider),
            startableItemRepository = startableItemRepository
        )
    }

    @Test
    fun `should get startable items sorted by sort order then name`() {
        val processItem = StartableItemDto(
            type = StartableItemType.PROCESS,
            name = "B Process",
            key = "b-process",
            versionTag = null,
            processDefinitionId = "process:1"
        )
        val buildingBlockItem = StartableItemDto(
            type = StartableItemType.BUILDING_BLOCK,
            name = "A Building Block",
            key = "a-bb",
            versionTag = "1.0.0",
            processDefinitionId = "bb:1"
        )

        whenever(processProvider.getStartableItems(caseDefinitionId)).thenReturn(listOf(processItem))
        whenever(buildingBlockProvider.getStartableItems(caseDefinitionId)).thenReturn(listOf(buildingBlockItem))

        val sortEntities = listOf(
            StartableItem(
                id = StartableItemId(caseDefinitionId, "a-bb", StartableItemType.BUILDING_BLOCK, "1.0.0"),
                sortOrder = 0
            ),
            StartableItem(
                id = StartableItemId(caseDefinitionId, "b-process", StartableItemType.PROCESS),
                sortOrder = 1
            )
        )
        whenever(startableItemRepository.findAllByIdCaseDefinitionId(caseDefinitionId)).thenReturn(sortEntities)

        val result = service.getStartableItems(caseDefinitionId)

        assertThat(result).hasSize(2)
        assertThat(result[0].key).isEqualTo("a-bb")
        assertThat(result[0].sortOrder).isEqualTo(0)
        assertThat(result[1].key).isEqualTo("b-process")
        assertThat(result[1].sortOrder).isEqualTo(1)
    }

    @Test
    fun `should sort items without sort order after items with sort order`() {
        val item1 = StartableItemDto(
            type = StartableItemType.PROCESS,
            name = "Sorted Process",
            key = "sorted",
            versionTag = null,
            processDefinitionId = "process:1"
        )
        val item2 = StartableItemDto(
            type = StartableItemType.PROCESS,
            name = "Unsorted Process",
            key = "unsorted",
            versionTag = null,
            processDefinitionId = "process:2"
        )

        whenever(processProvider.getStartableItems(caseDefinitionId)).thenReturn(listOf(item1, item2))
        whenever(buildingBlockProvider.getStartableItems(caseDefinitionId)).thenReturn(emptyList())

        val sortEntities = listOf(
            StartableItem(
                id = StartableItemId(caseDefinitionId, "sorted", StartableItemType.PROCESS),
                sortOrder = 0
            )
        )
        whenever(startableItemRepository.findAllByIdCaseDefinitionId(caseDefinitionId)).thenReturn(sortEntities)

        val result = service.getStartableItems(caseDefinitionId)

        assertThat(result).hasSize(2)
        assertThat(result[0].key).isEqualTo("sorted")
        assertThat(result[0].sortOrder).isEqualTo(0)
        assertThat(result[1].key).isEqualTo("unsorted")
        assertThat(result[1].sortOrder).isNull()
    }

    @Test
    fun `should create item and assign next sort order`() {
        val objectMapper = MapperSingleton.get()
        val properties = objectMapper.readTree("""{"processDefinitionId": "process:1"}""")

        val createdItem = StartableItemDto(
            type = StartableItemType.PROCESS,
            name = "My Process",
            key = "my-process",
            versionTag = null,
            processDefinitionId = "process:1"
        )
        whenever(processProvider.createItem(caseDefinitionId, properties)).thenReturn(createdItem)

        val existingSortEntities = listOf(
            StartableItem(
                id = StartableItemId(caseDefinitionId, "existing", StartableItemType.PROCESS),
                sortOrder = 2
            )
        )
        whenever(startableItemRepository.findAllByIdCaseDefinitionId(caseDefinitionId)).thenReturn(existingSortEntities)
        whenever(startableItemRepository.save(any<StartableItem>())).thenAnswer { it.arguments[0] }

        val result = service.createItem(caseDefinitionId, StartableItemType.PROCESS, properties)

        assertThat(result.key).isEqualTo("my-process")
        verify(startableItemRepository).save(
            StartableItem(
                id = StartableItemId(caseDefinitionId, "my-process", StartableItemType.PROCESS),
                sortOrder = 3
            )
        )
    }

    @Test
    fun `should create item with sort order 0 when no existing items`() {
        val objectMapper = MapperSingleton.get()
        val properties = objectMapper.readTree("""{"processDefinitionId": "process:1"}""")

        val createdItem = StartableItemDto(
            type = StartableItemType.PROCESS,
            name = "First Process",
            key = "first-process",
            versionTag = null,
            processDefinitionId = "process:1"
        )
        whenever(processProvider.createItem(caseDefinitionId, properties)).thenReturn(createdItem)
        whenever(startableItemRepository.findAllByIdCaseDefinitionId(caseDefinitionId)).thenReturn(emptyList())
        whenever(startableItemRepository.save(any<StartableItem>())).thenAnswer { it.arguments[0] }

        service.createItem(caseDefinitionId, StartableItemType.PROCESS, properties)

        verify(startableItemRepository).save(
            StartableItem(
                id = StartableItemId(caseDefinitionId, "first-process", StartableItemType.PROCESS),
                sortOrder = 0
            )
        )
    }

    @Test
    fun `should throw when no provider found for type`() {
        val objectMapper = MapperSingleton.get()
        val properties = objectMapper.readTree("""{}""")

        val serviceWithNoProviders = StartableItemManagementService(
            startableItemProviders = emptyList(),
            startableItemRepository = startableItemRepository
        )

        assertThrows<UnsupportedOperationException> {
            serviceWithNoProviders.createItem(caseDefinitionId, StartableItemType.PROCESS, properties)
        }
    }

    @Test
    fun `should delete item by key and version tag`() {
        val existingItems = listOf(
            StartableItemDto(
                type = StartableItemType.PROCESS,
                name = "My Process",
                key = "my-process",
                versionTag = null,
                processDefinitionId = "process:1"
            )
        )
        whenever(processProvider.getStartableItems(caseDefinitionId)).thenReturn(existingItems)
        whenever(buildingBlockProvider.getStartableItems(caseDefinitionId)).thenReturn(emptyList())

        service.deleteItem(caseDefinitionId, "my-process", null)

        verify(processProvider).deleteItem(caseDefinitionId, "my-process", null)
        verify(startableItemRepository).deleteById(
            StartableItemId(caseDefinitionId, "my-process", StartableItemType.PROCESS)
        )
    }

    @Test
    fun `should throw when deleting non-existent item`() {
        whenever(processProvider.getStartableItems(caseDefinitionId)).thenReturn(emptyList())
        whenever(buildingBlockProvider.getStartableItems(caseDefinitionId)).thenReturn(emptyList())

        assertThrows<NoSuchElementException> {
            service.deleteItem(caseDefinitionId, "non-existent", null)
        }
    }

    @Test
    fun `should update order and return updated items`() {
        val processItem = StartableItemDto(
            type = StartableItemType.PROCESS,
            name = "My Process",
            key = "my-process",
            versionTag = null,
            processDefinitionId = "process:1"
        )
        val buildingBlockItem = StartableItemDto(
            type = StartableItemType.BUILDING_BLOCK,
            name = "Income Check",
            key = "income-check",
            versionTag = "1.0.0",
            processDefinitionId = "bb:1"
        )

        whenever(processProvider.getStartableItems(caseDefinitionId)).thenReturn(listOf(processItem))
        whenever(buildingBlockProvider.getStartableItems(caseDefinitionId)).thenReturn(listOf(buildingBlockItem))

        val sortEntities = listOf(
            StartableItem(
                id = StartableItemId(caseDefinitionId, "income-check", StartableItemType.BUILDING_BLOCK, "1.0.0"),
                sortOrder = 0
            ),
            StartableItem(
                id = StartableItemId(caseDefinitionId, "my-process", StartableItemType.PROCESS),
                sortOrder = 1
            )
        )
        whenever(startableItemRepository.findAllByIdCaseDefinitionId(caseDefinitionId)).thenReturn(sortEntities)

        val orderEntries = listOf(
            StartableItemOrderEntry("income-check", StartableItemType.BUILDING_BLOCK, "1.0.0", 0),
            StartableItemOrderEntry("my-process", StartableItemType.PROCESS, null, 1)
        )

        val result = service.updateOrder(caseDefinitionId, orderEntries)

        verify(startableItemRepository).deleteAllByIdCaseDefinitionId(caseDefinitionId)
        verify(startableItemRepository).saveAll(any<List<StartableItem>>())
        assertThat(result).hasSize(2)
    }

    @Test
    fun `should skip unknown items in order update`() {
        whenever(processProvider.getStartableItems(caseDefinitionId)).thenReturn(emptyList())
        whenever(buildingBlockProvider.getStartableItems(caseDefinitionId)).thenReturn(emptyList())
        whenever(startableItemRepository.findAllByIdCaseDefinitionId(caseDefinitionId)).thenReturn(emptyList())

        val orderEntries = listOf(
            StartableItemOrderEntry("non-existent", StartableItemType.PROCESS, null, 0)
        )

        service.updateOrder(caseDefinitionId, orderEntries)

        verify(startableItemRepository).deleteAllByIdCaseDefinitionId(caseDefinitionId)
        verify(startableItemRepository).saveAll(emptyList())
    }

    @Test
    fun `should get item properties from correct provider`() {
        val objectMapper = MapperSingleton.get()
        val properties = objectMapper.readTree("""{"key": "value"}""")

        whenever(processProvider.getItemProperties(caseDefinitionId, "my-process", "0")).thenReturn(properties)

        val result = service.getItemProperties(caseDefinitionId, "my-process", "0", StartableItemType.PROCESS)

        assertThat(result).isEqualTo(properties)
        verify(processProvider).getItemProperties(caseDefinitionId, "my-process", "0")
    }

    @Test
    fun `should throw when getting properties from unknown provider type`() {
        val serviceWithNoProviders = StartableItemManagementService(
            startableItemProviders = emptyList(),
            startableItemRepository = startableItemRepository
        )

        assertThrows<UnsupportedOperationException> {
            serviceWithNoProviders.getItemProperties(caseDefinitionId, "my-process", "0", StartableItemType.PROCESS)
        }
    }
}
