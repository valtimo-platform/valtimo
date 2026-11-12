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
import com.ritense.document.opensearch.domain.OpenSearchReconcileState
import com.ritense.document.opensearch.repository.DocumentIndexRejectionRepository
import com.ritense.document.opensearch.repository.OpenSearchReconcileStateRepository
import jakarta.persistence.EntityManager
import jakarta.persistence.TypedQuery
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.transaction.PlatformTransactionManager
import java.time.Duration
import java.time.LocalDateTime
import java.util.Optional

class IndexCompletenessServiceTest {

    private val rejectionRepository: DocumentIndexRejectionRepository = mock()
    private val stateRepository: OpenSearchReconcileStateRepository = mock()
    private val entityManager: EntityManager = mock()
    private val transactionManager: PlatformTransactionManager = mock()

    private val service = IndexCompletenessService(
        rejectionRepository, stateRepository, entityManager, OpenSearchProperties(), transactionManager,
    )

    @Test
    fun `retries a rejected case after 10 minutes, then hourly, then daily`() {
        assertThat((1..3).map(IndexCompletenessService::retryDelayAfter)).containsOnly(Duration.ofMinutes(10))
        assertThat((4..6).map(IndexCompletenessService::retryDelayAfter)).containsOnly(Duration.ofHours(1))
        assertThat(listOf(7, 50, Int.MAX_VALUE).map(IndexCompletenessService::retryDelayAfter)).containsOnly(Duration.ofHours(24))
    }

    // maxLag with defaults = 2 × 2min + 10s = 4m10s.
    @Test
    fun `is not lagging when the oldest unprocessed change is younger than maxLag`() {
        stubWatermark(LocalDateTime.now().minusHours(1))
        stubOldestUnprocessed(LocalDateTime.now().minusMinutes(1))

        assertThat(service.isReconcileLagging()).isFalse()
    }

    @Test
    fun `is lagging when the oldest unprocessed change is older than maxLag`() {
        stubWatermark(LocalDateTime.now().minusHours(1))
        stubOldestUnprocessed(LocalDateTime.now().minusMinutes(10))

        assertThat(service.isReconcileLagging()).isTrue()
    }

    @Test
    fun `is not lagging when there is no unprocessed change`() {
        stubWatermark(LocalDateTime.now().minusHours(1))
        stubOldestUnprocessed(null)

        assertThat(service.isReconcileLagging()).isFalse()
    }

    private fun stubWatermark(watermark: LocalDateTime) {
        whenever(stateRepository.findById(OpenSearchReconcileState.SINGLETON_ID))
            .thenReturn(Optional.of(OpenSearchReconcileState(watermark = watermark)))
    }

    private fun stubOldestUnprocessed(value: LocalDateTime?) {
        val query: TypedQuery<LocalDateTime> = mock()
        whenever(entityManager.createQuery(any<String>(), eq(LocalDateTime::class.java))).thenReturn(query)
        whenever(query.setParameter(any<String>(), any())).thenReturn(query)
        whenever(query.singleResult).thenReturn(value)
    }
}
