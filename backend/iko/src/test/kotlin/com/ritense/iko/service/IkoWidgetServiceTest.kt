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

package com.ritense.iko.service

import com.ritense.iko.domain.IkoTabWidget
import com.ritense.iko.domain.IkoTabWidgetId
import com.ritense.iko.repository.IkoTabWidgetRepository
import com.ritense.tab.domain.Tab
import com.ritense.widget.domain.Widget
import com.ritense.widget.fields.FieldsWidget
import com.ritense.widget.fields.FieldsWidgetProperties
import com.ritense.widget.service.WidgetService
import com.ritense.widget.web.rest.dto.WidgetDataEnvelope
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionStatus

internal class IkoWidgetServiceTest {

    private val ikoTabService: IkoTabService = mock()
    private val ikoTabWidgetRepository: IkoTabWidgetRepository = mock()
    private val widgetService: WidgetService = mock()
    private val ikoViewService: IkoViewService = mock()
    private val transactionManager: PlatformTransactionManager = mock<PlatformTransactionManager>().apply {
        whenever(getTransaction(any())).thenReturn(mock<TransactionStatus>())
    }

    private val ikoWidgetService = IkoWidgetService(
        ikoTabService,
        ikoTabWidgetRepository,
        widgetService,
        ikoViewService,
        transactionManager,
    )

    @Test
    fun `should return an error envelope for a failing widget while its peers return data`() {
        val widgets = listOf(widget("klant"), widget("verblijfplaats"))
        mockTabWidgets(widgets)
        whenever(widgetService.getWidgetData(eq(widgets[0]), any())).thenReturn(mapOf("naam" to "Jan"))
        whenever(widgetService.getWidgetData(eq(widgets[1]), any())).thenThrow(RuntimeException("boom"))

        val group = ikoWidgetService.getWidgetDataGroup("klant", "general", GROUP, emptyMap())

        assertThat(group).isNotNull
        assertThat(group!!["klant"]).isEqualTo(WidgetDataEnvelope.of(mapOf("naam" to "Jan")))
        assertThat(group["verblijfplaats"]).isEqualTo(WidgetDataEnvelope.failed())
    }

    @Test
    fun `should only serve the widgets of the requested group`() {
        val widgets = listOf(widget("klant"), widget("nationaliteiten"))
        mockTabWidgets(widgets, mapOf("klant" to GROUP, "nationaliteiten" to "other"))
        whenever(widgetService.getWidgetData(eq(widgets[0]), any())).thenReturn(mapOf("naam" to "Jan"))

        val group = ikoWidgetService.getWidgetDataGroup("klant", "general", GROUP, emptyMap())

        assertThat(group).containsOnlyKeys("klant")
    }

    @Test
    fun `should return null when the group matches no widget`() {
        mockTabWidgets(listOf(widget("klant")))

        assertThat(ikoWidgetService.getWidgetDataGroup("klant", "general", "unknown", emptyMap())).isNull()
    }

    private fun mockTabWidgets(
        widgets: List<Widget>,
        groupIds: Map<String, String> = widgets.associate { it.key to GROUP },
    ) {
        val tab = Tab(key = "general", title = "Algemeen", order = 0, type = "widgets")
        whenever(ikoTabService.getByKey("klant", "general")).thenReturn(tab)
        whenever(ikoTabWidgetRepository.findAllByIdTabIdOrderByWidgetOrder(eq(tab.id))).thenReturn(
            widgets.map { IkoTabWidget(IkoTabWidgetId(tab.id, it.id), it) }
        )
        whenever(widgetService.filterWidgetsOnDisplayConditions(any(), any())).thenReturn(widgets)
        whenever(widgetService.dataGroupIds(any(), any())).thenReturn(groupIds)
    }

    private fun widget(key: String): Widget = FieldsWidget(
        key = key,
        title = key,
        order = 0,
        width = 1,
        highContrast = false,
        properties = FieldsWidgetProperties(emptyList()),
    )

    private companion object {
        const val GROUP = "group"
    }
}
