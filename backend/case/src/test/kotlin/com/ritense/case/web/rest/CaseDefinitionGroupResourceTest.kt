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

import com.ritense.BaseTest
import com.ritense.case.domain.group.CaseDefinitionGroup
import com.ritense.case.domain.group.CaseDefinitionGroupMember
import com.ritense.case.domain.group.CaseDefinitionGroupMemberId
import com.ritense.case.domain.group.GroupListColumn
import com.ritense.case.domain.group.GroupListColumnId
import com.ritense.case.domain.group.GroupSearchField
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case.service.GroupCaseInstanceService
import com.ritense.case.web.rest.dto.CaseListRowDto
import com.ritense.case.web.rest.dto.GroupCaseListRowDto
import com.ritense.document.domain.InternalCaseStatus
import com.ritense.document.domain.InternalCaseStatusColor
import com.ritense.document.domain.InternalCaseStatusId
import com.ritense.document.domain.search.SearchWithConfigRequest
import com.ritense.search.domain.DataType
import com.ritense.search.domain.DisplayType
import com.ritense.search.domain.EmptyDisplayTypeParameter
import com.ritense.search.domain.FieldType
import com.ritense.valtimo.contract.json.MapperSingleton
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.web.PageableHandlerMethodArgumentResolver
import org.springframework.http.MediaType
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import java.time.ZonedDateTime
import java.util.UUID

class CaseDefinitionGroupResourceTest : BaseTest() {

    private lateinit var mockMvc: MockMvc
    private lateinit var groupCaseInstanceService: GroupCaseInstanceService
    private lateinit var caseDefinitionService: CaseDefinitionService
    private lateinit var resource: CaseDefinitionGroupResource

    @BeforeEach
    fun setUp() {
        groupCaseInstanceService = mock()
        caseDefinitionService = mock()
        resource = CaseDefinitionGroupResource(groupCaseInstanceService, caseDefinitionService)

        val mapper = MapperSingleton.get()
        val converter = MappingJackson2HttpMessageConverter()
        converter.objectMapper = mapper

        mockMvc = MockMvcBuilders
            .standaloneSetup(resource)
            .setCustomArgumentResolvers(PageableHandlerMethodArgumentResolver())
            .setMessageConverters(converter)
            .build()
    }

    @Test
    fun `should return accessible groups`() {
        val group = createGroup("my-group", "My Group")
        whenever(groupCaseInstanceService.getAccessibleGroups()).thenReturn(listOf(group))

        mockMvc.perform(get("/api/v1/case-definition-group"))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].key").value("my-group"))
            .andExpect(jsonPath("$[0].title").value("My Group"))
            .andExpect(jsonPath("$[0].order").value(0))

