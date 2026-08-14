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

import com.ritense.valtimo.contract.annotation.AllOpen

/**
 * Post-processes mapped `GeoJson.Feature`s and rewrites coordinates from the
 * Dutch RD New CRS (EPSG:28992) to WGS84 when every pair in the feature's
 * geometry is outside the WGS84 valid range (|lon| > 180 or |lat| > 90).
 *
 * Applied uniformly to features produced by any `GeoJsonMapper`, so a mapper
 * that emits RD-encoded geometry (regardless of its input shape) gets
 * normalised the same way an untagged RD GeoJSON input would.
 */
@AllOpen
class Wgs84FeatureNormalizer {

    fun normalize(feature: GeoJson.Feature): GeoJson.Feature {
        val geometry = feature.geometry ?: return feature
        if (!shouldConvert(geometry)) return feature
        return feature.copy(geometry = convertGeometry(geometry))
    }

    private fun shouldConvert(geometry: GeoJson.Geometry): Boolean {
        val pairs = collectCoordinatePairs(geometry)
        return pairs.isNotEmpty() && pairs.all(::isOutOfWgs84Range)
    }

    private fun collectCoordinatePairs(
        geometry: GeoJson.Geometry,
        result: MutableList<List<Double>> = mutableListOf(),
    ): List<List<Double>> {
        when (geometry) {
            is GeoJson.Point -> result.add(geometry.coordinates)
            is GeoJson.MultiPoint -> result.addAll(geometry.coordinates)
            is GeoJson.LineString -> result.addAll(geometry.coordinates)
            is GeoJson.MultiLineString -> geometry.coordinates.forEach { result.addAll(it) }
            is GeoJson.Polygon -> geometry.coordinates.forEach { result.addAll(it) }
            is GeoJson.MultiPolygon -> geometry.coordinates.forEach { polygon ->
                polygon.forEach { ring -> result.addAll(ring) }
            }
            is GeoJson.GeometryCollection -> geometry.geometries.forEach {
                collectCoordinatePairs(it, result)
            }
        }
        return result
    }

    private fun isOutOfWgs84Range(pair: List<Double>): Boolean {
        if (pair.size < 2) return false
        val x = pair[0]
        val y = pair[1]
        return x < -WGS84_LON_LIMIT || x > WGS84_LON_LIMIT ||
            y < -WGS84_LAT_LIMIT || y > WGS84_LAT_LIMIT
    }

    private fun convertGeometry(geometry: GeoJson.Geometry): GeoJson.Geometry = when (geometry) {
        is GeoJson.Point -> GeoJson.Point(convertPair(geometry.coordinates))
        is GeoJson.MultiPoint -> GeoJson.MultiPoint(geometry.coordinates.map(::convertPair))
        is GeoJson.LineString -> GeoJson.LineString(geometry.coordinates.map(::convertPair))
        is GeoJson.MultiLineString -> GeoJson.MultiLineString(
            geometry.coordinates.map { line -> line.map(::convertPair) }
        )
        is GeoJson.Polygon -> GeoJson.Polygon(
            geometry.coordinates.map { ring -> ring.map(::convertPair) }
        )
        is GeoJson.MultiPolygon -> GeoJson.MultiPolygon(
            geometry.coordinates.map { polygon -> polygon.map { ring -> ring.map(::convertPair) } }
        )
        is GeoJson.GeometryCollection -> GeoJson.GeometryCollection(
            geometry.geometries.map(::convertGeometry)
        )
    }

    private fun convertPair(coordinates: List<Double>): List<Double> {
        val converted = RdToWgs84Converter.convert(coordinates[0], coordinates[1])
        return if (coordinates.size > 2) {
            listOf(converted.longitude, converted.latitude, coordinates[2])
        } else {
            listOf(converted.longitude, converted.latitude)
        }
    }

    companion object {
        private const val WGS84_LON_LIMIT = 180.0
        private const val WGS84_LAT_LIMIT = 90.0
    }
}
