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

package com.ritense.document.opensearch.service

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class ReindexRequestTest {

    @Test
    fun `effectivePageSize clamps values above the maximum`() {
        val request = ReindexRequest(pageSize = ReindexRequest.MAX_PAGE_SIZE + 5000)

        assertThat(request.effectivePageSize()).isEqualTo(ReindexRequest.MAX_PAGE_SIZE)
    }

    @Test
    fun `effectivePageSize clamps zero and negative values to one`() {
        assertThat(ReindexRequest(pageSize = 0).effectivePageSize()).isEqualTo(1)
        assertThat(ReindexRequest(pageSize = -10).effectivePageSize()).isEqualTo(1)
    }

    @Test
    fun `effectivePageSize keeps values within range`() {
        assertThat(ReindexRequest(pageSize = 1234).effectivePageSize()).isEqualTo(1234)
    }

    @Test
    fun `default page size is used when not specified`() {
        assertThat(ReindexRequest().effectivePageSize()).isEqualTo(ReindexRequest.DEFAULT_PAGE_SIZE)
    }
}
