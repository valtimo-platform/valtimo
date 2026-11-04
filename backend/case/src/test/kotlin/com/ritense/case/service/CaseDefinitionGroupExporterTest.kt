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

import com.ritense.case.deployment.CaseDefinitionGroupExportDto
import com.ritense.case.domain.ColumnDefaultSort
import com.ritense.case.domain.group.CaseDefinitionGroup
import com.ritense.case.domain.group.CaseDefinitionGroupMember
import com.ritense.case.domain.group.CaseDefinitionGroupMemberId
import com.ritense.case.domain.group.GroupListColumn
import com.ritense.case.domain.group.GroupListColumnId
import com.ritense.case.domain.group.GroupListColumnPathMapping
import com.ritense.case.domain.group.GroupListColumnPathMappingId
import com.ritense.case.domain.group.GroupSearchField
import com.ritense.case.domain.group.GroupSearchFieldPathMapping
import com.ritense.case.domain.group.GroupSearchFieldPathMappingId
import com.ritense.exporter.request.CaseDefinitionGroupExportRequest
import com.ritense.search.domain.DataType
import com.ritense.search.domain.DisplayType
import com.ritense.search.domain.EmptyDisplayTypeParameter
import com.ritense.search.domain.FieldType
import com.ritense.search.domain.SearchFieldMatchType
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.time.ZonedDateTime
import java.util.UUID

class CaseDefinitionGroupExporterTest {

    private lateinit var groupService: CaseDefinitionGroupService
    private lateinit var exporter: CaseDefinitionGroupExporter
    private val objectMapper = MapperSingleton.get()

    @BeforeEach
    fun setUp() {
        groupService = mock()
        exporter = CaseDefinitionGroupExporter(objectMapper, groupService)
    }

    @Test
    fun `should support CaseDefinitionGroupExportRequest`() {
        assertThat(exporter.supports()).isEqualTo(CaseDefinitionGroupExportRequest::class.java)
    }

    @Test
    fun `should export group with correct path`() {
        val group = createGroup("test-group", "Test Group")
        whenever(groupService.getGroup("test-group")).thenReturn(group)
        whenever(groupService.getMembers("test-group")).thenReturn(emptyList())
        whenever(groupService.getListColumnsWithMappings("test-group")).thenReturn(emptyList())
        whenever(groupService.getSearchFieldsWithMappings("test-group")).thenReturn(emptyList())

        val result = exporter.export(CaseDefinitionGroupExportRequest("test-group"))

        assertThat(result.exportFiles).hasSize(1)
        assertThat(result.exportFiles.first().path).isEqualTo("config/global/case-group/test-group/test-group.case-group.json")
        assertThat(result.relatedRequests).isEmpty()
    }

    @Test
    fun `should export group with members`() {
        val group = createGroup("my-group", "My Group")
        val member1 = createMember("my-group", "case-a", 0)
        val member2 = createMember("my-group", "case-b", 1)

        whenever(groupService.getGroup("my-group")).thenReturn(group)
        whenever(groupService.getMembers("my-group")).thenReturn(listOf(member1, member2))
        whenever(groupService.getListColumnsWithMappings("my-group")).thenReturn(emptyList())
        whenever(groupService.getSearchFieldsWithMappings("my-group")).thenReturn(emptyList())

        val result = exporter.export(CaseDefinitionGroupExportRequest("my-group"))

        val exportedJson = result.exportFiles.first().content.toString(Charsets.UTF_8)
        val dto = objectMapper.readValue(exportedJson, CaseDefinitionGroupExportDto::class.java)

        assertThat(dto.members).hasSize(2)
        assertThat(dto.members[0].caseDefinitionKey).isEqualTo("case-a")
        assertThat(dto.members[0].order).isEqualTo(0)
        assertThat(dto.members[1].caseDefinitionKey).isEqualTo("case-b")
        assertThat(dto.members[1].order).isEqualTo(1)
    }

    @Test
    fun `should export group with list columns and path mappings`() {
        val group = createGroup("my-group", "My Group")
        val column = createListColumn("my-group", "status", "Status")
        val mapping1 = createColumnPathMapping("my-group", "status", "case-a", "doc:status")
        val mapping2 = createColumnPathMapping("my-group", "status", "case-b", "doc:caseStatus")

        whenever(groupService.getGroup("my-group")).thenReturn(group)
        whenever(groupService.getMembers("my-group")).thenReturn(emptyList())
        whenever(groupService.getListColumnsWithMappings("my-group")).thenReturn(listOf(column to listOf(mapping1, mapping2)))
        whenever(groupService.getSearchFieldsWithMappings("my-group")).thenReturn(emptyList())

        val result = exporter.export(CaseDefinitionGroupExportRequest("my-group"))

        val exportedJson = result.exportFiles.first().content.toString(Charsets.UTF_8)
        val dto = objectMapper.readValue(exportedJson, CaseDefinitionGroupExportDto::class.java)

        assertThat(dto.listColumns).hasSize(1)
        assertThat(dto.listColumns[0].key).isEqualTo("status")
        assertThat(dto.listColumns[0].title).isEqualTo("Status")
        assertThat(dto.listColumns[0].pathMappings).hasSize(2)
        assertThat(dto.listColumns[0].pathMappings[0].caseDefinitionKey).isEqualTo("case-a")
        assertThat(dto.listColumns[0].pathMappings[0].path).isEqualTo("doc:status")
    }

