/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import com.ritense.document.opensearch.domain.DocumentIndexRejection
import com.ritense.document.opensearch.service.DocumentOpenSearchReconcileService
import com.ritense.document.opensearch.service.DocumentOpenSearchReconcileService.RetryResult
import com.ritense.document.opensearch.service.IndexCompletenessService
import com.ritense.document.opensearch.service.SearchEngineToggle
import com.ritense.document.opensearch.web.DocumentOpenSearchRejectionResource.RetryRequest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.ObjectProvider
import org.springframework.data.domain.PageImpl
import java.time.LocalDateTime
import java.util.UUID

class DocumentOpenSearchRejectionResourceTest {

    private val completeness: IndexCompletenessService = mock()
    private val reconcileService: DocumentOpenSearchReconcileService = mock()
    private val reconcileServiceProvider: ObjectProvider<DocumentOpenSearchReconcileService> = mock {
        on { ifAvailable } doReturn reconcileService
    }
    private val toggle = SearchEngineToggle(SearchEngineToggle.Engine.OPENSEARCH)
    private val resource = DocumentOpenSearchRejectionResource(completeness, reconcileServiceProvider, toggle)

    @Test
    fun `lists rejected cases with their attempts`() {
        val now = LocalDateTime.now()
        val rejection = DocumentIndexRejection(UUID.randomUUID(), "house", firstRejectedOn = now, attempts = 3, nextRetryOn = now)
        whenever(completeness.rejections(any())).thenReturn(PageImpl(listOf(rejection)))

        val body = resource.list(0, 20).body?.content

        assertThat(body).singleElement().satisfies({
            assertThat(it.documentId).isEqualTo(rejection.documentId)
            assertThat(it.definitionName).isEqualTo("house")
            assertThat(it.attempts).isEqualTo(3)
        })
    }

    @Test
    fun `retries the selected cases right away`() {
        val indexed = UUID.randomUUID()
        val stillRejected = UUID.randomUUID()
        whenever(reconcileService.retry(listOf(indexed, stillRejected)))
            .thenReturn(RetryResult(listOf(indexed), listOf(stillRejected), emptyList()))

        val response = resource.retry(RetryRequest(listOf(indexed, stillRejected)))

        assertThat(response.statusCode.value()).isEqualTo(200)
        assertThat(response.body).containsEntry("indexed", listOf(indexed)).containsEntry("stillRejected", listOf(stillRejected))
    }

    @Test
    fun `schedules every rejected case for the next cycle when no cases are selected`() {
        whenever(completeness.retryAllNextCycle()).thenReturn(7)

        val response = resource.retry(null)

        assertThat(response.statusCode.value()).isEqualTo(202)
        assertThat(response.body).containsEntry("scheduled", 7)
        verify(reconcileService, never()).retry(any())
    }

    @Test
    fun `refuses to retry more cases at once than the limit`() {
        val response = resource.retry(RetryRequest(List(DocumentOpenSearchRejectionResource.MAX_RETRY_NOW + 1) { UUID.randomUUID() }))

        assertThat(response.statusCode.value()).isEqualTo(400)
        verifyNoInteractions(reconcileService)
    }

    @Test
    fun `refuses to retry while OpenSearch is not the active engine`() {
        toggle.set(SearchEngineToggle.Engine.POSTGRES)

        val response = resource.retry(RetryRequest(listOf(UUID.randomUUID())))

        assertThat(response.statusCode.value()).isEqualTo(409)
        verifyNoInteractions(reconcileService)
    }

    @Test
    fun `refuses to retry while OpenSearch is unreachable`() {
        toggle.activateFallback()

        assertThat(resource.retry(null).statusCode.value()).isEqualTo(409)
        verify(completeness, never()).retryAllNextCycle()
    }
}
