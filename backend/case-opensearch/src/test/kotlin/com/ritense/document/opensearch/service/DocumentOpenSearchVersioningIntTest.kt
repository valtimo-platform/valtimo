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
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
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
 * Integration tests for OpenSearch external versioning against a real OpenSearch. "Highest version wins":
 * a re-send of an equal-or-lower [JsonSchemaDocumentOsDocument.indexVersion] is a benign version-conflict
 * no-op (swallowed by [JsonSchemaDocumentOsConverter.indexChunk] / [DocumentOpenSearchSyncService]) and can
 * never overwrite a newer document; a strictly higher version updates.
 *
 * Runs **non-transactionally** so the live-sync path sees committed data and its own JPA `version` bumps.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class DocumentOpenSearchVersioningIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    lateinit var converter: JsonSchemaDocumentOsConverter

    @Autowired
    lateinit var syncService: DocumentOpenSearchSyncService

    @AfterEach
    fun cleanUp() {
        runWithoutAuthorization { documentService.removeDocuments("house") }
        clearIndex()
    }

    @Test
    fun `re-indexing the same version is a benign no-op`() {
        val id = UUID.randomUUID().toString()
        openSearchRepository.saveAll(listOf(osDoc(id, indexVersion = 5, internalStatus = "first")))
        refreshIndex()

        val skipped = converter.indexChunk(listOf(osDoc(id, indexVersion = 5, internalStatus = "second")))
        refreshIndex()

        assertThat(skipped).isZero()
        assertThat(openSearchRepository.findById(id).get().internalStatus).isEqualTo("first")
    }

    @Test
    fun `a stale lower-version write does not overwrite a newer document (order independence)`() {
        val id = UUID.randomUUID().toString()
        openSearchRepository.saveAll(listOf(osDoc(id, indexVersion = 6, internalStatus = "sixth")))
        refreshIndex()

        val skipped = converter.indexChunk(listOf(osDoc(id, indexVersion = 5, internalStatus = "fifth")))
        refreshIndex()

        assertThat(skipped).isZero()
        assertThat(openSearchRepository.findById(id).get().internalStatus).isEqualTo("sixth")
    }

    @Test
    fun `a strictly higher version updates the document`() {
        val id = UUID.randomUUID().toString()
        openSearchRepository.saveAll(listOf(osDoc(id, indexVersion = 5, internalStatus = "old")))
        refreshIndex()

        val skipped = converter.indexChunk(listOf(osDoc(id, indexVersion = 6, internalStatus = "new")))
        refreshIndex()

        assertThat(skipped).isZero()
        assertThat(openSearchRepository.findById(id).get().internalStatus).isEqualTo("new")
    }

    @Test
    fun `the live path indexes a real change and swallows a redundant re-send`() {
        val document = createDocument("versioned")
        val id = document.id().id
        syncService.upsertById(id)
        refreshIndex()

        runWithoutAuthorization { documentService.setInternalStatus(document.id(), "started") }
        syncService.upsertById(id)
        refreshIndex()
        assertThat(openSearchRepository.findById(id.toString()).get().internalStatus).isEqualTo("started")

        // Re-sending the same (now-current) version is a version conflict — swallowed, no exception.
        assertThatCode { syncService.upsertById(id) }.doesNotThrowAnyException()
        refreshIndex()
        assertThat(openSearchRepository.findById(id.toString()).get().internalStatus).isEqualTo("started")
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

    private fun osDoc(id: String, indexVersion: Long, internalStatus: String) = JsonSchemaDocumentOsDocument(
        id = id,
        content = null,
        definitionId = null,
        createdOn = null,
        modifiedOn = null,
        createdBy = null,
        sequence = null,
        version = null,
        assigneeId = null,
        assigneeFullName = null,
        internalStatus = internalStatus,
        caseTags = null,
        relations = null,
        relatedFiles = null,
        retentionDate = null,
        indexVersion = indexVersion,
    )
}
