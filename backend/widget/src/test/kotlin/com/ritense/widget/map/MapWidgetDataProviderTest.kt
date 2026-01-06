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

package com.ritense.widget.map

import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valueresolver.ValueResolverService
import com.ritense.widget.domain.NavigateToWidgetAction
import com.ritense.widget.map.geojson.GeoJson
import com.ritense.widget.map.geojson.GeoJsonGeometryMapper
import com.ritense.widget.map.geojson.GeoJsonMapper
import com.ritense.widget.map.geojson.GeoJsonNullMapper
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class MapWidgetDataProviderTest {

    private val valueResolverService: ValueResolverService = mock()
    private val objectMapper = MapperSingleton.get()
    private val geoJsonMappers: List<GeoJsonMapper> = listOf(GeoJsonGeometryMapper(objectMapper), GeoJsonNullMapper())
    private val dataProvider = MapWidgetDataProvider(valueResolverService, objectMapper, geoJsonMappers)

    @Test
    fun `getData includes resolved values in output`() {
        val widget = newWidget()

        whenever(valueResolverService.resolveValues(any<Map<String, Any>>(), anyOrNull<Collection<String>>()))
            .thenReturn(mapOf("doc:action" to "hyperlink"))

        val result = dataProvider.getData(widget, emptyMap())

        assertEquals("hyperlink", (result as Map<String, Any>)["\${doc:action}"])
    }

    @Test
    fun `getData normalizes FeatureCollection input into typed FeatureCollection`() {
        val widget = newWidget()

        whenever(valueResolverService.resolveValues(any<Map<String, Any>>(), anyOrNull<Collection<String>>()))
            .thenReturn(
                mapOf(
                    "doc:geo" to mapOf(
                        "type" to "Point",
                        "coordinates" to listOf(1.0, 2.0)
                    )
                )
            )

        val result = dataProvider.getData(widget, emptyMap())
        val fc = (result as Map<String, Any>)["geoJsonFeatureCollection"] as GeoJson.FeatureCollection

        assertEquals(1, fc.features.size)
        assertTrue(fc.features.first().geometry is GeoJson.Point)
    }


    @Test
    fun `getData merges widget exposed values with geoJsonFeatureCollection`() {
        val widget = newWidget()

        whenever(valueResolverService.resolveValues(any<Map<String, Any>>(), anyOrNull<Collection<String>>()))
            .thenReturn(
                mapOf(
                    "doc:action" to "hyperlink",
                    "doc:geo" to mapOf(
                        "type" to "Point",
                        "coordinates" to listOf(1.0, 2.0)
                    )
                )
            )

        val result = dataProvider.getData(widget, emptyMap())

        assertEquals("hyperlink", (result as Map<String, Any>)["\${doc:action}"])
        assertTrue(result["geoJsonFeatureCollection"] is GeoJson.FeatureCollection)

        val fc = result["geoJsonFeatureCollection"] as GeoJson.FeatureCollection
        assertEquals(1, fc.features.size)
    }

    private fun newWidget(): MapWidget = MapWidget(
        key = "key",
        title = "title",
        order = 0,
        width = 1,
        highContrast = false,
        isCompact = false,
        properties = MapWidgetProperties(listOf(MapWidgetProperties.GeoJsonSource("doc:geo"))),
        actions = listOf(NavigateToWidgetAction(null, "\${doc:action}"))
    )
}
