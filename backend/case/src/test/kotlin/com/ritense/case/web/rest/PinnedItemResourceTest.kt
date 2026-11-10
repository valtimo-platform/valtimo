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

import com.ritense.case.domain.PinnedItemType
import com.ritense.case.service.PinnedItemService
import com.ritense.case.web.rest.dto.PinnedItemCreateRequestDto
import com.ritense.case.web.rest.dto.PinnedItemResponseDto
import com.ritense.valtimo.contract.json.MapperSingleton
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.MediaType
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders

class PinnedItemResourceTest {

    private lateinit var mockMvc: MockMvc
    private lateinit var pinnedItemService: PinnedItemService
    private lateinit var resource: PinnedItemResource

    @BeforeEach
    fun setUp() {
        pinnedItemService = mock()
        resource = PinnedItemResource(pinnedItemService)

        val mapper = MapperSingleton.get()
        val converter = MappingJackson2HttpMessageConverter()
        converter.objectMapper = mapper

        mockMvc = MockMvcBuilders
            .standaloneSetup(resource)
            .setMessageConverters(converter)
            .build()
    }

    @Test
    fun `should return list of pinned items`() {
        val pinnedItems = listOf(
            PinnedItemResponseDto(
                itemType = PinnedItemType.CASE_DEFINITION,
                itemKey = "my-case",
                order = 0,
                displayName = "My Case",
                color = "#FF5733"
            ),
            PinnedItemResponseDto(
                itemType = PinnedItemType.CASE_DEFINITION_GROUP,
                itemKey = "my-group",
                order = 1,
                displayName = "My Group",
                color = null
            )
        )
        whenever(pinnedItemService.getPinnedItems()).thenReturn(pinnedItems)

        mockMvc.perform(get("/api/v1/pinned-item"))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].itemType").value("CASE_DEFINITION"))
            .andExpect(jsonPath("$[0].itemKey").value("my-case"))
            .andExpect(jsonPath("$[0].order").value(0))
            .andExpect(jsonPath("$[0].displayName").value("My Case"))
            .andExpect(jsonPath("$[0].color").value("#FF5733"))
            .andExpect(jsonPath("$[1].itemType").value("CASE_DEFINITION_GROUP"))
            .andExpect(jsonPath("$[1].itemKey").value("my-group"))

        verify(pinnedItemService).getPinnedItems()
    }

    @Test
    fun `should return empty list when no pinned items`() {
        whenever(pinnedItemService.getPinnedItems()).thenReturn(emptyList())

        mockMvc.perform(get("/api/v1/pinned-item"))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(0))

        verify(pinnedItemService).getPinnedItems()
    }

    @Test
    fun `should pin item and return 201`() {
        val request = PinnedItemCreateRequestDto(
            itemType = PinnedItemType.CASE_DEFINITION,
            itemKey = "my-case"
        )

        mockMvc.perform(
            post("/api/v1/pinned-item")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content(MapperSingleton.get().writeValueAsString(request))
        )
            .andDo(print())
            .andExpect(status().isCreated)

        verify(pinnedItemService).pinItem(PinnedItemType.CASE_DEFINITION, "my-case")
    }

    @Test
    fun `should return 400 for invalid pin request with blank itemKey`() {
        val invalidJson = """{"itemType": "CASE_DEFINITION", "itemKey": ""}"""

        mockMvc.perform(
            post("/api/v1/pinned-item")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content(invalidJson)
        )
            .andDo(print())
            .andExpect(status().isBadRequest)
    }

    @Test
    fun `should unpin item and return 204`() {
        mockMvc.perform(
            delete("/api/v1/pinned-item/{itemType}/{itemKey}", "CASE_DEFINITION", "my-case")
        )
            .andDo(print())
            .andExpect(status().isNoContent)

        verify(pinnedItemService).unpinItem(PinnedItemType.CASE_DEFINITION, "my-case")
    }
}
