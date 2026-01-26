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

package com.ritense.iko.service

import com.ritense.iko.authorization.IkoViewActionProvider.Companion.VIEW
import com.ritense.iko.domain.IkoTabWidget
import com.ritense.iko.domain.IkoTabWidgetId
import com.ritense.iko.repository.IkoTabWidgetRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.IKO_VIEW_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.TAB_KEY
import com.ritense.widget.domain.Widget
import com.ritense.widget.service.WidgetService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Transactional
@SkipComponentScan
@Service
class IkoWidgetService(
    private val ikoTabService: IkoTabService,
    private val ikoTabWidgetRepository: IkoTabWidgetRepository,
    private val widgetService: WidgetService,
    private val ikoViewService: IkoViewService,
) {

    fun findByKey(ikoViewKey: String, tabKey: String, widgetKey: String): Widget? {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        val tab = ikoTabService.findByKey(ikoViewKey, tabKey) ?: return null
        return ikoTabWidgetRepository.findByIdTabIdAndWidgetKey(tab.id, widgetKey)?.widget
    }

    fun getByKey(ikoViewKey: String, tabKey: String, widgetKey: String): Widget {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        return findByKey(ikoViewKey, tabKey, widgetKey)
            ?: error("Widget $widgetKey not found")
    }

    fun findAllByTabKey(ikoViewKey: String, tabKey: String): List<Widget> {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        val tab = ikoTabService.getByKey(ikoViewKey, tabKey)
        return ikoTabWidgetRepository.findAllByIdTabIdOrderByWidgetOrder(tab.id).map { it.widget }
    }

    fun findAllByTabKeyFilteredByDisplayConditions(ikoViewKey: String, tabKey: String): List<Widget> {
        return widgetService.filterWidgetsOnDisplayConditions(
            widgets = findAllByTabKey(ikoViewKey, tabKey),
            properties = mapOf(
                IKO_VIEW_KEY to ikoViewKey,
                TAB_KEY to tabKey,
            )
        )
    }

    fun deleteByKey(ikoViewKey: String, tabKey: String, widgetKey: String) {
        ikoViewService.denyAuthorization()
        val tab = ikoTabService.getByKey(ikoViewKey, tabKey)
        ikoTabWidgetRepository.deleteByIdTabIdAndWidgetKey(tab.id, widgetKey)
    }

    fun create(ikoViewKey: String, tabKey: String, widget: Widget): Widget {
        ikoViewService.denyAuthorization()
        val tab = ikoTabService.getByKey(ikoViewKey, tabKey)
        require(ikoTabWidgetRepository.findByIdTabIdAndWidgetKey(tab.id, widget.key) == null)
        val createdWidget = widgetService.create(widget)
        ikoTabWidgetRepository.save(
            IkoTabWidget(
                id = IkoTabWidgetId(tab.id, createdWidget.id),
                widget = createdWidget,
            )
        )
        return createdWidget
    }

    fun update(ikoViewKey: String, tabKey: String, widget: Widget): Widget {
        ikoViewService.denyAuthorization()
        val tab = ikoTabService.getByKey(ikoViewKey, tabKey)
        requireNotNull(ikoTabWidgetRepository.findByIdTabIdAndWidgetKey(tab.id, widget.key))
        val updatedWidget = widgetService.update(widget)
        ikoTabWidgetRepository.save(
            IkoTabWidget(
                id = IkoTabWidgetId(tab.id, updatedWidget.id),
                widget = updatedWidget,
            )
        )
        return updatedWidget
    }

    fun getWidgetData(
        ikoViewKey: String,
        tabKey: String,
        widgetKey: String,
        properties: Map<String, Any>,
    ): Any? {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        val widget = getByKey(ikoViewKey, tabKey, widgetKey)
        return widgetService.getWidgetData(widget, properties)
    }

}