    @Test
    fun `should export group with search fields and path mappings`() {
        val group = createGroup("my-group", "My Group")
        val fieldId = UUID.randomUUID()
        val field = createSearchField(fieldId, "my-group", "name", "Name")
        val mapping = createSearchFieldPathMapping(fieldId, "case-a", "doc:name")

        whenever(groupService.getGroup("my-group")).thenReturn(group)
        whenever(groupService.getMembers("my-group")).thenReturn(emptyList())
        whenever(groupService.getListColumnsWithMappings("my-group")).thenReturn(emptyList())
        whenever(groupService.getSearchFieldsWithMappings("my-group")).thenReturn(listOf(field to listOf(mapping)))

        val result = exporter.export(CaseDefinitionGroupExportRequest("my-group"))

        val exportedJson = result.exportFiles.first().content.toString(Charsets.UTF_8)
        val dto = objectMapper.readValue(exportedJson, CaseDefinitionGroupExportDto::class.java)

        assertThat(dto.searchFields).hasSize(1)
        assertThat(dto.searchFields[0].key).isEqualTo("name")
        assertThat(dto.searchFields[0].title).isEqualTo("Name")
        assertThat(dto.searchFields[0].dataType).isEqualTo(DataType.TEXT)
        assertThat(dto.searchFields[0].fieldType).isEqualTo(FieldType.SINGLE)
        assertThat(dto.searchFields[0].pathMappings).hasSize(1)
        assertThat(dto.searchFields[0].pathMappings[0].caseDefinitionKey).isEqualTo("case-a")
        assertThat(dto.searchFields[0].pathMappings[0].path).isEqualTo("doc:name")
    }

    @Test
    fun `should not include related export requests`() {
        val group = createGroup("my-group", "My Group")
        val member = createMember("my-group", "case-a", 0)

        whenever(groupService.getGroup("my-group")).thenReturn(group)
        whenever(groupService.getMembers("my-group")).thenReturn(listOf(member))
        whenever(groupService.getListColumnsWithMappings("my-group")).thenReturn(emptyList())
        whenever(groupService.getSearchFieldsWithMappings("my-group")).thenReturn(emptyList())

        val result = exporter.export(CaseDefinitionGroupExportRequest("my-group"))

        assertThat(result.relatedRequests).isEmpty()
    }

    private fun createGroup(key: String, title: String) = CaseDefinitionGroup(
        key = key,
        title = title,
        description = "Description",
        order = 0,
        color = "#FF0000",
        createdBy = "test",
        createdOn = ZonedDateTime.now()
    )

    private fun createMember(groupKey: String, caseDefKey: String, order: Int) = CaseDefinitionGroupMember(
        id = CaseDefinitionGroupMemberId(groupKey, caseDefKey),
        group = null,
        order = order
    )

    private fun createListColumn(groupKey: String, columnKey: String, title: String) = GroupListColumn(
        id = GroupListColumnId(groupKey, columnKey),
        group = null,
        title = title,
        displayType = DisplayType("text", EmptyDisplayTypeParameter()),
        sortable = true,
        defaultSort = ColumnDefaultSort.ASC,
        order = 0,
        exportable = true
    )

    private fun createColumnPathMapping(groupKey: String, columnKey: String, caseDefKey: String, path: String) =
        GroupListColumnPathMapping(
            id = GroupListColumnPathMappingId(groupKey, columnKey, caseDefKey),
            column = null,
            path = path
        )

    private fun createSearchField(id: UUID, groupKey: String, key: String, title: String) = GroupSearchField(
        id = id,
        groupKey = groupKey,
        group = null,
        key = key,
        title = title,
        dataType = DataType.TEXT,
        fieldType = FieldType.SINGLE,
        matchType = SearchFieldMatchType.LIKE,
        dropdownDataProvider = null,
        order = 0
    )

    private fun createSearchFieldPathMapping(fieldId: UUID, caseDefKey: String, path: String) =
        GroupSearchFieldPathMapping(
            id = GroupSearchFieldPathMappingId(fieldId, caseDefKey),
            searchField = null,
            path = path
        )
}
