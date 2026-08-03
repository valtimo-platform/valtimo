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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.document.opensearch.service

import com.ritense.document.opensearch.OpenSearchProperties
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class ReindexProgressGateTest {

    private val reindexRunService: OpenSearchReindexRunService = mock()

    @Test
    fun `reports in-progress when a reindex run is running`() {
        whenever(reindexRunService.isReindexRunning(any())).thenReturn(true)
        val gate = ReindexProgressGate(reindexRunService, OpenSearchProperties())

        assertThat(gate.isReindexInProgress()).isTrue()
    }

    @Test
    fun `reports not in-progress when no reindex run is running`() {
        whenever(reindexRunService.isReindexRunning(any())).thenReturn(false)
        val gate = ReindexProgressGate(reindexRunService, OpenSearchProperties())

        assertThat(gate.isReindexInProgress()).isFalse()
    }

    @Test
    fun `never queries the run service when fallback is disabled`() {
        val properties = OpenSearchProperties(
            reindex = OpenSearchProperties.Reindex(fallbackToPostgresWhileRunning = false)
        )
        val gate = ReindexProgressGate(reindexRunService, properties)

        assertThat(gate.isReindexInProgress()).isFalse()
        verify(reindexRunService, never()).isReindexRunning(any())
    }

    @Test
    fun `caches the result within the ttl window and refreshes after it`() {
        whenever(reindexRunService.isReindexRunning(any())).thenReturn(true)
        var now = 1_000L
        val gate = ReindexProgressGate(reindexRunService, OpenSearchProperties(), clock = { now })

        gate.isReindexInProgress()
        gate.isReindexInProgress()
        // Within the TTL: only one DB check.
        verify(reindexRunService, times(1)).isReindexRunning(any())

        now += ReindexProgressGate.CACHE_TTL_MS
        gate.isReindexInProgress()
        // TTL elapsed: a second check.
        verify(reindexRunService, times(2)).isReindexRunning(any())
    }
}
