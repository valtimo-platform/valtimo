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

class GeoJsonLineStringMapperTest {

    private val objectMapper = MapperSingleton.get()
    private val geometryMapper = GeoJsonGeometryMapper(objectMapper)

    private val mapper = GeoJsonLineStringMapper(objectMapper, geometryMapper)

    @Test
    fun `supports returns true for valid LineString coordinates`() {
        val node = objectMapper.readTree(
            """
            [
              [1,2],
              [3,4],
              [5,6]
            ]
        """.trimIndent()
        )

        assertTrue(mapper.supports(node))
    }

    @Test
    fun `supports returns false for non-array`() {
        val node = objectMapper.readTree(""" { "type": "Point" } """)
        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false when outer elements are not arrays`() {
        val node = objectMapper.readTree(
            """
            [ 1, 2, 3 ]
        """.trimIndent()
        )

        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false when inner elements are not numbers`() {
        val node = objectMapper.readTree(
            """
            [
              ["a","b"],
              [1,2]
            ]
        """.trimIndent()
        )

        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false for empty array`() {
        val node = objectMapper.readTree(""" [] """)
        assertFalse(mapper.supports(node))
    }

    @Test
    fun `mapToFeatures delegates to geometryMapper with geometry type LineString`() {
        val node = objectMapper.readTree(
            """
            [
              [10,20],
              [30,40]
            ]
        """.trimIndent()
        )

        val expectedFeature = GeoJson.Feature(
            geometry = GeoJson.LineString(listOf(listOf(10.0, 20.0), listOf(30.0, 40.0))),
            properties = emptyMap()
        )

        val features = mapper.mapToFeatures(node)

        assertEquals(1, features.size)
        assertEquals(expectedFeature, features.first())
    }

    @Test
    fun `mapToFeatures propagates exceptions from geometryMapper`() {
        val node = objectMapper.readTree(
            """
            [
              [1,2],
              [3,4],
              "invalid"
            ]
        """.trimIndent()
        )

        assertFailsWith<IllegalArgumentException> {
            mapper.mapToFeatures(node)
        }
    }

    @Test
    fun `mapToFeatures passes coordinates through unchanged`() {
        val node = objectMapper.readTree(
            """
            [
              [1,2],
              [3,4],
              [9,9]
            ]
        """.trimIndent()
        )

        val result = mapper.mapToFeatures(node)

        assertEquals(1, result.size)
        val geom = result.first().geometry as GeoJson.LineString
        assertEquals(
            listOf(
                listOf(1.0, 2.0),
                listOf(3.0, 4.0),
                listOf(9.0, 9.0)
            ),
            geom.coordinates
        )
    }
}
