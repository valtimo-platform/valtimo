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
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class GeoJsonFeatureCollectionMapperTest {

    private val objectMapper = MapperSingleton.get()
    private val mapper = GeoJsonFeatureCollectionMapper(objectMapper)

    @Test
    fun `supports returns true for valid FeatureCollection`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "FeatureCollection",
              "features": []
            }
        """.trimIndent()
        )

        assertTrue(mapper.supports(node))
    }

    @Test
    fun `supports returns false for Feature`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "Feature",
              "geometry": null,
              "properties": {}
            }
        """.trimIndent()
        )

        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false for geometry`() {
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
    fun `mapToFeatures returns empty list for empty FeatureCollection`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "FeatureCollection",
              "features": []
            }
        """.trimIndent()
        )

        val result = mapper.mapToFeatures(node)

        assertTrue(result.isEmpty())
    }

    @Test
    fun `mapToFeatures maps single Feature`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "FeatureCollection",
              "features": [
                {
                  "type": "Feature",
                  "geometry": { "type": "Point", "coordinates":[1,2] },
                  "properties": {}
                }
              ]
            }
        """.trimIndent()
        )

        val features = mapper.mapToFeatures(node)

        assertEquals(1, features.size)
        assertTrue(features.first().geometry is GeoJson.Point)
    }

    @Test
    fun `mapToFeatures maps multiple mixed features`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "FeatureCollection",
              "features": [
                {
                  "type": "Feature",
                  "geometry": { "type": "Point", "coordinates":[1,2] },
                  "properties": {}
                },
                {
                  "type": "Feature",
                  "geometry": { 
                    "type": "Polygon", 
                    "coordinates":[[[1,1],[2,2],[1,1]]] 
                  },
                  "properties": {}
                }
              ]
            }
        """.trimIndent()
        )

        val features = mapper.mapToFeatures(node)

        assertEquals(2, features.size)
        assertTrue(features[0].geometry is GeoJson.Point)
        assertTrue(features[1].geometry is GeoJson.Polygon)
    }

    @Test
    fun `mapToFeatures throws when features is missing`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "FeatureCollection"
            }
        """.trimIndent()
        )

        val ex = assertFailsWith<IllegalStateException> {
            mapper.mapToFeatures(node)
        }

        assertTrue(ex.message!!.contains("FeatureCollection missing property 'features'"))
    }

    @Test
    fun `mapToFeatures throws when features is not an array`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "FeatureCollection",
              "features": "nope"
            }
        """.trimIndent()
        )

        assertFails {
            mapper.mapToFeatures(node)
        }
    }

    @Test
    fun `mapToFeatures allows Feature with no geometry`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "FeatureCollection",
              "features": [
                { "type": "Feature", "properties": {} }
              ]
            }
        """.trimIndent()
        )

        val features = mapper.mapToFeatures(node)

        assertEquals(1, features.size)
        assertNull(features.first().geometry)
    }

    @Test
    fun `mapToFeatures fails for invalid nested geometry`() {
        val node = objectMapper.readTree(
            """
            {
              "type": "FeatureCollection",
              "features": [
                {
                  "type": "Feature",
                  "geometry": { "type":"InvalidType" },
                  "properties": {}
                }
              ]
            }
        """.trimIndent()
        )

        assertFails {
            mapper.mapToFeatures(node)
        }
    }
}
