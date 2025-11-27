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
import kotlin.test.assertNull
import kotlin.test.assertTrue

class GeoJsonFeatureMapperTest {

    private val objectMapper = MapperSingleton.get()
    private val mapper = GeoJsonFeatureMapper(objectMapper)

    @Test
    fun `supports returns true for valid Feature`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "Feature",
              "geometry": null,
              "properties": {}
            }
        """.trimIndent()
        )

        assertTrue(mapper.supports(node))
    }

    @Test
    fun `supports returns false for FeatureCollection`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "FeatureCollection",
              "features": []
            }
        """.trimIndent()
        )

        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false for Geometry node`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "Point",
              "coordinates": [1,2]
            }
        """.trimIndent()
        )

        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false for array`() {
        val node = objectMapper.readTree("[1,2]")
        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false when type missing`() {
        val node = objectMapper.readTree("""{ "foo":"bar" }""")
        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false when type is null`() {
        val node = objectMapper.readTree("""{ "type": null }""")
        assertFalse(mapper.supports(node))
    }

    @Test
    fun `mapToFeatures maps valid Feature`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "Feature",
              "geometry": { "type": "Point", "coordinates":[1,2] },
              "properties": {}
            }
        """.trimIndent()
        )

        val features = mapper.mapToFeatures(node)

        assertEquals(1, features.size)
        assertTrue(features.first().geometry is GeoJson.Point)
    }

    @Test
    fun `mapToFeatures maps Feature with null geometry`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "Feature",
              "geometry": null,
              "properties": {}
            }
        """.trimIndent()
        )

        val features = mapper.mapToFeatures(node)

        assertEquals(1, features.size)
        assertNull(features.first().geometry)
    }

    @Test
    fun `mapToFeatures maps Feature missing geometry`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "Feature",
              "properties": {}
            }
        """.trimIndent()
        )

        val features = mapper.mapToFeatures(node)

        assertEquals(1, features.size)
        assertNull(features.first().geometry)
    }

    @Test
    fun `mapToFeatures maps Feature with Polygon geometry`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "Feature",
              "geometry": {
                "type": "Polygon",
                "coordinates": [
                  [[1,1],[2,2],[1,1]]
                ]
              },
              "properties": {}
            }
        """.trimIndent()
        )

        val features = mapper.mapToFeatures(node)

        assertEquals(1, features.size)
        assertTrue(features.first().geometry is GeoJson.Polygon)
    }

    @Test
    fun `mapToFeatures fails with invalid geometry type`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "Feature",
              "geometry": { "type":"InvalidType" },
              "properties": {}
            }
        """.trimIndent()
        )

        assertFails {
            mapper.mapToFeatures(node)
        }
    }

    @Test
    fun `mapToFeatures returns a list with exactly 1 feature`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "Feature",
              "geometry": { "type": "Point", "coordinates":[1,2] },
              "properties": {}
            }
        """.trimIndent()
        )

        val result = mapper.mapToFeatures(node)

        assertEquals(1, result.size)
    }

    @Test
    fun `mapToFeatures ignores extra fields`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "Feature",
              "geometry": { "type": "Point", "coordinates":[1,2] },
              "properties": {},
              "extra": "ignored"
            }
        """.trimIndent()
        )

        val features = mapper.mapToFeatures(node)

        assertEquals(1, features.size)
        assertTrue(features.first().geometry is GeoJson.Point)
    }
}
