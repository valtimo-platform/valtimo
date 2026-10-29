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

package com.ritense.widget.service

import com.ritense.valueresolver.ValueResolverDependencies
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

internal class WidgetDataGroupIdTest {

    @Test
    fun `should return the same id for the same dependency set`() {
        val dependencies = listOf("iko" to listOf("iko-view", "klant", "general"))

        assertThat(dataGroupId(dependencies)).isEqualTo(dataGroupId(dependencies))
    }

    @Test
    fun `should return the same id for separately constructed but equal dependencies`() {
        val first = listOf("iko" to listOf("iko-view", "klant", "general", emptyList<String>()))
        val second = listOf("iko" to listOf("iko-view", "klant", "general", emptyList<String>()))

        assertThat(dataGroupId(first)).isEqualTo(dataGroupId(second))
    }

    @Test
    fun `should ignore dependency order`() {
        val first = listOf("doc" to "1234", "zaak" to "1234")
        val second = listOf("zaak" to "1234", "doc" to "1234")

        assertThat(dataGroupId(first)).isEqualTo(dataGroupId(second))
    }

    @Test
    fun `should differ when a dependency differs`() {
        val fieldWidget = listOf("iko" to listOf("iko-view", "klant", "general", emptyList<String>()))
        val containerWidget = listOf("iko" to listOf("iko-view", "klant", "general", listOf("nationaliteiten")))

        assertThat(dataGroupId(fieldWidget)).isNotEqualTo(dataGroupId(containerWidget))
    }

    @Test
    fun `should differ when the prefix differs`() {
        assertThat(dataGroupId(listOf("doc" to "1234")))
            .isNotEqualTo(dataGroupId(listOf("zaak" to "1234")))
    }

    @Test
    fun `should differ for a subset of dependencies`() {
        assertThat(dataGroupId(listOf("doc" to "1234")))
            .isNotEqualTo(dataGroupId(listOf("doc" to "1234", "zaak" to "1234")))
    }

    @Test
    fun `should return the reserved id when there is no external dependency`() {
        assertThat(dataGroupId(emptyList())).isEqualTo(NO_DATA_GROUP_ID)
    }

    @Test
    fun `should return a short hex id`() {
        assertThat(dataGroupId(listOf("doc" to "1234"))).matches("[0-9a-f]{16}")
    }

    @Test
    fun `should group widgets that share a dependency`() {
        val ids = dataGroupIds(listOf("first", "second")) { keyedOn("doc", "1234") }

        assertThat(ids["first"]).isEqualTo(ids["second"])
        assertThat(ids["first"]).isNotEqualTo(NO_DATA_GROUP_ID)
    }

    @Test
    fun `should give a paged widget a group of its own`() {
        val ids = dataGroupIds(listOf("fields", "table")) { widgetKey ->
            WidgetDataDependencies(keyed("doc", "1234"), paged = widgetKey == "table")
        }

        assertThat(ids["table"]).isNotEqualTo(ids["fields"])
    }

    @Test
    fun `should give every paged widget a group of its own`() {
        val ids = dataGroupIds(listOf("table", "collection")) {
            WidgetDataDependencies(keyed("doc", "1234"), paged = true)
        }

        assertThat(ids["table"]).isNotEqualTo(ids["collection"])
    }

    @Test
    fun `should give a widget with an unkeyed prefix a group of its own`() {
        val ids = dataGroupIds(listOf("first", "second")) {
            WidgetDataDependencies(ValueResolverDependencies(emptySet(), setOf("mystery")))
        }

        assertThat(ids["first"]).isNotEqualTo(ids["second"])
        assertThat(ids["first"]).isNotEqualTo(NO_DATA_GROUP_ID)
    }

    @Test
    fun `should not bundle a widget whose dependencies are only partly known`() {
        val ids = dataGroupIds(listOf("known", "partly")) { widgetKey ->
            WidgetDataDependencies(
                if (widgetKey == "known") keyed("doc", "1234")
                else ValueResolverDependencies(setOf("doc" to "1234"), setOf("mystery"))
            )
        }

        assertThat(ids["partly"]).isNotEqualTo(ids["known"])
    }

    @Test
    fun `should share the reserved id between widgets that request nothing`() {
        val ids = dataGroupIds(listOf("first", "second")) {
            WidgetDataDependencies(ValueResolverDependencies.NONE)
        }

        assertThat(ids.values).containsOnly(NO_DATA_GROUP_ID)
    }

    @Test
    fun `should give a widget whose dependencies cannot be determined a group of its own`() {
        val ids = dataGroupIds(listOf("first", "second")) { widgetKey ->
            if (widgetKey == "first") error("boom") else keyedOn("doc", "1234")
        }

        assertThat(ids["first"]).isNotEqualTo(ids["second"])
        assertThat(ids["first"]).isNotEqualTo(NO_DATA_GROUP_ID)
    }

    private fun keyed(prefix: String, key: Any) =
        ValueResolverDependencies(setOf(prefix to key), emptySet())

    private fun keyedOn(prefix: String, key: Any) = WidgetDataDependencies(keyed(prefix, key))
}
