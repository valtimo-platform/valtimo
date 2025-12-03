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
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class GeoJsonGeometryCollectionMapperTest {

    private val objectMapper = MapperSingleton.get()
    private val geometryMapper = GeoJsonGeometryMapper(objectMapper)
    private val mapper = GeoJsonGeometryCollectionMapper(geometryMapper)

    @Test
    fun `supports returns true for GeometryCollection`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "GeometryCollection",
              "geometries": []
            }
        """.trimIndent()
        )

        assertTrue(mapper.supports(node))
    }

    @Test
    fun `supports returns false when type is not GeometryCollection`() {
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
    fun `supports returns false when type is missing`() {
        val node = objectMapper.readTree("""{ "foo":"bar" }""")
        assertFalse(mapper.supports(node))
    }

    @Test
    fun `mapToFeatures throws when geometries is missing`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "GeometryCollection"
            }
        """.trimIndent()
        )

        val ex = assertFailsWith<IllegalStateException> {
            mapper.mapToFeatures(node)
        }

        assertTrue(ex.message!!.contains("GeometryCollection missing property 'geometries'"))
    }

    @Test
    fun `mapToFeatures delegates each geometry to appropriate mapper`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "GeometryCollection",
              "geometries": [
                { "type": "Point", "coordinates": [1,2] },
                { "type": "Point", "coordinates": [3,4] }
              ]
            }
        """.trimIndent()
        )

        val result = mapper.mapToFeatures(node)

        assertEquals(2, result.size)
        assertTrue(result[0].geometry is GeoJson.Point)
        assertTrue(result[1].geometry is GeoJson.Point)
        assertEquals(listOf(1.0, 2.0), (result[0].geometry as GeoJson.Point).coordinates)
        assertEquals(listOf(3.0, 4.0), (result[1].geometry as GeoJson.Point).coordinates)
    }

    @Test
    fun `mapToFeatures handles nested GeometryCollections`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "GeometryCollection",
              "geometries": [
                {
                  "type": "GeometryCollection",
                  "geometries": [
                    { "type": "Point", "coordinates":[9,9] }
                  ]
                }
              ]
            }
        """.trimIndent()
        )

        val result = mapper.mapToFeatures(node)

        assertEquals(1, result.size)
        val point = result.first().geometry as GeoJson.Point
        assertEquals(listOf(9.0, 9.0), point.coordinates)
    }

    @Test
    fun `mapToFeatures throws when geometry type is unknown`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "GeometryCollection",
              "geometries": [
                { "type":"WeirdThing" }
              ]
            }
        """.trimIndent()
        )

        val ex = assertFailsWith<IllegalStateException> {
            mapper.mapToFeatures(node)
        }

        assertTrue(ex.message!!.contains("unknown geometry"))
    }
}
