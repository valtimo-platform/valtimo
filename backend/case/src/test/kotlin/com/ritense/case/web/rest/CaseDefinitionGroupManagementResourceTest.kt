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

import com.ritense.case.domain.ColumnDefaultSort
import com.ritense.case.domain.group.CaseDefinitionGroup
import com.ritense.case.domain.group.CaseDefinitionGroupMember
import com.ritense.case.domain.group.CaseDefinitionGroupMemberId
import com.ritense.case.domain.group.GroupListColumn
import com.ritense.case.domain.group.GroupListColumnId
import com.ritense.case.domain.group.GroupSearchField
import com.ritense.case.service.CaseDefinitionGroupService
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case.web.rest.dto.AddGroupMemberRequestDto
import com.ritense.case.web.rest.dto.CaseDefinitionGroupCreateRequestDto
import com.ritense.case.web.rest.dto.CaseDefinitionGroupUpdateRequestDto
import com.ritense.case.web.rest.dto.GroupListColumnDto
import com.ritense.case.web.rest.dto.GroupSearchFieldDto
import com.ritense.case.web.rest.dto.UpdateGroupMemberOrderRequestDto
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.search.domain.DataType
import com.ritense.search.domain.DisplayType
import com.ritense.search.domain.EmptyDisplayTypeParameter
import com.ritense.search.domain.FieldType
import com.ritense.search.domain.SearchFieldMatchType
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
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
import java.time.LocalDateTime
import java.time.ZonedDateTime
import java.util.UUID

class CaseDefinitionGroupManagementResourceTest {

    private lateinit var mockMvc: MockMvc
    private lateinit var groupService: CaseDefinitionGroupService
    private lateinit var caseDefinitionService: CaseDefinitionService
    private lateinit var resource: CaseDefinitionGroupManagementResource

    @BeforeEach
    fun setUp() {
        groupService = mock()
        caseDefinitionService = mock()
        resource = CaseDefinitionGroupManagementResource(groupService, caseDefinitionService)

        val mapper = MapperSingleton.get()
        val converter = MappingJackson2HttpMessageConverter()
        converter.objectMapper = mapper

        mockMvc = MockMvcBuilders
            .standaloneSetup(resource)
            .setMessageConverters(converter)
            .build()
    }

