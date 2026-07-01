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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.document.opensearch.domain.OpenSearchReindexRun
import com.ritense.document.opensearch.domain.ReindexRunStatus
import com.ritense.document.opensearch.repository.JsonSchemaDocumentOpenSearchRepository
import jakarta.persistence.EntityManager
import net.javacrumbs.shedlock.core.LockProvider
import net.javacrumbs.shedlock.core.SimpleLock
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.timeout
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.transaction.PlatformTransactionManager
import java.util.Optional
import java.util.UUID

class DocumentOpenSearchReindexServiceTest {

    private val entityManager: EntityManager = mock()
    private val openSearchRepository: JsonSchemaDocumentOpenSearchRepository = mock()
    private val objectMapper: ObjectMapper = mock()
    private val elasticsearchOperations: ElasticsearchOperations = mock()
    private val transactionManager: PlatformTransactionManager = mock()
    private val lockProvider: LockProvider = mock()
    private val runService: OpenSearchReindexRunService = mock()

    private lateinit var service: DocumentOpenSearchReindexService

    @BeforeEach
    fun setUp() {
        service = DocumentOpenSearchReindexService(
            entityManager,
            openSearchRepository,
            objectMapper,
            elasticsearchOperations,
            transactionManager,
            lockProvider,
            runService,
        )
    }

    @Test
    fun `start returns null and creates no run when the lock is already held`() {
        whenever(lockProvider.lock(any())).thenReturn(Optional.empty())

        val runId = service.start(ReindexRequest())

        assertThat(runId).isNull()
        verify(runService, never()).startOrResume(any())
    }

    @Test
    fun `start creates a run and releases the lock when acquired`() {
        val simpleLock: SimpleLock = mock()
        whenever(lockProvider.lock(any())).thenReturn(Optional.of(simpleLock))
        val expectedId = UUID.randomUUID()
        whenever(runService.startOrResume(any())).thenReturn(run(expectedId))

        val runId = service.start(ReindexRequest())

        assertThat(runId).isEqualTo(expectedId)
        verify(runService).startOrResume(any())
        // The dispatched run finishes (here it terminates early against the mocks); the lock must be released.
        verify(simpleLock, timeout(5_000)).unlock()
    }

    @Test
    fun `reindex marks the run STOPPED when cancellation was requested`() {
        val runId = UUID.randomUUID()
        whenever(runService.cursorOf(runId)).thenReturn(null)
        whenever(runService.processedOf(runId)).thenReturn(0L)

        // destroy() sets the cancellation flag (and shuts down the idle executor).
        service.destroy()

        val processed = service.reindex(runId, ReindexRequest())

        assertThat(processed).isEqualTo(0L)
        verify(runService).stop(runId)
        verify(runService, never()).complete(any())
    }

    private fun run(id: UUID) = OpenSearchReindexRun(
        id = id,
        status = ReindexRunStatus.RUNNING,
        instanceId = "test-instance",
        pageSize = 100,
    )
}
