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

package com.ritense.case_.widget.table

import com.ritense.widget.domain.WidgetColor
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class TableCaseWidgetMapperTest {

    private val mapper = TableCaseWidgetMapper()

    @Test
    fun `toEntity should default color to WHITE`() {
        val dto = TableCaseWidgetDto(
            key = "key",
            title = "title",
            icon = null,
            color = null,
            width = 2,
            highContrast = false,
            isCompact = null,
            actions = emptyList(),
            displayConditions = emptyList(),
            properties = TableWidgetProperties(
                collection = "collection",
                defaultPageSize = 10,
                columns = listOf(
                    TableWidgetProperties.Column(
                        key = "name",
                        title = "Name",
                        value = "$.name"
                    )
                )
            )
        )

        val entity = mapper.toEntity(dto, 0)

        assertEquals(WidgetColor.WHITE, entity.color)
    }
}
