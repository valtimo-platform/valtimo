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

import com.ritense.valtimo.contract.conditions.Condition
import com.ritense.valtimo.contract.repository.ExpressionOperator
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.WIDGET_KEY
import com.ritense.valueresolver.ValueResolverService
import com.ritense.widget.domain.Widget
import com.ritense.widget.fields.FieldsWidget
import com.ritense.widget.fields.FieldsWidgetProperties
import com.ritense.widget.repository.WidgetRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

@ExtendWith(MockitoExtension::class)
class WidgetServiceTest(
    @Mock private val widgetRepository: WidgetRepository,
    @Mock private val valueResolverService: ValueResolverService,
) {

    private val widgetService = WidgetService(widgetRepository, emptyList(), valueResolverService)

    @Test
    fun `should resolve the union of all widget condition paths for every widget`() {
        val widgets = listOf(
            widget("first", condition("doc:/showFirst", "yes")),
            widget("second", condition("doc:/showSecond", "yes")),
        )
        resolveAllPathsAs("yes")

        widgetService.filterWidgetsOnDisplayConditions(widgets, emptyMap())

        val requestedValues = argumentCaptor<Collection<String>>()
        verify(valueResolverService, times(2))
            .resolveValues(any<Map<String, Any>>(), requestedValues.capture())
        requestedValues.allValues.forEach { paths ->
            assertThat(paths).containsExactlyInAnyOrder("doc:/showFirst", "doc:/showSecond")
        }
    }

    @Test
    fun `should resolve values once per widget`() {
        val widgets = listOf(
            widget("first", condition("doc:/showFirst", "yes")),
            widget("second", condition("doc:/showSecond", "yes")),
            widget("third"),
        )
        resolveAllPathsAs("yes")

        widgetService.filterWidgetsOnDisplayConditions(widgets, emptyMap())

        val properties = argumentCaptor<Map<String, Any>>()
        verify(valueResolverService, times(3))
            .resolveValues(properties.capture(), any<Collection<String>>())
        assertThat(properties.allValues.map { it[WIDGET_KEY] }).containsExactly("first", "second", "third")
    }

    @Test
    fun `should keep only widgets whose own conditions hold`() {
        val widgets = listOf(
            widget("first", condition("doc:/showFirst", "yes")),
            widget("second", condition("doc:/showSecond", "yes")),
        )
        whenever(valueResolverService.resolveValues(any<Map<String, Any>>(), any<Collection<String>>()))
            .thenReturn(mapOf("doc:/showFirst" to "yes", "doc:/showSecond" to "no"))

        val filtered = widgetService.filterWidgetsOnDisplayConditions(widgets, emptyMap())

        assertThat(filtered.map { it.key }).containsExactly("first")
    }

    @Test
    fun `should evaluate a condition that references another widget's path`() {
        val shared = "doc:/showBoth"
        val widgets = listOf(
            widget("first", condition(shared, "yes")),
            widget("second", condition(shared, "yes"), condition("doc:/showSecond", "yes")),
        )
        whenever(valueResolverService.resolveValues(any<Map<String, Any>>(), any<Collection<String>>()))
            .thenReturn(mapOf(shared to "yes", "doc:/showSecond" to "no"))

        val filtered = widgetService.filterWidgetsOnDisplayConditions(widgets, emptyMap())

        assertThat(filtered.map { it.key }).containsExactly("first")
    }

    private fun resolveAllPathsAs(value: Any?) {
        whenever(valueResolverService.resolveValues(any<Map<String, Any>>(), any<Collection<String>>()))
            .thenAnswer { invocation ->
                invocation.getArgument<Collection<String>>(1).associateWith { value }
            }
    }

    private fun condition(path: String, value: String) =
        Condition(path = path, operator = ExpressionOperator.EQUAL_TO, value = value)

    private fun widget(key: String, vararg displayConditions: Condition<*>): Widget = FieldsWidget(
        key = key,
        title = key,
        order = 0,
        width = 1,
        highContrast = false,
        displayConditions = displayConditions.toList(),
        properties = FieldsWidgetProperties(emptyList()),
    )
}
