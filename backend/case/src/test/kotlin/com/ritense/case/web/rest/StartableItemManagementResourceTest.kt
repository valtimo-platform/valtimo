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

package com.ritense.case.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case.service.StartableItemManagementService
import com.ritense.case.web.rest.dto.ManagementStartableItemDto
import com.ritense.case.web.rest.dto.StartableItemDto
import com.ritense.case.web.rest.dto.StartableItemOrderEntry
import com.ritense.case.web.rest.dto.StartableItemType
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.MediaType
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders

class StartableItemManagementResourceTest {

    lateinit var mockMvc: MockMvc
    lateinit var managementService: StartableItemManagementService
    lateinit var mapper: ObjectMapper

    private val caseDefinitionKey = "my-case"
    private val caseDefinitionVersionTag = "1.0.0"
    private val basePath = "/api/management/v1/case-definition/$caseDefinitionKey/version/$caseDefinitionVersionTag/startable-item"

    @BeforeEach
    fun setUp() {
        managementService = mock()
        mapper = MapperSingleton.get()

        val resource = StartableItemManagementResource(managementService)
        val converter = MappingJackson2HttpMessageConverter()
        converter.objectMapper = mapper

        mockMvc = MockMvcBuilders
            .standaloneSetup(resource)
            .setMessageConverters(converter)
            .build()
    }

    @Test
    fun `should list all startable items with sort order`() {
        val caseDefinitionId = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        val items = listOf(
            ManagementStartableItemDto(
                type = StartableItemType.PROCESS,
                name = "My Process",
                key = "my-process",
                versionTag = null,
                processDefinitionId = "process:1",
                sortOrder = 0
            ),
            ManagementStartableItemDto(
                type = StartableItemType.BUILDING_BLOCK,
                name = "Income Check",
                key = "income-check",
                versionTag = "1.0.0",
                processDefinitionId = "bb:1",
                sortOrder = 1
            )
        )
        whenever(managementService.getStartableItems(caseDefinitionId)).thenReturn(items)

        mockMvc.perform(
            get(basePath)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].type").value("PROCESS"))
            .andExpect(jsonPath("$[0].sortOrder").value(0))
            .andExpect(jsonPath("$[1].type").value("BUILDING_BLOCK"))
            .andExpect(jsonPath("$[1].sortOrder").value(1))

        verify(managementService).getStartableItems(caseDefinitionId)
    }

    @Test
    fun `should create a building block startable item`() {
        val caseDefinitionId = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        val resultItem = StartableItemDto(
            type = StartableItemType.BUILDING_BLOCK,
            name = "Income Check",
            key = "income-check",
            versionTag = "1.0.0",
            processDefinitionId = "bb:1"
        )
        whenever(managementService.createItem(eq(caseDefinitionId), eq(StartableItemType.BUILDING_BLOCK), any()))
            .thenReturn(resultItem)

        val requestBody = """
            {
                "type": "BUILDING_BLOCK",
                "properties": {
                    "buildingBlockDefinitionKey": "income-check",
                    "buildingBlockDefinitionVersionTag": "1.0.0"
                }
            }
        """.trimIndent()

        mockMvc.perform(
            post(basePath)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content(requestBody)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.type").value("BUILDING_BLOCK"))
            .andExpect(jsonPath("$.key").value("income-check"))
            .andExpect(jsonPath("$.versionTag").value("1.0.0"))

        verify(managementService).createItem(eq(caseDefinitionId), eq(StartableItemType.BUILDING_BLOCK), any())
    }

    @Test
    fun `should create a process startable item`() {
        val caseDefinitionId = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        val resultItem = StartableItemDto(
            type = StartableItemType.PROCESS,
            name = "My Process",
            key = "my-process",
            versionTag = null,
            processDefinitionId = "process:1"
        )
        whenever(managementService.createItem(eq(caseDefinitionId), eq(StartableItemType.PROCESS), any()))
            .thenReturn(resultItem)

        val requestBody = """
            {
                "type": "PROCESS",
                "properties": {
                    "processDefinitionId": "process:1"
                }
            }
        """.trimIndent()

        mockMvc.perform(
            post(basePath)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content(requestBody)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.type").value("PROCESS"))
            .andExpect(jsonPath("$.key").value("my-process"))

        verify(managementService).createItem(eq(caseDefinitionId), eq(StartableItemType.PROCESS), any())
    }

    @Test
    fun `should delete a startable item`() {
        mockMvc.perform(
            delete("$basePath/income-check/version/1.0.0")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isNoContent)

        val caseDefinitionId = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        verify(managementService).deleteItem(caseDefinitionId, "income-check", "1.0.0")
    }

    @Test
    fun `should update the order of all items`() {
        val caseDefinitionId = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        val reorderedItems = listOf(
            ManagementStartableItemDto(
                type = StartableItemType.BUILDING_BLOCK,
                name = "Income Check",
                key = "income-check",
                versionTag = "1.0.0",
                processDefinitionId = "bb:1",
                sortOrder = 0
            ),
            ManagementStartableItemDto(
                type = StartableItemType.PROCESS,
                name = "My Process",
                key = "my-process",
                versionTag = null,
                processDefinitionId = "process:1",
                sortOrder = 1
            )
        )
        val orderEntries = listOf(
            StartableItemOrderEntry("income-check", StartableItemType.BUILDING_BLOCK, 0),
            StartableItemOrderEntry("my-process", StartableItemType.PROCESS, 1)
        )
        whenever(managementService.updateOrder(caseDefinitionId, orderEntries)).thenReturn(reorderedItems)

        val requestBody = mapper.writeValueAsString(
            mapOf("items" to orderEntries)
        )

        mockMvc.perform(
            put("$basePath/order")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content(requestBody)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].key").value("income-check"))
            .andExpect(jsonPath("$[0].sortOrder").value(0))
            .andExpect(jsonPath("$[1].key").value("my-process"))
            .andExpect(jsonPath("$[1].sortOrder").value(1))

        verify(managementService).updateOrder(caseDefinitionId, orderEntries)
    }
}
