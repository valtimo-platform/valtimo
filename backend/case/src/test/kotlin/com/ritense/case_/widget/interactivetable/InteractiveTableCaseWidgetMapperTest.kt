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

package com.ritense.case_.widget.interactivetable

import com.ritense.search.domain.ColumnDefaultSort
import com.ritense.search.domain.DataType
import com.ritense.search.domain.FieldType
import com.ritense.widget.domain.NavigateToWidgetAction
import com.ritense.widget.domain.WidgetColor
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class InteractiveTableCaseWidgetMapperTest {

    private val mapper = InteractiveTableCaseWidgetMapper()

    @Test
    fun `toEntity should default color to WHITE`() {
        assertEquals(WidgetColor.WHITE, mapper.toEntity(dto(), 0).color)
    }

    @Test
    fun `should round-trip dto through entity`() {
        val dto = dto()

        val result = mapper.toDto(mapper.toEntity(dto, 0))

        assertEquals(dto.copy(color = WidgetColor.WHITE), result)
    }

    private fun dto() = InteractiveTableCaseWidgetDto(
        key = "key",
        title = "title",
        icon = null,
        color = null,
        width = 2,
        highContrast = false,
        isCompact = null,
        actions = emptyList(),
        displayConditions = emptyList(),
        properties = InteractiveTableCaseWidgetProperties(
            collection = "iko:/things",
            defaultPageSize = 10,
            columns = listOf(
                InteractiveTableCaseWidgetProperties.Column(
                    key = "name",
                    title = "Name",
                    value = "$.name",
                    sortable = true,
                    defaultSort = ColumnDefaultSort.ASC
                )
            ),
            filters = listOf(
                InteractiveTableCaseWidgetProperties.FilterConfig(
                    key = "name",
                    title = "Name",
                    dataType = DataType.TEXT,
                    fieldType = FieldType.SINGLE
                )
            ),
            firstColumnAsTitle = true,
            rowClickAction = NavigateToWidgetAction(name = null, navigateTo = "/x/\${\$.id}"),
            canStartCase = true
        )
    )
}
