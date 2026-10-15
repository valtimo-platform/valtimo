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

package com.ritense.widget.table

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class TableWidgetPropertiesTest {

    @Test
    fun `should keep noDataMessage when deserialized and serialized again`() {
        val properties: TableWidgetProperties = MapperSingleton.get().readValue(
            """{"collection":"doc:children","defaultPageSize":5,"columns":[{"key":"name","title":"Name","value":"name"}],"noDataMessage":"No children registered"}"""
        )

        assertThat(MapperSingleton.get().valueToTree<JsonNode>(properties).path("noDataMessage").asText())
            .isEqualTo("No children registered")
    }

    @Test
    fun `should omit noDataMessage when absent`() {
        val properties: TableWidgetProperties = MapperSingleton.get().readValue(
            """{"collection":"doc:children","defaultPageSize":5,"columns":[{"key":"name","title":"Name","value":"name"}],"firstColumnAsTitle":true}"""
        )

        assertThat(properties.firstColumnAsTitle).isTrue()
        assertThat(MapperSingleton.get().valueToTree<JsonNode>(properties).has("noDataMessage")).isFalse()
    }
}
