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
import com.ritense.document.service.DocumentSearchService
import com.ritense.valtimo.contract.blueprint.BlueprintType
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class DelegatingDocumentSearchServiceTest {

    private val openSearchService: DocumentSearchService = mock()
    private val jpaService: DocumentSearchService = mock()
    private val gate: ReindexProgressGate = mock()
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

    private fun delegating(engine: SearchEngineToggle.Engine) =
        DelegatingDocumentSearchService(openSearchService, jpaService, SearchEngineToggle(engine), gate)
}
