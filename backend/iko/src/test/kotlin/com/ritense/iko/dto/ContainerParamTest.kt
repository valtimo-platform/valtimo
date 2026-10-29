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

package com.ritense.iko.dto

import com.ritense.case_.widget.interactivetable.InteractiveTableCaseWidgetProperties
import com.ritense.search.domain.DataType
import com.ritense.search.domain.FieldType
import com.ritense.search.domain.SearchFieldMatchType
import com.ritense.widget.interactivetable.InteractiveTableWidgetProperties
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class ContainerParamTest {

    @Test
    fun `should map exact single filter identically for case and iko config`() {
        assertParity(FieldType.SINGLE, SearchFieldMatchType.EXACT, "john", listOf("k" to "john"))
    }

    @Test
    fun `should map filter without match type identically for case and iko config`() {
        assertParity(FieldType.SINGLE, null, "john", listOf("k" to "john"))
    }

    @Test
    fun `should map like filter identically for case and iko config`() {
        assertParity(FieldType.SINGLE, SearchFieldMatchType.LIKE, "jo", listOf("k~" to "jo"))
    }

    @Test
    fun `should map range filter identically for case and iko config`() {
        assertParity(
            FieldType.RANGE,
            SearchFieldMatchType.EXACT,
            """{"rangeFrom":"1","rangeTo":"5"}""",
            listOf("k>=" to "1", "k<" to "5")
        )
    }

    @Test
    fun `should map multi select filter identically for case and iko config`() {
        assertParity(
            FieldType.MULTI_SELECT_DROPDOWN,
            SearchFieldMatchType.EXACT,
            listOf("a", "b"),
            listOf("k" to "a,b")
        )
    }

    @Test
    fun `should map empty value to no filter identically for case and iko config`() {
        assertParity(FieldType.SINGLE, SearchFieldMatchType.EXACT, "", emptyList())
    }

    private fun assertParity(
        fieldType: FieldType,
        matchType: SearchFieldMatchType?,
        value: Any,
        expected: List<Pair<String, String>>
    ) {
        val caseConfig = InteractiveTableCaseWidgetProperties.FilterConfig(
            key = "k",
            title = "K",
            dataType = DataType.TEXT,
            fieldType = fieldType,
            matchType = matchType
        )
        val ikoConfig = InteractiveTableWidgetProperties.FilterConfig(
            key = "k",
            title = "K",
            dataType = DataType.TEXT,
            fieldType = fieldType,
            matchType = matchType
        )

        val fromCase = ContainerParam.fromFilter(caseConfig, value)
        val fromIko = ContainerParam.fromFilter(ikoConfig, value)

        assertThat(fromCase).isEqualTo(fromIko).isEqualTo(expected)
    }
}
