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

package com.ritense.dashboard.service

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

class DashboardKeysTest {

    @ParameterizedTest
    @CsvSource(
        "My dashboard, my_dashboard",
        "Vincent44, vincent44",
        "3aad, aad",
        "A, a",
        "2026, dashboard_2026",
        "1_2, dashboard_1_2",
        "'20 26!', dashboard_20_26",
        "'!!!', dashboard",
        "'', dashboard",
    )
    fun `should generate a valid key from the title`(title: String, expectedKey: String) {
        val key = DashboardKeys.generate(title) { false }

        assertThat(key).isEqualTo(expectedKey)
        assertThat(key).matches(DashboardKeys.PATTERN)
    }

    @Test
    fun `should add a number when the key is taken`() {
        val usedKeys = setOf("dashboard_2026", "dashboard_2026_2")

        val key = DashboardKeys.generate("2026") { it in usedKeys }

        assertThat(key).isEqualTo("dashboard_2026_3")
    }
}
