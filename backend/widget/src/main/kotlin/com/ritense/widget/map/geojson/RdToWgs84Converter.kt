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

import kotlin.math.pow

/**
 * Approximates a transformation from Dutch RD New (EPSG:28992) coordinates to
 * WGS84 (EPSG:4326) using the polynomial of Schreutelkamp & Strang van Hees.
 * Accuracy is roughly 0.25 m within the Netherlands — sufficient for map display.
 */
object RdToWgs84Converter {

    private const val X0 = 155000.0
    private const val Y0 = 463000.0
    private const val LAT0 = 52.15517440
    private const val LON0 = 5.38720621

    private val LAT_COEFFICIENTS = listOf(
        Coefficient(0, 1, 3235.65389),
        Coefficient(2, 0, -32.58297),
        Coefficient(0, 2, -0.24750),
        Coefficient(2, 1, -0.84978),
        Coefficient(0, 3, -0.06550),
        Coefficient(2, 2, -0.01709),
        Coefficient(1, 0, -0.00738),
        Coefficient(4, 0, 0.00530),
        Coefficient(2, 3, -0.00039),
        Coefficient(4, 1, 0.00033),
        Coefficient(1, 1, -0.00012),
    )

    private val LON_COEFFICIENTS = listOf(
        Coefficient(1, 0, 5260.52916),
        Coefficient(1, 1, 105.94684),
        Coefficient(1, 2, 2.45656),
        Coefficient(3, 0, -0.81885),
        Coefficient(1, 3, 0.05594),
        Coefficient(3, 1, -0.05607),
        Coefficient(0, 1, 0.01199),
        Coefficient(3, 2, -0.00256),
        Coefficient(1, 4, 0.00128),
        Coefficient(0, 2, 0.00022),
        Coefficient(2, 0, -0.00022),
        Coefficient(5, 0, 0.00026),
    )

    fun convert(x: Double, y: Double): Wgs84Coordinate {
        val dx = (x - X0) * 1e-5
        val dy = (y - Y0) * 1e-5
        val lat = LAT0 + LAT_COEFFICIENTS.sumOf { it.evaluate(dx, dy) } / 3600.0
        val lon = LON0 + LON_COEFFICIENTS.sumOf { it.evaluate(dx, dy) } / 3600.0
        return Wgs84Coordinate(longitude = lon, latitude = lat)
    }

    private data class Coefficient(val p: Int, val q: Int, val k: Double) {
        fun evaluate(dx: Double, dy: Double): Double = k * dx.pow(p) * dy.pow(q)
    }

    data class Wgs84Coordinate(val longitude: Double, val latitude: Double)
}
