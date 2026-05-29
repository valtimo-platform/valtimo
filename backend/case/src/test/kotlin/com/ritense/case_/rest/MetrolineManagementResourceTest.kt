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

package com.ritense.case_.rest

import com.ritense.case_.widget.metroline.MetrolineMode
import com.ritense.case_.widget.metroline.ZaakMetrolineDataService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock

class MetrolineManagementResourceTest {

    @Test
    fun `should return only internal case status mode when zaak service absent`() {
        val resource = MetrolineManagementResource(null)

        val result = resource.getAvailableModes().body

        assertThat(result).containsExactly(MetrolineMode.INTERNAL_CASE_STATUS)
    }

    @Test
    fun `should return both modes when zaak service present`() {
        val resource = MetrolineManagementResource(mock<ZaakMetrolineDataService>())

        val result = resource.getAvailableModes().body

        assertThat(result).containsExactly(
            MetrolineMode.INTERNAL_CASE_STATUS,
            MetrolineMode.ZAAKSTATUS,
        )
    }
}
