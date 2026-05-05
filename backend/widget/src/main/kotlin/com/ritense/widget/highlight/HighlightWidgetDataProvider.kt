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

import com.fasterxml.jackson.databind.node.ArrayNode
import com.ritense.valueresolver.ValueResolverService
import com.ritense.widget.WidgetDataProvider

class HighlightWidgetDataProvider(
    private val valueResolverService: ValueResolverService,
) : WidgetDataProvider<HighlightWidget> {

    override fun supportedWidgetType() = HighlightWidget::class.java

    override fun getData(widget: HighlightWidget, properties: Map<String, Any>): Any {
        val resolvedValues = valueResolverService.resolveValues(properties, widget.getUnresolvedValues())
        val rawValue = resolvedValues[widget.properties.value]

        val transformedValue = when (widget.properties.displayProperties.type) {
            HighlightDisplayType.ARRAY_COUNT -> countArray(rawValue)
            HighlightDisplayType.NUMBER -> rawValue
            HighlightDisplayType.TEXT -> rawValue?.toString()
        }

        return widget.getExposedValues { path -> resolvedValues[path] } +
            mapOf("value" to transformedValue)
    }

    private fun countArray(value: Any?): Int = when (value) {
        is Collection<*> -> value.size
        is ArrayNode -> value.size()
        is Array<*> -> value.size
        else -> 0
    }
}
