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

package com.ritense.case.web.rest.dto

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonProperty
import com.ritense.case.domain.ColumnDefaultSort
import com.ritense.case.domain.group.GroupListColumn
import com.ritense.search.domain.DisplayType

@JsonInclude(JsonInclude.Include.NON_EMPTY)
data class GroupListColumnDto(
    val key: String,
    val title: String?,
    val displayType: DisplayType,
    val sortable: Boolean,
    val defaultSort: ColumnDefaultSort?,
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    val order: Int?,
    val exportable: Boolean = false
) {
    companion object {
        fun of(column: GroupListColumn) = GroupListColumnDto(
            key = column.id.columnKey,
            title = column.title,
            displayType = column.displayType,
            sortable = column.sortable,
            defaultSort = column.defaultSort,
            order = column.order,
            exportable = column.exportable
        )
    }
}
