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

package com.ritense.widget.metroline

import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.IKO_VIEW_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.TAB_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.WIDGET_KEY
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.whenever
import java.time.LocalDateTime
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class MetrolineWidgetDataProviderTest(
    @Mock private val valueResolverService: ValueResolverService,
) {

    private val widgetDataProvider = MetrolineWidgetDataProvider(MapperSingleton.get(), valueResolverService)

    @Test
    fun `should map nested ZGW shape with JSON Pointer paths`() {
        val widget = testWidget()
        val properties = ikoProperties()
        mockSource(widget, listOf(stepOpen, stepInBehandeling, stepBesluit))

        val data = widgetDataProvider.getData(widget, properties)

        assertThat(data).hasSize(3)
        assertThat(data[0].title).isEqualTo("Aanvraag ontvangen")
        assertThat(data[0].label).isEqualTo("Aanvraag is binnengekomen")
        assertThat(data[0].completed).isEqualTo(LocalDateTime.parse("2025-08-15T10:30:00"))
        assertThat(data[1].title).isEqualTo("In behandeling")
        assertThat(data[1].completed).isEqualTo(LocalDateTime.parse("2025-09-02T14:15:00"))
        assertThat(data[2].title).isEqualTo("Besluit")
        assertThat(data[2].completed).isNull()
    }

    @Test
    fun `should leave label null when labelPath not configured`() {
        val widget = testWidget(labelPath = null)
        mockSource(widget, listOf(stepOpen))

        val data = widgetDataProvider.getData(widget, ikoProperties())

        assertThat(data).hasSize(1)
        assertThat(data[0].label).isNull()
        assertThat(data[0].title).isEqualTo("Aanvraag ontvangen")
    }

    @Test
    fun `should leave completed null when completedPath value is missing`() {
        val widget = testWidget()
        mockSource(widget, listOf(mapOf(
            "statustype" to mapOf("omschrijving" to "Aanvraag", "toelichting" to "x"),
            // no datumStatusGezet
        )))

        val data = widgetDataProvider.getData(widget, ikoProperties())

        assertThat(data).hasSize(1)
        assertThat(data[0].completed).isNull()
    }

    @Test
    fun `should parse zoned ISO-8601 timestamps with UTC Z suffix`() {
        val widget = testWidget()
        mockSource(widget, listOf(mapOf(
            "statustype" to mapOf("omschrijving" to "Aanvraag", "toelichting" to "x"),
            "datumStatusGezet" to "2025-08-15T10:30:00Z",
        )))

        val data = widgetDataProvider.getData(widget, ikoProperties())

        assertThat(data).hasSize(1)
        assertThat(data[0].completed).isEqualTo(LocalDateTime.parse("2025-08-15T10:30:00"))
    }

    @Test
    fun `should parse zoned ISO-8601 timestamps with offset`() {
        val widget = testWidget()
        mockSource(widget, listOf(mapOf(
            "statustype" to mapOf("omschrijving" to "Aanvraag", "toelichting" to "x"),
            "datumStatusGezet" to "2025-08-15T10:30:00+02:00",
        )))

        val data = widgetDataProvider.getData(widget, ikoProperties())

        assertThat(data).hasSize(1)
        assertThat(data[0].completed).isEqualTo(LocalDateTime.parse("2025-08-15T10:30:00"))
    }

    @Test
    fun `should parse zoned ISO-8601 timestamps with zone name suffix`() {
        val widget = testWidget()
        mockSource(widget, listOf(mapOf(
            "statustype" to mapOf("omschrijving" to "Aanvraag", "toelichting" to "x"),
            "datumStatusGezet" to "2025-08-15T10:30:00+02:00[Europe/Amsterdam]",
        )))

        val data = widgetDataProvider.getData(widget, ikoProperties())

        assertThat(data).hasSize(1)
        assertThat(data[0].completed).isEqualTo(LocalDateTime.parse("2025-08-15T10:30:00"))
    }

    @Test
    fun `should leave completed null when completedPath value is not parseable`() {
        val widget = testWidget()
        mockSource(widget, listOf(mapOf(
            "statustype" to mapOf("omschrijving" to "Aanvraag", "toelichting" to "x"),
            "datumStatusGezet" to "not-a-date",
        )))

        val data = widgetDataProvider.getData(widget, ikoProperties())

        assertThat(data).hasSize(1)
        assertThat(data[0].completed).isNull()
    }

    @Test
    fun `should support JSONPath expressions for fields`() {
        val widget = testWidget(
            titlePath = "$.statustype.omschrijving",
            labelPath = "$.statustype.toelichting",
            completedPath = "$.datumStatusGezet",
        )
        mockSource(widget, listOf(stepOpen))

        val data = widgetDataProvider.getData(widget, ikoProperties())

        assertThat(data).hasSize(1)
        assertThat(data[0].title).isEqualTo("Aanvraag ontvangen")
        assertThat(data[0].label).isEqualTo("Aanvraag is binnengekomen")
        assertThat(data[0].completed).isEqualTo(LocalDateTime.parse("2025-08-15T10:30:00"))
    }

    @Test
    fun `should normalize bare-key paths without a leading slash`() {
        val widget = testWidget(
            titlePath = "title",
            labelPath = "label",
            completedPath = "completed",
        )
        mockSource(widget, listOf(mapOf(
            "title" to "Step A",
            "label" to "Description A",
            "completed" to "2025-08-15T10:30:00",
        )))

        val data = widgetDataProvider.getData(widget, ikoProperties())

        assertThat(data).hasSize(1)
        assertThat(data[0].title).isEqualTo("Step A")
        assertThat(data[0].label).isEqualTo("Description A")
        assertThat(data[0].completed).isEqualTo(LocalDateTime.parse("2025-08-15T10:30:00"))
    }

    @Test
    fun `should return empty list when source is null`() {
        val widget = testWidget()
        mockSource(widget, null)

        val data = widgetDataProvider.getData(widget, ikoProperties())

        assertThat(data).isEmpty()
    }

    @Test
    fun `should return empty list when source is not an array`() {
        val widget = testWidget()
        mockSource(widget, "not an array")

        val data = widgetDataProvider.getData(widget, ikoProperties())

        assertThat(data).isEmpty()
    }

    @Test
    fun `should return empty list when source is an empty array`() {
        val widget = testWidget()
        mockSource(widget, emptyList<Any>())

        val data = widgetDataProvider.getData(widget, ikoProperties())

        assertThat(data).isEmpty()
    }

    @Test
    fun `should skip rows that are not container nodes`() {
        val widget = testWidget()
        mockSource(widget, listOf(stepOpen, "scalar row", stepBesluit))

        val data = widgetDataProvider.getData(widget, ikoProperties())

        assertThat(data).hasSize(2)
        assertThat(data[0].title).isEqualTo("Aanvraag ontvangen")
        assertThat(data[1].title).isEqualTo("Besluit")
    }

    private fun testWidget(
        titlePath: String = "/statustype/omschrijving",
        labelPath: String? = "/statustype/toelichting",
        completedPath: String = "/datumStatusGezet",
    ) = MetrolineWidget(
        id = UUID.fromString("3ab43f1a-0154-4658-82b8-41527def0ae2"),
        key = "key",
        title = "Test",
        order = 0,
        width = 1,
        highContrast = false,
        isCompact = null,
        actions = emptyList(),
        properties = MetrolineWidgetProperties(
            orientation = MetrolineOrientation.VERTICAL,
            source = "iko:/statushistorie",
            titlePath = titlePath,
            labelPath = labelPath,
            completedPath = completedPath,
        ),
    )

    private fun ikoProperties() = mapOf(
        ID to "id",
        IKO_VIEW_KEY to "ikoViewKey",
        TAB_KEY to "tabKey",
        WIDGET_KEY to "widgetKey",
    )

    private fun mockSource(widget: MetrolineWidget, sourceValue: Any?) {
        whenever(
            valueResolverService.resolveValues(
                any<Map<String, Any>>(),
                eq(listOf(widget.properties.source)),
            )
        ).thenReturn(mapOf(widget.properties.source to sourceValue))
    }

    private val stepOpen = mapOf(
        "statustype" to mapOf(
            "omschrijving" to "Aanvraag ontvangen",
            "toelichting" to "Aanvraag is binnengekomen",
        ),
        "datumStatusGezet" to "2025-08-15T10:30:00",
    )

    private val stepInBehandeling = mapOf(
        "statustype" to mapOf(
            "omschrijving" to "In behandeling",
            "toelichting" to "Behandelaar bekijkt de aanvraag",
        ),
        "datumStatusGezet" to "2025-09-02T14:15:00",
    )

    private val stepBesluit = mapOf(
        "statustype" to mapOf(
            "omschrijving" to "Besluit",
            "toelichting" to "Het definitieve besluit",
        ),
        "datumStatusGezet" to null,
    )
}
