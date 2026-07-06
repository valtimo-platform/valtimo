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

package com.ritense.document.opensearch.web

import com.ritense.document.opensearch.service.DocumentOpenSearchReindexService
import com.ritense.document.opensearch.service.ReindexRequest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.UUID

class DocumentOpenSearchReindexResourceTest {

    private val reindexService: DocumentOpenSearchReindexService = mock()
    private lateinit var resource: DocumentOpenSearchReindexResource

    @BeforeEach
    fun setUp() {
        resource = DocumentOpenSearchReindexResource(reindexService)
    }

    @Test
    fun `reindex returns 202 with the run id when started`() {
        val runId = UUID.randomUUID()
        whenever(reindexService.start(any())).thenReturn(runId)

        val response = resource.reindex(ReindexRequest(documentDefinitionName = "house"))

        assertThat(response.statusCode.value()).isEqualTo(202)
        assertThat(response.body?.get("status")).isEqualTo("started")
        assertThat(response.body?.get("runId")).isEqualTo(runId)
    }

    @Test
    fun `reindex starts with an empty request when no body is provided`() {
        val runId = UUID.randomUUID()
        whenever(reindexService.start(any())).thenReturn(runId)

        val response = resource.reindex(null)

        assertThat(response.statusCode.value()).isEqualTo(202)
        assertThat(response.body?.get("runId")).isEqualTo(runId)
    }

    @Test
    fun `reindex returns 409 when a re-index is already running`() {
        whenever(reindexService.start(any())).thenReturn(null)

        val response = resource.reindex(ReindexRequest())

        assertThat(response.statusCode.value()).isEqualTo(409)
        assertThat(response.body?.get("error")).isEqualTo("Re-index already in progress")
    }

    @Test
    fun `status returns the most recent run`() {
        whenever(reindexService.status(null)).thenReturn(mapOf("running" to true))

        val response = resource.status()

        assertThat(response.statusCode.value()).isEqualTo(200)
        assertThat(response.body?.get("running")).isEqualTo(true)
    }

    @Test
    fun `statusById returns the requested run`() {
        val runId = UUID.randomUUID()
        whenever(reindexService.status(runId)).thenReturn(mapOf("runId" to runId))

        val response = resource.statusById(runId)

        assertThat(response.statusCode.value()).isEqualTo(200)
        assertThat(response.body?.get("runId")).isEqualTo(runId)
    }
}
