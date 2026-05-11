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

package com.ritense.widget.map.geojson

import org.junit.jupiter.api.Test
import kotlin.math.abs
import kotlin.test.assertEquals
import kotlin.test.assertSame
import kotlin.test.assertTrue

class Wgs84FeatureNormalizerTest {

    private val normalizer = Wgs84FeatureNormalizer()

    @Test
    fun `leaves a feature with WGS84 coordinates untouched`() {
        val feature = GeoJson.Feature(geometry = GeoJson.Point(listOf(5.0, 52.0)))

        val result = normalizer.normalize(feature)

        assertSame(feature, result)
    }

    @Test
    fun `leaves a feature without geometry untouched`() {
        val feature = GeoJson.Feature(geometry = null, properties = mapOf("name" to "x"))

        val result = normalizer.normalize(feature)

        assertSame(feature, result)
    }

    @Test
    fun `converts a Point that is entirely outside WGS84 range`() {
        val feature = GeoJson.Feature(geometry = GeoJson.Point(listOf(155000.0, 463000.0)))

        val point = normalizer.normalize(feature).geometry as GeoJson.Point

        assertCloseTo(5.38720621, point.coordinates[0])
        assertCloseTo(52.15517440, point.coordinates[1])
    }

    @Test
    fun `preserves elevation as third coordinate value`() {
        val feature = GeoJson.Feature(geometry = GeoJson.Point(listOf(155000.0, 463000.0, 12.5)))

        val point = normalizer.normalize(feature).geometry as GeoJson.Point

        assertEquals(3, point.coordinates.size)
        assertEquals(12.5, point.coordinates[2])
    }

    @Test
    fun `converts LineString coordinates`() {
        val feature = GeoJson.Feature(
            geometry = GeoJson.LineString(
                listOf(listOf(155000.0, 463000.0), listOf(122000.0, 487000.0))
            )
        )

        val line = normalizer.normalize(feature).geometry as GeoJson.LineString

        assertCloseTo(5.38720621, line.coordinates[0][0])
        assertCloseTo(52.15517440, line.coordinates[0][1])
        assertCloseTo(4.902, line.coordinates[1][0], tolerance = 1e-3)
        assertCloseTo(52.370, line.coordinates[1][1], tolerance = 1e-3)
    }

    @Test
    fun `converts Polygon preserving ring nesting`() {
        val ring = listOf(
            listOf(155000.0, 463000.0),
            listOf(156000.0, 463000.0),
            listOf(155000.0, 464000.0),
            listOf(155000.0, 463000.0),
        )
        val feature = GeoJson.Feature(geometry = GeoJson.Polygon(listOf(ring)))

        val polygon = normalizer.normalize(feature).geometry as GeoJson.Polygon

        assertEquals(1, polygon.coordinates.size)
        assertEquals(4, polygon.coordinates[0].size)
        assertCloseTo(5.38720621, polygon.coordinates[0][0][0])
        assertCloseTo(52.15517440, polygon.coordinates[0][0][1])
    }

    @Test
    fun `converts MultiPolygon preserving structure`() {
        val ring = listOf(
            listOf(155000.0, 463000.0),
            listOf(156000.0, 463000.0),
            listOf(155000.0, 464000.0),
            listOf(155000.0, 463000.0),
        )
        val feature = GeoJson.Feature(geometry = GeoJson.MultiPolygon(listOf(listOf(ring))))

        val multi = normalizer.normalize(feature).geometry as GeoJson.MultiPolygon

        assertEquals(1, multi.coordinates.size)
        assertEquals(1, multi.coordinates[0].size)
        assertEquals(4, multi.coordinates[0][0].size)
        multi.coordinates[0][0].forEach { (lon, lat) ->
            assertTrue(lon in NETHERLANDS_LON_RANGE, "longitude $lon out of NL bbox")
            assertTrue(lat in NETHERLANDS_LAT_RANGE, "latitude $lat out of NL bbox")
        }
    }

    @Test
    fun `converts GeometryCollection by recursing into each geometry`() {
        val feature = GeoJson.Feature(
            geometry = GeoJson.GeometryCollection(
                geometries = listOf(
                    GeoJson.Point(listOf(155000.0, 463000.0)),
                    GeoJson.LineString(listOf(listOf(122000.0, 487000.0), listOf(155000.0, 463000.0))),
                )
            )
        )

        val collection = normalizer.normalize(feature).geometry as GeoJson.GeometryCollection

        val point = collection.geometries[0] as GeoJson.Point
        assertCloseTo(5.38720621, point.coordinates[0])
        assertCloseTo(52.15517440, point.coordinates[1])
        val line = collection.geometries[1] as GeoJson.LineString
        assertCloseTo(4.902, line.coordinates[0][0], tolerance = 1e-3)
    }

    @Test
    fun `does not convert a feature whose geometry mixes RD and WGS84 pairs`() {
        val feature = GeoJson.Feature(
            geometry = GeoJson.LineString(
                listOf(listOf(155000.0, 463000.0), listOf(5.0, 52.0))
            )
        )

        val result = normalizer.normalize(feature)

        assertSame(feature, result)
    }

    private fun assertCloseTo(expected: Double, actual: Double, tolerance: Double = 1e-6) {
        assertTrue(
            abs(expected - actual) <= tolerance,
            "expected $expected ± $tolerance but was $actual",
        )
    }

    companion object {
        private val NETHERLANDS_LON_RANGE = 3.0..7.5
        private val NETHERLANDS_LAT_RANGE = 50.5..53.7
    }
}