    @Test
    fun `should return all groups with member counts`() {
        val group1 = createGroup("group-1", "Group 1")
        val group2 = createGroup("group-2", "Group 2")
        whenever(groupService.getGroups()).thenReturn(listOf(group1, group2))
        whenever(groupService.getMemberCountsByGroup()).thenReturn(mapOf("group-1" to 3, "group-2" to 1))

        mockMvc.perform(get("/api/management/v1/case-definition-group"))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].key").value("group-1"))
            .andExpect(jsonPath("$[0].title").value("Group 1"))
            .andExpect(jsonPath("$[0].memberCount").value(3))
            .andExpect(jsonPath("$[1].key").value("group-2"))
            .andExpect(jsonPath("$[1].memberCount").value(1))
    }

    @Test
    fun `should return group with members`() {
        val group = createGroup("my-group", "My Group")
        val member = createMember("my-group", "my-case", 0)
        val caseDef = createCaseDefinition("my-case", "My Case Definition")

        whenever(groupService.getGroup("my-group")).thenReturn(group)
        whenever(groupService.getMembers("my-group")).thenReturn(listOf(member))
        whenever(caseDefinitionService.getActiveCaseDefinition("my-case")).thenReturn(caseDef)

        mockMvc.perform(get("/api/management/v1/case-definition-group/{groupKey}", "my-group"))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.key").value("my-group"))
            .andExpect(jsonPath("$.title").value("My Group"))
            .andExpect(jsonPath("$.members.length()").value(1))
            .andExpect(jsonPath("$.members[0].caseDefinitionKey").value("my-case"))
            .andExpect(jsonPath("$.members[0].caseDefinitionName").value("My Case Definition"))
    }

    @Test
    fun `should create group`() {
        val request = CaseDefinitionGroupCreateRequestDto(
            title = "New Group",
            description = "A test group",
            color = "#FF5733"
        )
        val createdGroup = createGroup("new-group", "New Group", "A test group", "#FF5733")
        whenever(groupService.createGroup("New Group", "A test group", "#FF5733")).thenReturn(createdGroup)

        mockMvc.perform(
            post("/api/management/v1/case-definition-group")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content(MapperSingleton.get().writeValueAsString(request))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.key").value("new-group"))
            .andExpect(jsonPath("$.title").value("New Group"))
            .andExpect(jsonPath("$.description").value("A test group"))
            .andExpect(jsonPath("$.color").value("#FF5733"))

        verify(groupService).createGroup("New Group", "A test group", "#FF5733")
    }

    @Test
    fun `should update group`() {
        val request = CaseDefinitionGroupUpdateRequestDto(
            title = "Updated Title",
            description = "Updated description",
            color = "#00FF00"
        )
        val updatedGroup = createGroup("my-group", "Updated Title", "Updated description", "#00FF00")
        whenever(groupService.updateGroup("my-group", "Updated Title", "Updated description", "#00FF00")).thenReturn(updatedGroup)

        mockMvc.perform(
            put("/api/management/v1/case-definition-group/{groupKey}", "my-group")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content(MapperSingleton.get().writeValueAsString(request))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.title").value("Updated Title"))
            .andExpect(jsonPath("$.description").value("Updated description"))
            .andExpect(jsonPath("$.color").value("#00FF00"))

        verify(groupService).updateGroup("my-group", "Updated Title", "Updated description", "#00FF00")
    }

    @Test
    fun `should delete group`() {
        mockMvc.perform(
            delete("/api/management/v1/case-definition-group/{groupKey}", "my-group")
        )
            .andDo(print())
            .andExpect(status().isNoContent)

        verify(groupService).deleteGroup("my-group")
    }

    @Test
    fun `should add member to group`() {
        val request = AddGroupMemberRequestDto(caseDefinitionKey = "my-case")
        val member = createMember("my-group", "my-case", 0)
        val caseDef = createCaseDefinition("my-case", "My Case")

        whenever(groupService.addMember("my-group", "my-case")).thenReturn(member)
        whenever(caseDefinitionService.getActiveCaseDefinition("my-case")).thenReturn(caseDef)

        mockMvc.perform(
            post("/api/management/v1/case-definition-group/{groupKey}/member", "my-group")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content(MapperSingleton.get().writeValueAsString(request))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.caseDefinitionKey").value("my-case"))
            .andExpect(jsonPath("$.caseDefinitionName").value("My Case"))
            .andExpect(jsonPath("$.order").value(0))

        verify(groupService).addMember("my-group", "my-case")
    }

    @Test
    fun `should remove member from group`() {
        mockMvc.perform(
            delete("/api/management/v1/case-definition-group/{groupKey}/member/{caseDefinitionKey}", "my-group", "my-case")
        )
            .andDo(print())
            .andExpect(status().isNoContent)

        verify(groupService).removeMember("my-group", "my-case")
    }

    @Test
    fun `should update member order`() {
        val request = UpdateGroupMemberOrderRequestDto(
            caseDefinitionKeys = listOf("case-b", "case-a", "case-c")
        )
        val member1 = createMember("my-group", "case-b", 0)
        val member2 = createMember("my-group", "case-a", 1)
        val member3 = createMember("my-group", "case-c", 2)

        whenever(groupService.getMembers("my-group")).thenReturn(listOf(member1, member2, member3))
        whenever(caseDefinitionService.getActiveCaseDefinition(any())).thenReturn(null)

        mockMvc.perform(
            put("/api/management/v1/case-definition-group/{groupKey}/member/order", "my-group")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content(MapperSingleton.get().writeValueAsString(request))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(3))

        verify(groupService).updateMemberOrder("my-group", listOf("case-b", "case-a", "case-c"))
    }

    @Test
    fun `should get list columns`() {
        val column = createListColumn("my-group", "name", "Name", 0)
        whenever(groupService.getListColumnsWithMappings("my-group")).thenReturn(listOf(column to emptyList()))

        mockMvc.perform(get("/api/management/v1/case-definition-group/{groupKey}/list-column", "my-group"))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].key").value("name"))
            .andExpect(jsonPath("$[0].title").value("Name"))
    }

    @Test
    fun `should update list columns`() {
        val columnDto = GroupListColumnDto(
            key = "name",
            title = "Name",
            displayType = DisplayType("text", EmptyDisplayTypeParameter()),
            defaultSort = null,
            sortable = true,
            order = 0,
            exportable = false,
            pathMappings = emptyList()
        )
        val updatedColumn = createListColumn("my-group", "name", "Name", 0)
        whenever(groupService.updateListColumns(any(), any())).thenReturn(listOf(updatedColumn))

        mockMvc.perform(
            put("/api/management/v1/case-definition-group/{groupKey}/list-column", "my-group")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content(MapperSingleton.get().writeValueAsString(listOf(columnDto)))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].key").value("name"))
    }

    @Test
    fun `should get search fields`() {
        val field = createSearchField("my-group", "status", "Status", 0)
        whenever(groupService.getSearchFields("my-group")).thenReturn(listOf(field))

        mockMvc.perform(get("/api/management/v1/case-definition-group/{groupKey}/search-field", "my-group"))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].key").value("status"))
            .andExpect(jsonPath("$[0].title").value("Status"))
    }

    @Test
    fun `should update search fields`() {
        val fieldDto = GroupSearchFieldDto(
            key = "status",
            title = "Status",
            dataType = DataType.TEXT,
            fieldType = FieldType.SINGLE,
            matchType = SearchFieldMatchType.EXACT,
            dropdownDataProvider = null,
            order = 0,
            pathMappings = emptyList()
        )
        val updatedField = createSearchField("my-group", "status", "Status", 0)
        whenever(groupService.updateSearchFields(any(), any())).thenReturn(listOf(updatedField))

        mockMvc.perform(
            put("/api/management/v1/case-definition-group/{groupKey}/search-field", "my-group")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content(MapperSingleton.get().writeValueAsString(listOf(fieldDto)))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].key").value("status"))
    }

    private fun createGroup(
        key: String,
        title: String,
        description: String? = null,
        color: String? = null
    ): CaseDefinitionGroup {
        return CaseDefinitionGroup(
            key = key,
            title = title,
            description = description,
            color = color,
            order = 0,
            createdBy = "test-user",
            createdOn = ZonedDateTime.now()
        )
    }

    private fun createMember(groupKey: String, caseDefinitionKey: String, order: Int): CaseDefinitionGroupMember {
        return CaseDefinitionGroupMember(
            id = CaseDefinitionGroupMemberId(groupKey, caseDefinitionKey),
            order = order
        )
    }

    private fun createCaseDefinition(key: String, name: String): CaseDefinition {
        return CaseDefinition(
            id = CaseDefinitionId.of(key, "1.0.0"),
            name = name,
            description = null,
            createdBy = "test",
            createdDate = LocalDateTime.now(),
            basedOnVersionTag = null,
            final = false,
            active = true
        )
    }

    private fun createListColumn(groupKey: String, columnKey: String, title: String, order: Int): GroupListColumn {
        return GroupListColumn(
            id = GroupListColumnId(groupKey, columnKey),
            title = title,
            displayType = DisplayType("text", EmptyDisplayTypeParameter()),
            defaultSort = null,
            sortable = true,
            order = order,
            exportable = false
        )
    }

    private fun createSearchField(groupKey: String, fieldKey: String, title: String, order: Int): GroupSearchField {
        return GroupSearchField(
            id = UUID.randomUUID(),
            groupKey = groupKey,
            key = fieldKey,
            title = title,
            dataType = DataType.TEXT,
            fieldType = FieldType.SINGLE,
            matchType = SearchFieldMatchType.EXACT,
            dropdownDataProvider = null,
            order = order
        )
    }
}
