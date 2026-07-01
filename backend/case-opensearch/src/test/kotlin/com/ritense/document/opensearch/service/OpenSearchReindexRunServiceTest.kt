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
import com.ritense.document.opensearch.repository.OpenSearchReindexRunRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

class OpenSearchReindexRunServiceTest {

    private val repository: OpenSearchReindexRunRepository = mock()
    private val objectMapper: ObjectMapper = ObjectMapper().findAndRegisterModules()
    private lateinit var service: OpenSearchReindexRunService

    @BeforeEach
    fun setUp() {
        service = OpenSearchReindexRunService(repository, objectMapper)
        whenever(repository.save(any<OpenSearchReindexRun>())).doAnswer { it.arguments[0] as OpenSearchReindexRun }
    }

    @Test
    fun `startOrResume creates a new RUNNING run owned by this instance`() {
        val request = ReindexRequest(documentDefinitionName = "house", pageSize = 250)

        val run = service.startOrResume(request)

        assertThat(run.status).isEqualTo(ReindexRunStatus.RUNNING)
        assertThat(run.instanceId).isEqualTo(service.instanceId)
        assertThat(run.pageSize).isEqualTo(250)
        assertThat(run.scope).contains("house")
        verify(repository).save(any<OpenSearchReindexRun>())
    }

    @Test
    fun `startOrResume re-arms an existing run when resumeRunId is set`() {
        val runId = UUID.randomUUID()
        val existing = OpenSearchReindexRun(
            id = runId,
            status = ReindexRunStatus.FAILED,
            instanceId = "other-instance",
            pageSize = 100,
            lastId = UUID.randomUUID(),
            error = "boom",
        )
        whenever(repository.findById(runId)).thenReturn(Optional.of(existing))

        val run = service.startOrResume(ReindexRequest(resumeRunId = runId))

        assertThat(run.id).isEqualTo(runId)
        assertThat(run.status).isEqualTo(ReindexRunStatus.RUNNING)
        assertThat(run.error).isNull()
        assertThat(run.finishedOn).isNull()
    }

    @Test
    fun `recordProgress updates cursor and counts`() {
        val runId = UUID.randomUUID()
        val run = OpenSearchReindexRun(id = runId, instanceId = service.instanceId, pageSize = 100)
        whenever(repository.findById(runId)).thenReturn(Optional.of(run))
        val cursor = UUID.randomUUID()

        service.recordProgress(runId, cursor, processed = 42, skipped = 3)

        assertThat(run.lastId).isEqualTo(cursor)
        assertThat(run.processedCount).isEqualTo(42)
        assertThat(run.skippedCount).isEqualTo(3)
        verify(repository).save(run)
    }

    @Test
    fun `complete fail and stop set the terminal status`() {
        val runId = UUID.randomUUID()
        val run = OpenSearchReindexRun(id = runId, instanceId = service.instanceId, pageSize = 100)
        whenever(repository.findById(runId)).thenReturn(Optional.of(run))

        service.complete(runId)
        assertThat(run.status).isEqualTo(ReindexRunStatus.COMPLETED)
        assertThat(run.finishedOn).isNotNull()

        service.fail(runId, "kaboom")
        assertThat(run.status).isEqualTo(ReindexRunStatus.FAILED)
        assertThat(run.error).isEqualTo("kaboom")

        service.stop(runId)
        assertThat(run.status).isEqualTo(ReindexRunStatus.STOPPED)
    }

    @Test
    fun `reconcileOrphanedRuns marks this instance's RUNNING rows as FAILED`() {
        val orphan = OpenSearchReindexRun(
            id = UUID.randomUUID(),
            status = ReindexRunStatus.RUNNING,
            instanceId = service.instanceId,
            pageSize = 100,
        )
        whenever(repository.findAllByStatusAndInstanceId(ReindexRunStatus.RUNNING, service.instanceId))
            .thenReturn(listOf(orphan))

        service.reconcileOrphanedRuns()

        assertThat(orphan.status).isEqualTo(ReindexRunStatus.FAILED)
        assertThat(orphan.error).contains("Reconciled on startup")
        val captor = argumentCaptor<List<OpenSearchReindexRun>>()
        verify(repository).saveAll(captor.capture())
        assertThat(captor.firstValue).containsExactly(orphan)
    }

    @Test
    fun `reconcileOrphanedRuns does nothing when no orphans exist`() {
        whenever(repository.findAllByStatusAndInstanceId(ReindexRunStatus.RUNNING, service.instanceId))
            .thenReturn(emptyList())

        service.reconcileOrphanedRuns()

        verify(repository, never()).saveAll(any<List<OpenSearchReindexRun>>())
    }

    @Test
    fun `toStatusMap returns a not-running placeholder when nothing matches`() {
        whenever(repository.findFirstByOrderByStartedOnDesc()).thenReturn(null)

        val status = service.toStatusMap(null)

        assertThat(status["running"]).isEqualTo(false)
        assertThat(status["runId"]).isNull()
    }

    @Test
    fun `toStatusMap reports running state and counts for a specific run`() {
        val runId = UUID.randomUUID()
        val run = OpenSearchReindexRun(
            id = runId,
            status = ReindexRunStatus.RUNNING,
            instanceId = service.instanceId,
            pageSize = 100,
            processedCount = 7,
            skippedCount = 1,
        )
        whenever(repository.findById(runId)).thenReturn(Optional.of(run))

        val status = service.toStatusMap(runId)

        assertThat(status["runId"]).isEqualTo(runId)
        assertThat(status["running"]).isEqualTo(true)
        assertThat(status["status"]).isEqualTo(ReindexRunStatus.RUNNING)
        assertThat(status["processedCount"]).isEqualTo(7L)
        assertThat(status["skippedCount"]).isEqualTo(1L)
    }
}
