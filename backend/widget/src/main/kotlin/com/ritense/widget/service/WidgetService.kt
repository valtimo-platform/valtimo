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

package com.ritense.widget.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.WIDGET_KEY
import com.ritense.valueresolver.ValueResolverService
import com.ritense.widget.WidgetDataProvider
import com.ritense.widget.domain.Widget
import com.ritense.widget.repository.WidgetRepository
import java.util.UUID
import org.springframework.stereotype.Service
import kotlin.jvm.optionals.getOrNull

@SkipComponentScan
@Service
class WidgetService(
    private val widgetRepository: WidgetRepository,
    private val widgetDataProviders: List<WidgetDataProvider<Widget>>,
    private val valueResolverService: ValueResolverService,
) {

    fun create(widget: Widget): Widget {
        require(findById(widget.id) == null)
        return widgetRepository.save(widget)
    }

    fun update(widget: Widget): Widget {
        val existingWidget = findById(widget.id)
            ?: throw IllegalStateException("Search list widget not found")
        return widgetRepository.save(widget.copy(id = existingWidget.id))
    }

    fun delete(widgetId: UUID) {
        return widgetRepository.deleteById(widgetId)
    }

    fun findById(id: UUID): Widget? =
        widgetRepository.findById(id).getOrNull()

    fun filterWidgetsOnDisplayConditions(widgets: List<Widget>, properties: Map<String, Any>): List<Widget> {
        val conditionValuePaths = mutableSetOf<String>()
        widgets.forEach { widget ->
            widget.displayConditions.forEach {
                it.isValid { valuePath -> conditionValuePaths.add(valuePath) }
            }
        }

        return widgets.filter { widget ->
            val resolvedValuePaths = valueResolverService.resolveValues(
                properties + mapOf(
                    WIDGET_KEY to widget.key,
                ),
                conditionValuePaths
            )

            widget.displayConditions.all {
                it.isValid { valuePath: String ->
                    resolvedValuePaths[valuePath]
                }
            }
        }
    }

    fun getById(id: UUID): Widget =
        findById(id) ?: error("Widget $id not found")

    /** Widget key to the id of the upstream request it needs. */
    fun dataGroupIds(widgets: List<Widget>, properties: Map<String, Any>): Map<String, String> {
        val byKey = widgets.associateBy { it.key }
        return dataGroupIds(byKey.keys) { widgetKey ->
            val widget = byKey.getValue(widgetKey)
            WidgetDataDependencies(
                dependencies = valueResolverService.resolverDependencies(
                    properties + mapOf(WIDGET_KEY to widgetKey),
                    widget.getUnresolvedValues()
                ),
                paged = widget.isPaged(),
            )
        }
    }

    fun getWidgetData(widget: Widget, properties: Map<String, Any>): Any? {
        return runWithoutAuthorization {
            widgetDataProviders
                .first { provider -> provider.supportedWidgetType().isAssignableFrom(widget::class.java) }
                .getData(widget, properties)
        }
    }
}
