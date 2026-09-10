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

package com.ritense.externalplugin.compatibility

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class GzacCompatibilityCheckerTest {

    private fun checker(currentVersion: String?) =
        GzacCompatibilityChecker(GzacVersionProvider { currentVersion })

    @Test
    fun `is compatible when current version is above the minimum`() {
        val result = checker("13.1.3").check(minGzacVersion = "12.0.0", maxGzacVersion = null)

        assertThat(result.compatible).isTrue()
        assertThat(result.status).isEqualTo(CompatibilityStatus.COMPATIBLE)
        assertThat(result.currentGzacVersion).isEqualTo("13.1.3")
    }

    @Test
    fun `is incompatible when current version is below the minimum`() {
        val result = checker("13.1.3").check(minGzacVersion = "14.0.0", maxGzacVersion = null)

        assertThat(result.compatible).isFalse()
        assertThat(result.status).isEqualTo(CompatibilityStatus.BELOW_MINIMUM)
        assertThat(result.minGzacVersion).isEqualTo("14.0.0")
    }

    @Test
    fun `is incompatible when current version is above the maximum`() {
        val result = checker("13.1.3").check(minGzacVersion = null, maxGzacVersion = "13.0.0")

        assertThat(result.compatible).isFalse()
        assertThat(result.status).isEqualTo(CompatibilityStatus.ABOVE_MAXIMUM)
        assertThat(result.maxGzacVersion).isEqualTo("13.0.0")
    }

    @Test
    fun `is compatible when current version is within an inclusive range`() {
        val result = checker("13.1.3").check(minGzacVersion = "12.0.0", maxGzacVersion = "14.0.0")

        assertThat(result.compatible).isTrue()
        assertThat(result.status).isEqualTo(CompatibilityStatus.COMPATIBLE)
    }

    @Test
    fun `treats the minimum bound as inclusive`() {
        val result = checker("13.1.3").check(minGzacVersion = "13.1.3", maxGzacVersion = null)

        assertThat(result.compatible).isTrue()
    }

    @Test
    fun `treats the maximum bound as inclusive`() {
        val result = checker("13.1.3").check(minGzacVersion = null, maxGzacVersion = "13.1.3")

        assertThat(result.compatible).isTrue()
    }

    @Test
    fun `is compatible when no bounds are declared`() {
        val result = checker("13.1.3").check(minGzacVersion = null, maxGzacVersion = null)

        assertThat(result.compatible).isTrue()
        assertThat(result.status).isEqualTo(CompatibilityStatus.COMPATIBLE)
    }

    @Test
    fun `does not warn when the current version cannot be determined`() {
        val result = checker(null).check(minGzacVersion = "14.0.0", maxGzacVersion = null)

        assertThat(result.compatible).isTrue()
        assertThat(result.status).isEqualTo(CompatibilityStatus.CURRENT_VERSION_UNKNOWN)
        assertThat(result.currentGzacVersion).isNull()
    }

    @Test
    fun `does not warn when the current version is not valid semver`() {
        val result = checker("not-a-version").check(minGzacVersion = "14.0.0", maxGzacVersion = null)

        assertThat(result.compatible).isTrue()
        assertThat(result.status).isEqualTo(CompatibilityStatus.CURRENT_VERSION_UNKNOWN)
    }

    @Test
    fun `ignores an unparseable bound rather than blocking`() {
        val result = checker("13.1.3").check(minGzacVersion = "not-a-version", maxGzacVersion = null)

        assertThat(result.compatible).isTrue()
    }
}
