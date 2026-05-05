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

package com.ritense.widget.highlight

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.whenever
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class HighlightWidgetDataProviderTest(
    @Mock private val valueResolverService: ValueResolverService
) {

    private val dataProvider = HighlightWidgetDataProvider(valueResolverService)
    private val objectMapper = ObjectMapper()

    @Test
    fun `should count array items for ARRAY_COUNT display type`() {
        val widget = testWidget(HighlightDisplayType.ARRAY_COUNT)
        val properties = mapOf<String, Any>("documentId" to "doc-1")
        whenever(valueResolverService.resolveValues(eq(properties), any()))
            .thenReturn(mapOf("doc:/items" to listOf("a", "b", "c")))

        val result = dataProvider.getData(widget, properties) as Map<*, *>

        assertThat(result["value"]).isEqualTo(3)
    }

    @Test
    fun `should count ArrayNode items for ARRAY_COUNT display type`() {
        val widget = testWidget(HighlightDisplayType.ARRAY_COUNT)
        val properties = mapOf<String, Any>("documentId" to "doc-1")
        val arrayNode = objectMapper.createArrayNode().add("a").add("b")
        whenever(valueResolverService.resolveValues(eq(properties), any()))
            .thenReturn(mapOf("doc:/items" to arrayNode))

        val result = dataProvider.getData(widget, properties) as Map<*, *>

        assertThat(result["value"]).isEqualTo(2)
    }

    @Test
    fun `should return 0 for ARRAY_COUNT when value is not an array`() {
        val widget = testWidget(HighlightDisplayType.ARRAY_COUNT)
        val properties = mapOf<String, Any>("documentId" to "doc-1")
        whenever(valueResolverService.resolveValues(eq(properties), any()))
            .thenReturn(mapOf("doc:/items" to "not-an-array"))

        val result = dataProvider.getData(widget, properties) as Map<*, *>

        assertThat(result["value"]).isEqualTo(0)
    }

    @Test
    fun `should return 0 for ARRAY_COUNT when value is null`() {
        val widget = testWidget(HighlightDisplayType.ARRAY_COUNT)
        val properties = mapOf<String, Any>("documentId" to "doc-1")
        whenever(valueResolverService.resolveValues(eq(properties), any()))
            .thenReturn(mapOf("doc:/items" to null))

        val result = dataProvider.getData(widget, properties) as Map<*, *>

        assertThat(result["value"]).isEqualTo(0)
    }

    @Test
    fun `should return numeric value for NUMBER display type`() {
        val widget = testWidget(HighlightDisplayType.NUMBER)
        val properties = mapOf<String, Any>("documentId" to "doc-1")
        whenever(valueResolverService.resolveValues(eq(properties), any()))
            .thenReturn(mapOf("doc:/items" to 42))

        val result = dataProvider.getData(widget, properties) as Map<*, *>

        assertThat(result["value"]).isEqualTo(42)
    }

    @Test
    fun `should return string value for TEXT display type`() {
        val widget = testWidget(HighlightDisplayType.TEXT)
        val properties = mapOf<String, Any>("documentId" to "doc-1")
        whenever(valueResolverService.resolveValues(eq(properties), any()))
            .thenReturn(mapOf("doc:/items" to "hello"))

        val result = dataProvider.getData(widget, properties) as Map<*, *>

        assertThat(result["value"]).isEqualTo("hello")
    }

    @Test
    fun `should convert non-string value to string for TEXT display type`() {
        val widget = testWidget(HighlightDisplayType.TEXT)
        val properties = mapOf<String, Any>("documentId" to "doc-1")
        whenever(valueResolverService.resolveValues(eq(properties), any()))
            .thenReturn(mapOf("doc:/items" to 123))

        val result = dataProvider.getData(widget, properties) as Map<*, *>

        assertThat(result["value"]).isEqualTo("123")
    }

    private fun testWidget(displayType: HighlightDisplayType) = HighlightWidget(
        id = UUID.randomUUID(),
        key = "test-highlight",
        title = "Test",
        order = 0,
        width = 1,
        highContrast = false,
        properties = HighlightWidgetProperties(
            value = "doc:/items",
            displayProperties = HighlightDisplayProperties(type = displayType),
        ),
    )
}
