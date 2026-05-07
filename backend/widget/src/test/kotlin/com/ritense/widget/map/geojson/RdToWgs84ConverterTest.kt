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
import kotlin.test.assertTrue

class RdToWgs84ConverterTest {

    @Test
    fun `converts the Amersfoort reference point to its anchor coordinates`() {
        val result = RdToWgs84Converter.convert(155000.0, 463000.0)

        assertCloseTo(5.38720621, result.longitude)
        assertCloseTo(52.15517440, result.latitude)
    }

    @Test
    fun `converts an Amsterdam RD point to expected WGS84 coordinates`() {
        // RD (122000, 487000) is roughly central Amsterdam (~4.90E, 52.37N)
        val result = RdToWgs84Converter.convert(122000.0, 487000.0)

        assertCloseTo(4.902, result.longitude, tolerance = 1e-3)
        assertCloseTo(52.370, result.latitude, tolerance = 1e-3)
    }

    @Test
    fun `converts a Rotterdam RD point to expected WGS84 coordinates`() {
        // RD (92000, 437000) lies in greater Rotterdam; expected values are
        // cross-checked against the Schreutelkamp & Strang van Hees formula.
        val result = RdToWgs84Converter.convert(92000.0, 437000.0)

        assertCloseTo(4.4715, result.longitude, tolerance = 1e-3)
        assertCloseTo(51.918, result.latitude, tolerance = 1e-3)
    }

    private fun assertCloseTo(expected: Double, actual: Double, tolerance: Double = 1e-6) {
        assertTrue(
            abs(expected - actual) <= tolerance,
            "expected $expected ± $tolerance but was $actual",
        )
    }
}
