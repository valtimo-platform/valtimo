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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.opensearch.domain.OpenSearchReconcileState
import com.ritense.document.opensearch.domain.PendingIndexDeletion
import com.ritense.document.opensearch.repository.OpenSearchReconcileStateRepository
import com.ritense.document.opensearch.repository.PendingIndexDeletionRepository
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
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
 * Integration tests for [DocumentOpenSearchReconcileService] against a real PostgreSQL + OpenSearch.
 * Runs **non-transactionally** so `changed_on`, the watermark state and the pending-index-deletion table
 * behave as in production (own short transactions, committed data). Each test seeds the watermark explicitly.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class DocumentOpenSearchReconcileIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    lateinit var reconcileService: DocumentOpenSearchReconcileService

    @Autowired
    lateinit var syncService: DocumentOpenSearchSyncService

    @Autowired
    lateinit var stateRepository: OpenSearchReconcileStateRepository

    @Autowired
    lateinit var pendingIndexDeletionRepository: PendingIndexDeletionRepository

    @Autowired
    lateinit var documentRepository: JsonSchemaDocumentRepository

    @Autowired
    lateinit var transactionManager: PlatformTransactionManager

    @Autowired
    lateinit var lockProvider: LockProvider

    @AfterEach
    fun cleanUp() {
        runWithoutAuthorization { documentService.removeDocuments("house") }
        clearIndex()
        stateRepository.deleteAll()
        pendingIndexDeletionRepository.deleteAll()
    }

    @Test
    fun `reconcile indexes documents changed since the watermark and advances it`() {
        val document = createDocument("reconcile-me")
        clearIndex()
        seedWatermark(LocalDateTime.now().minusHours(1))

        reconcileService.reconcile()

        refreshIndex()
        assertThat(openSearchRepository.findById(document.id().toString())).isPresent
        val watermark = stateRepository.findById(OpenSearchReconcileState.SINGLETON_ID).get().watermark
        assertThat(watermark).isAfter(LocalDateTime.now().minusMinutes(30))
    }

    @Test
    fun `reconcile picks up a status change that has no live event and no modifiedOn bump`() {
        val document = createDocument("status-doc")
        runWithoutAuthorization { documentService.setInternalStatus(document.id(), "started") }
        clearIndex()
        seedWatermark(LocalDateTime.now().minusHours(1))

        reconcileService.reconcile()

        refreshIndex()
        val indexed = openSearchRepository.findById(document.id().toString())
        assertThat(indexed).isPresent
        assertThat(indexed.get().internalStatus).isEqualTo("started")
    }

    @Test
    fun `reconcile is skipped while another writer holds the ShedLock`() {
        val document = createDocument("locked-out")
        clearIndex()
        seedWatermark(LocalDateTime.now().minusHours(1))

        val lock = lockProvider.lock(
            LockConfiguration(
                Instant.now(),
                DocumentOpenSearchReconcileService.LOCK_NAME,
                Duration.ofMinutes(5),
                Duration.ZERO,
            )
        )
        assertThat(lock).isPresent
        try {
            reconcileService.reconcile()
        } finally {
            lock.get().unlock()
        }

        refreshIndex()
        assertThat(openSearchRepository.findById(document.id().toString())).isEmpty
    }

    @Test
    fun `reconcile drains pending index deletions, removing docs from the index`() {
        val document = createDocument("to-delete")
        val id = document.id().id
        syncService.upsertById(id)
        refreshIndex()
        assertThat(openSearchRepository.findById(id.toString())).isPresent

        // Delete from PostgreSQL and record the pending deletion the in-transaction listener would have written.
        runWithoutAuthorization { documentService.deleteDocument(document.id()) }
        pendingIndexDeletionRepository.save(PendingIndexDeletion(documentId = id))
        seedWatermark(LocalDateTime.now().minusHours(1))

        reconcileService.reconcile()

        refreshIndex()
        assertThat(openSearchRepository.findById(id.toString())).isEmpty
        assertThat(pendingIndexDeletionRepository.count()).isZero()
    }

    @Test
    fun `changed_on advances on a status change while modifiedOn stays unset`() {
        val document = createDocument("changed-on-doc")
        val createdChangedOn = readChangedOn(document.id().id)
        // DATETIME can be second-resolution on MySQL; sleep past a full second so the bump is observable.
        Thread.sleep(1100)

        runWithoutAuthorization { documentService.setInternalStatus(document.id(), "started") }

        assertThat(readChangedOn(document.id().id)).isAfter(createdChangedOn)
        assertThat(readModifiedOn(document.id().id)).isEmpty
    }

    private fun seedWatermark(watermark: LocalDateTime) {
        stateRepository.save(OpenSearchReconcileState(watermark = watermark))
    }

    private fun readChangedOn(id: UUID): LocalDateTime =
        TransactionTemplate(transactionManager).execute {
            documentRepository.findById(JsonSchemaDocumentId.existingId(id)).get().changedOn()
        }!!

    private fun readModifiedOn(id: UUID) =
        TransactionTemplate(transactionManager).execute {
            documentRepository.findById(JsonSchemaDocumentId.existingId(id)).get().modifiedOn()
        }!!

    private fun clearIndex() {
        openSearchRepository.deleteAll()
        refreshIndex()
    }

    private fun createDocument(street: String): JsonSchemaDocument =
        runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest("house", "house", "1.0.0", objectMapper.createObjectNode().put("street", street))
            ).resultingDocument().get()
        }
}
