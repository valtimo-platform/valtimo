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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.opensearch.domain.OpenSearchReindexRun
import com.ritense.document.opensearch.domain.ReindexRunStatus
import com.ritense.document.opensearch.repository.OpenSearchReindexRunRepository
import jakarta.persistence.EntityManager
import net.javacrumbs.shedlock.core.LockConfiguration
import net.javacrumbs.shedlock.core.LockProvider
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.util.UUID

/**
 * Integration tests for [DocumentOpenSearchReindexService].
 *
 * These tests run **non-transactionally** ([Propagation.NOT_SUPPORTED], overriding the base's
 * `@Transactional`). The production re-index runs on a background executor with no ambient transaction,
 * committing its run-state updates in their own short transactions; reproducing that here is the only way
 * the keyset reads and the persisted progress/cursor behave as they do in production. Committed test data
 * is removed in [cleanUp].
 *
 * Because the tests commit, creating a document also triggers the live event sync
 * ([com.ritense.document.opensearch.handler.DocumentOpenSearchEventHandler]) which indexes that document
 * into OpenSearch. To assert on the re-index in isolation we [clearIndex] after the document setup and
 * before running the re-index, so the index reflects only what the re-index (re)indexed.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class DocumentOpenSearchReindexServiceIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    lateinit var reindexService: DocumentOpenSearchReindexService

    @Autowired
    lateinit var reindexRunService: OpenSearchReindexRunService

    @Autowired
    lateinit var reindexRunRepository: OpenSearchReindexRunRepository

    @Autowired
    lateinit var lockProvider: LockProvider

    @Autowired
    lateinit var entityManager: EntityManager

    @Autowired
    lateinit var transactionManager: PlatformTransactionManager

    @AfterEach
    fun cleanUp() {
        runWithoutAuthorization { documentService.removeDocuments("house") }
        reindexRunRepository.deleteAll()
    }

    @Test
    fun `full re-index indexes every document and completes`() {
        val ids = (1..5).map { createDocument("street-$it").id().id }
        clearIndex()

        val (runId, processed) = reindex(ReindexRequest())

        assertThat(processed).isEqualTo(5L)
        val run = reindexRunRepository.findById(runId).get()
        assertThat(run.status).isEqualTo(ReindexRunStatus.COMPLETED)
        assertThat(run.processedCount).isEqualTo(5L)
        refreshIndex()
        assertThat(openSearchRepository.count()).isEqualTo(5L)
        ids.forEach { assertThat(openSearchRepository.findById(it.toString())).isPresent }
    }

    @Test
    fun `re-index populates internalStatus from the live entity (C1)`() {
        val document = createDocument("with-status")
        runWithoutAuthorization { documentService.setInternalStatus(document.id(), "started") }
        clearIndex()

        reindex(ReindexRequest())

        refreshIndex()
        val indexed = openSearchRepository.findById(document.id().toString())
        assertThat(indexed).isPresent
        assertThat(indexed.get().internalStatus).isEqualTo("started")
    }

    @Test
    fun `scoped re-index by documentDefinitionName only indexes matching documents`() {
        createDocument("house-doc-1")
        createDocument("house-doc-2")
        clearIndex()

        reindex(ReindexRequest(documentDefinitionName = "house"))
        refreshIndex()
        assertThat(openSearchRepository.count()).isEqualTo(2L)

        clearIndex()

        val (_, processed) = reindex(ReindexRequest(documentDefinitionName = "does-not-exist"))
        assertThat(processed).isEqualTo(0L)
        refreshIndex()
        assertThat(openSearchRepository.count()).isEqualTo(0L)
    }

    @Test
    fun `scoped re-index by documentIds only indexes the requested subset`() {
        val target = createDocument("target")
        createDocument("other-1")
        createDocument("other-2")
        clearIndex()

        val (_, processed) = reindex(ReindexRequest(documentIds = listOf(target.id().id)))

        assertThat(processed).isEqualTo(1L)
        refreshIndex()
        assertThat(openSearchRepository.count()).isEqualTo(1L)
        assertThat(openSearchRepository.findById(target.id().toString())).isPresent
    }

    @Test
    fun `scoped re-index by modifiedAfter only indexes documents modified after the cutoff`() {
        val untouched = createDocument("untouched")           // modifiedOn stays null -> excluded
        val modified = createDocument("before-modify")
        val cutoff = LocalDateTime.now()
        Thread.sleep(50)
        runWithoutAuthorization {
            documentService.modifyDocument(modified, objectMapper.createObjectNode().put("street", "after-modify"))
        }
        clearIndex()

        reindex(ReindexRequest(modifiedAfter = cutoff))

        refreshIndex()
        assertThat(openSearchRepository.findById(modified.id().toString())).isPresent
        assertThat(openSearchRepository.findById(untouched.id().toString())).isEmpty
    }

    @Test
    fun `re-index resumes from the persisted cursor of a prior run`() {
        (1..6).forEach { createDocument("doc-$it") }
        // Use the database's own ascending id ordering (PostgreSQL orders UUIDs unsigned, which differs
        // from Kotlin's signed UUID.compareTo) so the cursor and expected set match the keyset query.
        val dbOrderedIds = TransactionTemplate(transactionManager).execute {
            entityManager
                .createQuery("SELECT d.id.id FROM JsonSchemaDocument d ORDER BY d.id.id", UUID::class.java)
                .resultList
        }!!
        val cursor = dbOrderedIds[2]                           // resume after the 3rd id -> 3 docs remain
        val expectedIds = dbOrderedIds.subList(3, dbOrderedIds.size)
        val seededRun = reindexRunRepository.save(
            OpenSearchReindexRun(
                id = UUID.randomUUID(),
                status = ReindexRunStatus.FAILED,
                instanceId = reindexRunService.instanceId,
                pageSize = ReindexRequest.DEFAULT_PAGE_SIZE,
                lastId = cursor,
                processedCount = 3,
            )
        )
        clearIndex()

        reindexService.reindex(seededRun.id, ReindexRequest())

        refreshIndex()
        assertThat(openSearchRepository.count()).isEqualTo(expectedIds.size.toLong())
        expectedIds.forEach { assertThat(openSearchRepository.findById(it.toString())).isPresent }
        assertThat(reindexRunRepository.findById(seededRun.id).get().status).isEqualTo(ReindexRunStatus.COMPLETED)
    }

    @Test
    fun `startup reconciliation marks this instance's orphaned RUNNING run as FAILED`() {
        val orphan = reindexRunRepository.save(
            OpenSearchReindexRun(
                id = UUID.randomUUID(),
                status = ReindexRunStatus.RUNNING,
                instanceId = reindexRunService.instanceId,
                pageSize = ReindexRequest.DEFAULT_PAGE_SIZE,
            )
        )

        reindexRunService.reconcileOrphanedRuns()

        assertThat(reindexRunRepository.findById(orphan.id).get().status).isEqualTo(ReindexRunStatus.FAILED)
    }

    @Test
    fun `start returns null when the cluster-wide lock is already held`() {
        val lock = lockProvider.lock(
            LockConfiguration(
                Instant.now(),
                DocumentOpenSearchReindexService.LOCK_NAME,
                Duration.ofMinutes(5),
                Duration.ZERO,
            )
        )
        assertThat(lock).isPresent
        try {
            assertThat(reindexService.start(ReindexRequest())).isNull()
        } finally {
            lock.get().unlock()
        }
    }

    /** Clears the OpenSearch index (and refreshes) so a subsequent assertion sees only the re-index output. */
    private fun clearIndex() {
        openSearchRepository.deleteAll()
        refreshIndex()
    }

    /**
     * Creates a run for [request] and drives the re-index synchronously (each step still uses its own
     * transaction, since the test runs without an ambient one). Returns the run id and the documents
     * processed.
     */
    private fun reindex(request: ReindexRequest): Pair<UUID, Long> {
        val run = reindexRunService.startOrResume(request)
        return run.id to reindexService.reindex(run.id, request)
    }

    private fun createDocument(street: String): JsonSchemaDocument =
        runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest("house", "house", "1.0.0", objectMapper.createObjectNode().put("street", street))
            ).resultingDocument().get()
        }
}
