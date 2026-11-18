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
package com.ritense.document.opensearch.health

import com.ritense.document.opensearch.service.DocumentOpenSearchIndexInitializer
import com.ritense.document.opensearch.service.TopologyGate
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.boot.actuate.health.Status

class OpenSearchMappingHealthIndicatorTest {

    private val topologyGate: TopologyGate = mock()
    private val initializer: DocumentOpenSearchIndexInitializer = mock()
    private val indicator = OpenSearchMappingHealthIndicator(topologyGate, initializer)

    @Test
    fun `reports UP with PER_DEFINITION topology when OpenSearch is complete`() {
        whenever(topologyGate.snapshot()).thenReturn(snapshot())

        val health = indicator.health()

        assertThat(health.status).isEqualTo(Status.UP)
        assertThat(health.details).containsEntry("topology", "PER_DEFINITION")
    }

    @Test
    fun `reports WARN with the required action when the topology is legacy or stale`() {
        whenever(topologyGate.snapshot()).thenReturn(snapshot(legacyOrStale = true))

        val health = indicator.health()

        assertThat(health.status.code).isEqualTo("WARN")
        assertThat(health.details).containsEntry("topology", "LEGACY_OR_STALE")
        assertThat(health.details).containsKey("action")
    }

    @Test
    fun `reports WARN while the reconciler catches up`() {
        whenever(topologyGate.snapshot()).thenReturn(snapshot(catchingUp = true))

        val health = indicator.health()

        assertThat(health.status.code).isEqualTo("WARN")
        assertThat(health.details).containsEntry("indexing", "CATCHING_UP")
    }

    @Test
    fun `reports WARN with the case types that have rejected cases`() {
        whenever(topologyGate.snapshot()).thenReturn(snapshot(rejectedDefinitions = setOf("person", "house")))

        val health = indicator.health()

        assertThat(health.status.code).isEqualTo("WARN")
        assertThat(health.details).containsEntry("rejectedDefinitions", listOf("house", "person"))
    }

    @Test
    fun `reports WARN after a recent rejected write`() {
        whenever(topologyGate.snapshot()).thenReturn(snapshot())
        whenever(initializer.hasRecentWriteFailures()).thenReturn(true)

        val health = indicator.health()

        assertThat(health.status.code).isEqualTo("WARN")
        assertThat(health.details).containsEntry("writeFailures", "RECENT")
    }

    @Test
    fun `reports UP with UNKNOWN topology when probing fails`() {
        doThrow(RuntimeException("cluster unreachable")).whenever(topologyGate).snapshot()

        val health = indicator.health()

        assertThat(health.status).isEqualTo(Status.UP)
        assertThat(health.details).containsEntry("topology", "UNKNOWN")
    }

    private fun snapshot(
        legacyOrStale: Boolean = false,
        catchingUp: Boolean = false,
        rejectedDefinitions: Set<String> = emptySet(),
    ) = TopologyGate.Snapshot(legacyOrStale, catchingUp, rejectedDefinitions)
}
