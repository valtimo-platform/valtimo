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

import com.ritense.case.service.StartableItemService
import com.ritense.case.web.rest.dto.StartableItemDto
import com.ritense.case.web.rest.dto.StartableItemType
import com.ritense.valtimo.contract.json.MapperSingleton
import java.util.UUID
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.MediaType
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders

class StartableItemResourceTest {

    lateinit var mockMvc: MockMvc
    lateinit var startableItemService: StartableItemService

    @BeforeEach
    fun setUp() {
        startableItemService = mock()

        val resource = StartableItemResource(startableItemService)
        val converter = MappingJackson2HttpMessageConverter()
        converter.objectMapper = MapperSingleton.get()

        mockMvc = MockMvcBuilders
            .standaloneSetup(resource)
            .setMessageConverters(converter)
            .build()
    }

    @Test
    fun `should get startable items by caseDefinitionKey`() {
        val items = listOf(
            StartableItemDto(
                type = StartableItemType.PROCESS,
                name = "My Process",
                key = "my-process",
                versionTag = null,
                processDefinitionId = "process:1"
            )
        )
        whenever(startableItemService.getStartableItems(null, "my-case", null))
            .thenReturn(items)

        mockMvc.perform(
            get("/api/v1/case/startable-item")
                .param("caseDefinitionKey", "my-case")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].type").value("PROCESS"))
            .andExpect(jsonPath("$[0].name").value("My Process"))
            .andExpect(jsonPath("$[0].key").value("my-process"))

        verify(startableItemService).getStartableItems(null, "my-case", null)
    }

    @Test
    fun `should get startable items by caseDocumentId`() {
        val documentId = UUID.randomUUID()
        val items = listOf(
            StartableItemDto(
                type = StartableItemType.BUILDING_BLOCK,
                name = "Income Check",
                key = "income-check",
                versionTag = "1.0.0",
                processDefinitionId = "bb-process:1"
            )
        )
        whenever(startableItemService.getStartableItems(documentId, null, null))
            .thenReturn(items)

        mockMvc.perform(
            get("/api/v1/case/startable-item")
                .param("caseDocumentId", documentId.toString())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].type").value("BUILDING_BLOCK"))
            .andExpect(jsonPath("$[0].key").value("income-check"))
            .andExpect(jsonPath("$[0].versionTag").value("1.0.0"))

        verify(startableItemService).getStartableItems(documentId, null, null)
    }

    @Test
    fun `should throw when no parameters provided`() {
        assertThrows<Exception> {
            mockMvc.perform(
                get("/api/v1/case/startable-item")
                    .contentType(MediaType.APPLICATION_JSON_VALUE)
            )
        }
    }
}
