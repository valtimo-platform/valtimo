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
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatCode
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Integration tests for the live-sync reload path ([DocumentOpenSearchSyncService]) against a real
 * PostgreSQL + OpenSearch. Runs **non-transactionally** so documents actually commit and can be reloaded
 * from the source of truth — mirroring how the [com.ritense.document.opensearch.handler.DocumentOpenSearchEventListener]
 * invokes the sync service after commit. The listener→sync-service dispatch itself is unit-tested.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class DocumentOpenSearchLiveSyncIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    lateinit var syncService: DocumentOpenSearchSyncService

    @AfterEach
    fun cleanUp() {
        runWithoutAuthorization { documentService.removeDocuments("house") }
        clearIndex()
    }

    @Test
    fun `upsertById indexes the current committed state of the document`() {
        val document = createDocument("live-street")
        clearIndex()

        syncService.upsertById(document.id().id)

        refreshIndex()
        val indexed = openSearchRepository.findById(document.id().toString())
        assertThat(indexed).isPresent
        assertThat(indexed.get().contentText).contains("live-street")
    }

    @Test
    fun `upsertById reloads the lazy internalStatus of the document`() {
        val document = createDocument("with-status")
        runWithoutAuthorization { documentService.setInternalStatus(document.id(), "started") }
        clearIndex()

        syncService.upsertById(document.id().id)

        refreshIndex()
        val indexed = openSearchRepository.findById(document.id().toString())
        assertThat(indexed).isPresent
        assertThat(indexed.get().internalStatus).isEqualTo("started")
    }

    @Test
    fun `upsertById skips a document that no longer exists`() {
        val danglingId = UUID.randomUUID()

        assertThatCode { syncService.upsertById(danglingId) }.doesNotThrowAnyException()

        refreshIndex()
        assertThat(openSearchRepository.findById(danglingId.toString())).isEmpty
    }

    @Test
    fun `delete removes the document from the index`() {
        val document = createDocument("to-be-deleted")
        syncService.upsertById(document.id().id)
        refreshIndex()
        assertThat(openSearchRepository.findById(document.id().toString())).isPresent

        syncService.delete(document.id().id)

        refreshIndex()
        assertThat(openSearchRepository.findById(document.id().toString())).isEmpty
    }

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
