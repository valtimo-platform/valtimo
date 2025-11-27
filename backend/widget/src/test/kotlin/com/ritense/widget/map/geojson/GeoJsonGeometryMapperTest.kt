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

package com.ritense.widget.map.geojson

import com.ritense.valtimo.contract.json.MapperSingleton
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFails
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

class GeoJsonGeometryMapperTest {

    private val objectMapper = MapperSingleton.get()
    private val mapper = GeoJsonGeometryMapper(objectMapper)

    @Test
    fun `supports returns true for all geometry types`() {
        GeoJsonGeometryMapper.GEOMETRY_TYPES.forEach { type ->
            val node = objectMapper.readTree(
                """{ "type": "$type", "coordinates": [] }"""
            )
            assertTrue(mapper.supports(node), "Expected supports() to accept $type")
        }
    }

    @Test
    fun `supports returns false for Feature`() {
        val node = objectMapper.readTree(
            """
            { "type": "Feature", "geometry": null, "properties": {} }
        """.trimIndent()
        )

        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false for FeatureCollection`() {
        val node = objectMapper.readTree(
            """
            { "type": "FeatureCollection", "features": [] }
        """.trimIndent()
        )

        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false for unknown geometry type`() {
        val node = objectMapper.readTree(
            """
            { "type": "Circle", "coordinates": [1,2] }
        """.trimIndent()
        )

        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false for array nodes`() {
        val node = objectMapper.readTree("[1, 2]")
        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false when type missing`() {
        val node = objectMapper.readTree("""{ "foo": "bar" }""")

        assertFalse(mapper.supports(node))
    }

    @Test
    fun `mapToFeatures wraps geometry into Feature`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "Point",
              "coordinates": [10, 20]
            }
        """.trimIndent()
        )

        val features = mapper.mapToFeatures(node)

        assertEquals(1, features.size)
        val feature = features.first()

        val geometry = feature.geometry
        assertIs<GeoJson.Point>(geometry)
        assertEquals(listOf(10.0, 20.0), geometry.coordinates)
    }

    @Test
    fun `mapToFeatures sets empty properties`() {
        val node = objectMapper.readTree(
            """
            { "type": "Point", "coordinates": [1,2] }
        """.trimIndent()
        )

        val feature = mapper.mapToFeatures(node).first()

        assertTrue(feature.properties.isEmpty())
    }

    @Test
    fun `mapToFeatures maps Polygon correctly`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "Polygon",
              "coordinates": [[[1,1],[2,2],[1,1]]]
            }
        """.trimIndent()
        )

        val feature = mapper.mapToFeatures(node).first()

        val geom = feature.geometry
        assertIs<GeoJson.Polygon>(geom)
        assertEquals(
            listOf(listOf(listOf(1.0, 1.0), listOf(2.0, 2.0), listOf(1.0, 1.0))),
            geom.coordinates
        )
    }

    @Test
    fun `mapToFeatures maps MultiPolygon correctly`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "MultiPolygon",
              "coordinates": [
                [[[1,1],[2,2],[1,1]]],
                [[[10,10],[20,20],[10,10]]]
              ]
            }
        """.trimIndent()
        )

        val feature = mapper.mapToFeatures(node).first()

        val geom = feature.geometry
        assertIs<GeoJson.MultiPolygon>(geom)
        assertEquals(2, geom.coordinates.size)
    }

    @Test
    fun `mapToFeatures ignores extra geometry fields`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "Point",
              "coordinates": [1,2],
              "extra": "ignored"
            }
        """.trimIndent()
        )

        val feature = mapper.mapToFeatures(node).first()

        val geom = feature.geometry
        assertIs<GeoJson.Point>(geom)
        assertEquals(listOf(1.0, 2.0), geom.coordinates)
    }

    @Test
    fun `mapToFeatures fails for invalid geometry object`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "Point",
              "coordinates": "shouldNotBeString"
            }
        """.trimIndent()
        )

        assertFails {
            mapper.mapToFeatures(node)
        }
    }
}
