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

package com.ritense.document.domain.search

import com.ritense.document.domain.impl.searchfield.SearchFieldDataType
import com.ritense.document.domain.impl.searchfield.SearchFieldFieldType
import com.ritense.document.domain.impl.searchfield.SearchFieldMatchType
import com.ritense.document.domain.search.SearchWithConfigRequest.SearchWithConfigFilter
import com.ritense.document.service.GlobalSearchFieldMeta
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.ZoneOffset

class SearchRequestMapperGroupFilterTest {

    @Test
    fun `unknown field keeps a like filter on the key`() {
        val filter = map(values("name", "abc"), null)

        assertThat(filter.path).isEqualTo("name")
        assertThat(filter.searchType).isEqualTo(DatabaseSearchType.LIKE)
        assertThat(filter.getValues<Any>()).containsExactly("abc")
    }

    @Test
    fun `number field matches exactly`() {
        val filter = map(values("amount", 4), meta(SearchFieldDataType.NUMBER, SearchFieldFieldType.SINGLE))

        assertThat(filter.path).isEqualTo("amount")
        assertThat(filter.searchType).isEqualTo(DatabaseSearchType.EQUAL)
        assertThat(filter.getValues<Any>()).containsExactly(4)
    }

    @Test
    fun `boolean field matches exactly`() {
        val filter = map(values("urgent", true), meta(SearchFieldDataType.BOOLEAN, SearchFieldFieldType.SINGLE))

        assertThat(filter.searchType).isEqualTo(DatabaseSearchType.EQUAL)
        assertThat(filter.getValues<Any>()).containsExactly(true)
    }

    @Test
    fun `text field with match type like keeps contains matching`() {
        val filter = map(
            values("name", "abc"),
            meta(SearchFieldDataType.TEXT, SearchFieldFieldType.SINGLE, SearchFieldMatchType.LIKE)
        )

        assertThat(filter.searchType).isEqualTo(DatabaseSearchType.LIKE)
    }

    @Test
    fun `number range with both bounds becomes between`() {
        val filter = map(range("size", 85, 100), meta(SearchFieldDataType.NUMBER, SearchFieldFieldType.RANGE))

        assertThat(filter.searchType).isEqualTo(DatabaseSearchType.BETWEEN)
        assertThat(filter.getRangeFrom<Int>()).isEqualTo(85)
        assertThat(filter.getRangeTo<Int>()).isEqualTo(100)
    }

    @Test
    fun `number range with one bound becomes an open range`() {
        val from = map(range("size", 85, null), meta(SearchFieldDataType.NUMBER, SearchFieldFieldType.RANGE))
        val to = map(range("size", null, 100), meta(SearchFieldDataType.NUMBER, SearchFieldFieldType.RANGE))

        assertThat(from.searchType).isEqualTo(DatabaseSearchType.GREATER_THAN_OR_EQUAL_TO)
        assertThat(to.searchType).isEqualTo(DatabaseSearchType.LESS_THAN_OR_EQUAL_TO)
    }

    @Test
    fun `date range covers whole days`() {
        val filter = map(
            range("created", "2020-01-01", "2020-12-31"),
            meta(SearchFieldDataType.DATE, SearchFieldFieldType.RANGE)
        )

        assertThat(filter.path).isEqualTo("created")
        assertThat(filter.searchType).isEqualTo(DatabaseSearchType.BETWEEN)
        assertThat(filter.getRangeFrom<Instant>()).isEqualTo(Instant.parse("2020-01-01T00:00:00Z"))
        assertThat(filter.getRangeTo<Instant>()).isEqualTo(Instant.parse("2021-01-01T00:00:00Z"))
    }

    private fun map(filter: SearchWithConfigFilter, meta: GlobalSearchFieldMeta?) =
        SearchRequestMapper.toGroupOtherFilter(filter, meta, ZoneOffset.UTC)

    private fun meta(
        dataType: SearchFieldDataType,
        fieldType: SearchFieldFieldType,
        matchType: SearchFieldMatchType? = null
    ) = GlobalSearchFieldMeta(dataType, fieldType, matchType)

    private fun values(key: String, vararg values: Any) = SearchWithConfigFilter().apply {
        this.key = key
        setValues(values.toList())
    }

    private fun range(key: String, from: Any?, to: Any?) = SearchWithConfigFilter().apply {
        this.key = key
        setRangeFrom(from)
        setRangeTo(to)
    }
}
