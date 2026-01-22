/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.widget.interactivetable

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonInclude.Include
import com.ritense.search.domain.ColumnDefaultSort
import com.ritense.search.domain.DataType
import com.ritense.search.domain.FieldType
import com.ritense.search.domain.SearchFieldMatchType
import com.ritense.widget.displayproperties.FieldDisplayProperties
import com.ritense.widget.domain.WidgetAction
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.validation.Valid
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty

data class InteractiveTableWidgetProperties(
    @field:NotBlank val collection: String,
    @field:Min(1) val defaultPageSize: Int,
    @field:NotEmpty val columns: List<@Valid Column>,
    val filters: List<FilterConfig> = emptyList(),
    val firstColumnAsTitle: Boolean = false,
    val rowClickAction: WidgetAction? = null,
    val canStartCase: Boolean? = false,
) {
    @JsonInclude(Include.NON_NULL)
    data class Column(
        @field:NotBlank val key: String,
        val title: String?,
        @field:NotBlank val value: String,
        @field:Valid val displayProperties: FieldDisplayProperties? = null,
        val sortable: Boolean = false,
        val defaultSort: ColumnDefaultSort? = null,
    )

    @JsonInclude(Include.NON_NULL)
    data class FilterConfig(
        @field:NotBlank val key: String,
        @field:NotBlank val title: String?,

        @Enumerated(EnumType.STRING)
        @field:NotBlank val dataType: DataType,

        @Enumerated(EnumType.STRING)
        @field:NotBlank val fieldType: FieldType,

        @Enumerated(EnumType.STRING)
        val matchType: SearchFieldMatchType? = SearchFieldMatchType.EXACT
    )
}
