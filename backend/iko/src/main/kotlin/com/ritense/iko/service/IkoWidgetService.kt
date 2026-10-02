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
import com.ritense.valueresolver.ValueResolverCache
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.IKO_VIEW_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.TAB_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.WIDGET_KEY
import com.ritense.widget.domain.Widget
import com.ritense.widget.service.WidgetService
import com.ritense.widget.web.rest.dto.WidgetDataEnvelope
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate

@SkipComponentScan
@Service
class IkoWidgetService(
    private val ikoTabService: IkoTabService,
    private val ikoTabWidgetRepository: IkoTabWidgetRepository,
    private val widgetService: WidgetService,
    private val ikoViewService: IkoViewService,
    transactionManager: PlatformTransactionManager,
) {

    private val readOnlyTransactionTemplate = TransactionTemplate(transactionManager).apply { isReadOnly = true }

    @Transactional(readOnly = true)
    fun findByKey(ikoViewKey: String, tabKey: String, widgetKey: String): Widget? {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        val tab = ikoTabService.findByKey(ikoViewKey, tabKey) ?: return null
        return ikoTabWidgetRepository.findByIdTabIdAndWidgetKey(tab.id, widgetKey)?.widget
    }

    @Transactional(readOnly = true)
    fun getByKey(ikoViewKey: String, tabKey: String, widgetKey: String): Widget {
        return ValueResolverCache.value(WIDGET_BY_KEY_CACHE, listOf(ikoViewKey, tabKey, widgetKey)) {
            findByKey(ikoViewKey, tabKey, widgetKey)
                ?: error("Widget $widgetKey not found")
        }
    }

    @Transactional(readOnly = true)
    fun findAllByTabKey(ikoViewKey: String, tabKey: String): List<Widget> {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        val tab = ikoTabService.getByKey(ikoViewKey, tabKey)
        return ikoTabWidgetRepository.findAllByIdTabIdOrderByWidgetOrder(tab.id).map { it.widget }
    }

    fun findAllByTabKeyFilteredByDisplayConditions(ikoViewKey: String, tabKey: String): List<Widget> {
        val widgets = readOnlyTransactionTemplate.execute { findAllByTabKey(ikoViewKey, tabKey) }!!
        return ValueResolverCache.memoized {
            widgetService.filterWidgetsOnDisplayConditions(
                widgets = widgets,
                properties = mapOf(
                    IKO_VIEW_KEY to ikoViewKey,
                    TAB_KEY to tabKey,
                )
            )
        }
    }

    @Transactional
    fun deleteByKey(ikoViewKey: String, tabKey: String, widgetKey: String) {
        ikoViewService.denyAuthorization()
        val tab = ikoTabService.getByKey(ikoViewKey, tabKey)
        ikoTabWidgetRepository.deleteByIdTabIdAndWidgetKey(tab.id, widgetKey)
    }

    @Transactional
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

    @Transactional
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
        val widget = readOnlyTransactionTemplate.execute { getByKey(ikoViewKey, tabKey, widgetKey) }!!
        return widgetService.getWidgetData(widget, properties)
    }

    fun dataGroupIds(ikoViewKey: String, tabKey: String, widgets: List<Widget>): Map<String, String> {
        return widgetService.dataGroupIds(widgets, dataGroupProperties(ikoViewKey, tabKey))
    }

    /**
     * Every widget in the group, with its data or an error envelope. One cache scope, so the group
     * pays for its shared upstream request once. Null when the group matches no widget.
     *
     * Same filtered list as the widget listing, so a hidden widget costs no call and ships no data.
     */
    fun getWidgetDataGroup(
        ikoViewKey: String,
        tabKey: String,
        group: String,
        properties: Map<String, Any>,
    ): Map<String, WidgetDataEnvelope>? = ValueResolverCache.memoized {
        val widgets = findAllByTabKeyFilteredByDisplayConditions(ikoViewKey, tabKey)
        val groupIds = dataGroupIds(ikoViewKey, tabKey, widgets)
        val groupWidgets = widgets.filter { groupIds[it.key] == group }
        if (groupWidgets.isEmpty()) {
            return@memoized null
        }

        groupWidgets.associate { widget ->
            widget.key to envelopeFor(widget, properties + mapOf(WIDGET_KEY to widget.key))
        }
    }

    private fun envelopeFor(widget: Widget, properties: Map<String, Any>): WidgetDataEnvelope {
        return try {
            WidgetDataEnvelope.of(widgetService.getWidgetData(widget, properties))
        } catch (e: Exception) {
            logger.error(e) { "Failed to get data for widget '${widget.key}'" }
            WidgetDataEnvelope.failed()
        }
    }

    private fun dataGroupProperties(ikoViewKey: String, tabKey: String) = mapOf(
        IKO_VIEW_KEY to ikoViewKey,
        TAB_KEY to tabKey,
    )

    companion object {
        private const val WIDGET_BY_KEY_CACHE = "ikoWidgetByKey"
        private val logger = KotlinLogging.logger {}
    }
}