        verify(groupCaseInstanceService).getAccessibleGroups()
    }

    @Test
    fun `should return single group`() {
        val group = createGroup("my-group", "My Group", description = "Test description", color = "#FF5733")
        whenever(groupCaseInstanceService.getGroup("my-group")).thenReturn(group)

        mockMvc.perform(get("/api/v1/case-definition-group/{groupKey}", "my-group"))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.key").value("my-group"))
            .andExpect(jsonPath("$.title").value("My Group"))
            .andExpect(jsonPath("$.description").value("Test description"))
            .andExpect(jsonPath("$.color").value("#FF5733"))

        verify(groupCaseInstanceService).getGroup("my-group")
    }

    @Test
    fun `should throw exception for unknown group`() {
        whenever(groupCaseInstanceService.getGroup("unknown")).thenThrow(NoSuchElementException("Group not found"))

        org.junit.jupiter.api.assertThrows<jakarta.servlet.ServletException> {
            mockMvc.perform(get("/api/v1/case-definition-group/{groupKey}", "unknown"))
                .andDo(print())
        }

        verify(groupCaseInstanceService).getGroup("unknown")
    }

    @Test
    fun `should return members with case definition names`() {
        val member = CaseDefinitionGroupMember(
            id = CaseDefinitionGroupMemberId("my-group", "my-case"),
            order = 0
        )
        val caseDefinition = caseDefinition(name = "My Case Definition")

        whenever(groupCaseInstanceService.getAccessibleMembers("my-group")).thenReturn(listOf(member))
        whenever(caseDefinitionService.getActiveCaseDefinition("my-case")).thenReturn(caseDefinition)

        mockMvc.perform(get("/api/v1/case-definition-group/{groupKey}/member", "my-group"))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].caseDefinitionKey").value("my-case"))
            .andExpect(jsonPath("$[0].caseDefinitionName").value("My Case Definition"))
            .andExpect(jsonPath("$[0].order").value(0))

        verify(groupCaseInstanceService).getAccessibleMembers("my-group")
        verify(caseDefinitionService).getActiveCaseDefinition("my-case")
    }

    @Test
    fun `should return list columns`() {
        val group = createGroup("my-group", "My Group")
        val column = GroupListColumn(
            id = GroupListColumnId("my-group", "column1"),
            group = group,
            title = "Column 1",
            displayType = DisplayType("text", EmptyDisplayTypeParameter()),
            sortable = true,
            defaultSort = null,
            order = 0,
            exportable = false
        )

        whenever(groupCaseInstanceService.getListColumns("my-group")).thenReturn(listOf(column))

        mockMvc.perform(get("/api/v1/case-definition-group/{groupKey}/list-column", "my-group"))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].key").value("column1"))
            .andExpect(jsonPath("$[0].title").value("Column 1"))
            .andExpect(jsonPath("$[0].sortable").value(true))

        verify(groupCaseInstanceService).getListColumns("my-group")
    }

    @Test
    fun `should return search fields`() {
        val group = createGroup("my-group", "My Group")
        val searchField = GroupSearchField(
            id = UUID.randomUUID(),
            groupKey = "my-group",
            group = group,
            key = "field1",
            title = "Field 1",
            dataType = DataType.TEXT,
            fieldType = FieldType.SINGLE,
            matchType = null,
            dropdownDataProvider = null,
            order = 0
        )

        whenever(groupCaseInstanceService.getSearchFields("my-group")).thenReturn(listOf(searchField))

        mockMvc.perform(get("/api/v1/case-definition-group/{groupKey}/search-field", "my-group"))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].key").value("field1"))
            .andExpect(jsonPath("$[0].title").value("Field 1"))
            .andExpect(jsonPath("$[0].dataType").value("text"))
            .andExpect(jsonPath("$[0].fieldType").value("single"))

        verify(groupCaseInstanceService).getSearchFields("my-group")
    }

    @Test
    fun `should return internal case statuses`() {
        val status = InternalCaseStatus(
            id = InternalCaseStatusId("my-case", "status1"),
            title = "Status 1",
            visibleInCaseListByDefault = true,
            order = 0,
            retentionPeriodInDays = 30,
            color = InternalCaseStatusColor.BLUE
        )

        whenever(groupCaseInstanceService.getInternalCaseStatuses("my-group")).thenReturn(listOf(status))

        mockMvc.perform(get("/api/v1/case-definition-group/{groupKey}/internal-status", "my-group"))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].key").value("status1"))
            .andExpect(jsonPath("$[0].title").value("Status 1"))

        verify(groupCaseInstanceService).getInternalCaseStatuses("my-group")
    }

    @Test
    fun `should search with filters`() {
        val searchResult = PageImpl(
            listOf(
                GroupCaseListRowDto(
                    id = UUID.randomUUID().toString(),
                    caseDefinitionKey = "my-case",
                    items = listOf(CaseListRowDto.CaseListItemDto("column1", "value1"))
                )
            )
        )
        val searchRequest = SearchWithConfigRequest()

        whenever(groupCaseInstanceService.search(eq("my-group"), any<SearchWithConfigRequest>(), any<Pageable>()))
            .thenReturn(searchResult)

        mockMvc.perform(
            post("/api/v1/case-definition-group/{groupKey}/search", "my-group")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content(MapperSingleton.get().writeValueAsString(searchRequest))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content.length()").value(1))
            .andExpect(jsonPath("$.content[0].caseDefinitionKey").value("my-case"))
            .andExpect(jsonPath("$.content[0].items[0].key").value("column1"))
            .andExpect(jsonPath("$.content[0].items[0].value").value("value1"))

        verify(groupCaseInstanceService).search(eq("my-group"), any<SearchWithConfigRequest>(), any<Pageable>())
    }

    private fun createGroup(
        key: String,
        title: String,
        description: String? = null,
        color: String? = null,
        order: Int = 0
    ): CaseDefinitionGroup {
        return CaseDefinitionGroup(
            key = key,
            title = title,
            description = description,
            order = order,
            color = color,
            createdBy = "test",
            createdOn = ZonedDateTime.now()
        )
    }
}
