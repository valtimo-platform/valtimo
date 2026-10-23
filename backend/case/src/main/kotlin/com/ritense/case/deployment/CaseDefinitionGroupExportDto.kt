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

package com.ritense.case.deployment

import com.ritense.case.domain.ColumnDefaultSort
import com.ritense.case.domain.group.CaseDefinitionGroup
import com.ritense.case.domain.group.CaseDefinitionGroupMember
import com.ritense.case.domain.group.GroupListColumn
import com.ritense.case.domain.group.GroupListColumnPathMapping
import com.ritense.case.domain.group.GroupSearchField
import com.ritense.case.domain.group.GroupSearchFieldPathMapping
import com.ritense.search.domain.DataType
import com.ritense.search.domain.DisplayType
import com.ritense.search.domain.FieldType
import com.ritense.search.domain.SearchFieldMatchType

data class CaseDefinitionGroupExportDto(
    val key: String,
    val title: String,
    val description: String?,
    val order: Int,
    val color: String?,
    val members: List<CaseDefinitionGroupMemberExportDto>,
    val listColumns: List<GroupListColumnExportDto>,
    val searchFields: List<GroupSearchFieldExportDto>
) {
    companion object {
        fun of(
            group: CaseDefinitionGroup,
            members: List<CaseDefinitionGroupMember>,
            listColumnsWithMappings: List<Pair<GroupListColumn, List<GroupListColumnPathMapping>>>,
            searchFieldsWithMappings: List<Pair<GroupSearchField, List<GroupSearchFieldPathMapping>>>
        ) = CaseDefinitionGroupExportDto(
            key = group.key,
            title = group.title,
            description = group.description,
            order = group.order,
            color = group.color,
            members = members.map { CaseDefinitionGroupMemberExportDto.of(it) },
            listColumns = listColumnsWithMappings.map { (column, mappings) ->
                GroupListColumnExportDto.of(column, mappings)
            },
            searchFields = searchFieldsWithMappings.map { (field, mappings) ->
                GroupSearchFieldExportDto.of(field, mappings)
            }
        )
    }
}

data class CaseDefinitionGroupMemberExportDto(
    val caseDefinitionKey: String,
    val order: Int
) {
    companion object {
        fun of(member: CaseDefinitionGroupMember) = CaseDefinitionGroupMemberExportDto(
            caseDefinitionKey = member.id.caseDefinitionKey,
            order = member.order
        )
    }
}

data class GroupListColumnExportDto(
    val key: String,
    val title: String?,
    val displayType: DisplayType,
    val sortable: Boolean,
    val defaultSort: ColumnDefaultSort?,
    val order: Int,
    val exportable: Boolean,
    val pathMappings: List<GroupPathMappingExportDto>
) {
    companion object {
        fun of(column: GroupListColumn, mappings: List<GroupListColumnPathMapping>) = GroupListColumnExportDto(
            key = column.id.columnKey,
            title = column.title,
            displayType = column.displayType,
            sortable = column.sortable,
            defaultSort = column.defaultSort,
            order = column.order,
            exportable = column.exportable,
            pathMappings = mappings.map { GroupPathMappingExportDto.of(it.id.caseDefinitionKey, it.path) }
        )
    }
}

data class GroupSearchFieldExportDto(
    val key: String,
    val title: String?,
    val dataType: DataType,
    val fieldType: FieldType,
    val matchType: SearchFieldMatchType?,
    val dropdownDataProvider: String?,
    val order: Int,
    val pathMappings: List<GroupPathMappingExportDto>
) {
    companion object {
        fun of(field: GroupSearchField, mappings: List<GroupSearchFieldPathMapping>) = GroupSearchFieldExportDto(
            key = field.key,
            title = field.title,
            dataType = field.dataType,
            fieldType = field.fieldType,
            matchType = field.matchType,
            dropdownDataProvider = field.dropdownDataProvider,
            order = field.order,
            pathMappings = mappings.map { GroupPathMappingExportDto.of(it.id.caseDefinitionKey, it.path) }
        )
    }
}

data class GroupPathMappingExportDto(
    val caseDefinitionKey: String,
    val path: String
) {
    companion object {
        fun of(caseDefinitionKey: String, path: String) = GroupPathMappingExportDto(
            caseDefinitionKey = caseDefinitionKey,
            path = path
        )
    }
}
