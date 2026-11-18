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

import com.ritense.document.domain.search.AdvancedSearchRequest
import com.ritense.document.domain.search.SearchWithConfigRequest
import com.ritense.document.service.DocumentSearchService
import com.ritense.valtimo.contract.blueprint.BlueprintType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.dao.DataAccessResourceFailureException
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

class DelegatingDocumentSearchServiceTest {

    private val openSearchService: DocumentSearchService = mock()
    private val jpaService: DocumentSearchService = mock()
    private val gate: ReindexProgressGate = mock()
    private val topologyGate: TopologyGate = mock()
    private val request: AdvancedSearchRequest = mock()

    @Test
    fun `routes to OpenSearch when engine is OpenSearch and no reindex is in progress`() {
        whenever(gate.isReindexInProgress()).thenReturn(false)
        val service = delegating(SearchEngineToggle.Engine.OPENSEARCH)

        service.count("house", BlueprintType.CASE, request)

        verify(openSearchService).count(eq("house"), any(), any())
        verify(jpaService, never()).count(any(), any(), any())
    }

    @Test
    fun `falls back to PostgreSQL while a reindex is in progress, even with engine OpenSearch`() {
        whenever(gate.isReindexInProgress()).thenReturn(true)
        val service = delegating(SearchEngineToggle.Engine.OPENSEARCH)

        service.count("house", BlueprintType.CASE, request)

        verify(jpaService).count(eq("house"), any(), any())
        verify(openSearchService, never()).count(any(), any(), any())
    }

    @Test
    fun `always uses PostgreSQL when engine is Postgres, without consulting the gate`() {
        val service = delegating(SearchEngineToggle.Engine.POSTGRES)

        service.count("house", BlueprintType.CASE, request)

        verify(jpaService).count(eq("house"), any(), any())
        verify(openSearchService, never()).count(any(), any(), any())
        verify(gate, never()).isReindexInProgress()
    }

    @Test
    fun `uses PostgreSQL when OpenSearch cannot list every case of the requested definition`() {
        whenever(topologyGate.mustUseDatabase(listOf("house"))).thenReturn(true)
        val service = delegating(SearchEngineToggle.Engine.OPENSEARCH)

        service.count("house", BlueprintType.CASE, request)

        verify(jpaService).count(eq("house"), any(), any())
        verify(openSearchService, never()).count(any(), any(), any())
    }

    @Test
    fun `asks the gate about every definition of a multi-definition search`() {
        whenever(openSearchService.search(any<Collection<String>>(), any(), any<SearchWithConfigRequest>(), any<Pageable>()))
            .thenReturn(Page.empty())
        val service = delegating(SearchEngineToggle.Engine.OPENSEARCH)

        service.search(listOf("house", "person"), BlueprintType.CASE, SearchWithConfigRequest(), Pageable.unpaged())

        verify(topologyGate).mustUseDatabase(listOf("house", "person"))
    }

    @Test
    fun `falls back to PostgreSQL and activates the fallback when the gate cannot reach OpenSearch`() {
        whenever(topologyGate.mustUseDatabase(any())).thenThrow(DataAccessResourceFailureException("Connection refused"))
        val toggle = SearchEngineToggle(SearchEngineToggle.Engine.OPENSEARCH)
        val service = delegating(toggle)

        service.count("house", BlueprintType.CASE, request)
        service.count("house", BlueprintType.CASE, request)

        assertThat(toggle.isFallbackActive()).isTrue()
        verify(jpaService, times(2)).count(eq("house"), any(), any())
        verify(topologyGate, times(1)).mustUseDatabase(any())
        verify(openSearchService, never()).count(any(), any(), any())
    }

    @Test
    fun `uses PostgreSQL without activating the fallback when the gate fails for another reason`() {
        whenever(topologyGate.mustUseDatabase(any())).thenThrow(IllegalStateException("database unavailable"))
        val toggle = SearchEngineToggle(SearchEngineToggle.Engine.OPENSEARCH)

        delegating(toggle).count("house", BlueprintType.CASE, request)

        assertThat(toggle.isFallbackActive()).isFalse()
        verify(jpaService).count(eq("house"), any(), any())
    }

    @Test
    fun `retries on PostgreSQL when the OpenSearch search cannot connect`() {
        whenever(openSearchService.count(any(), any(), any())).thenThrow(DataAccessResourceFailureException("Connection refused"))
        val toggle = SearchEngineToggle(SearchEngineToggle.Engine.OPENSEARCH)

        delegating(toggle).count("house", BlueprintType.CASE, request)

        assertThat(toggle.isFallbackActive()).isTrue()
        verify(jpaService).count(eq("house"), any(), any())
    }

    private fun delegating(engine: SearchEngineToggle.Engine) = delegating(SearchEngineToggle(engine))

    private fun delegating(toggle: SearchEngineToggle) =
        DelegatingDocumentSearchService(openSearchService, jpaService, toggle, gate, topologyGate)
}
