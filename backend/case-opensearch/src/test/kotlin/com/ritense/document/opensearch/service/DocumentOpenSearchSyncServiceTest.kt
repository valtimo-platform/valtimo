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

import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.opensearch.repository.JsonSchemaDocumentOpenSearchRepository
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.elasticsearch.VersionConflictException
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.SimpleTransactionStatus
import java.util.Optional
import java.util.UUID

class DocumentOpenSearchSyncServiceTest {

    private val repository: JsonSchemaDocumentOpenSearchRepository = mock()
    private val documentRepository: JsonSchemaDocumentRepository = mock()
    private val converter: JsonSchemaDocumentOsConverter = mock()
    private val transactionManager: PlatformTransactionManager = mock()
    private lateinit var service: DocumentOpenSearchSyncService

    @BeforeEach
    fun setUp() {
        // Let the read-only TransactionTemplate run its callback inline.
        whenever(transactionManager.getTransaction(any())).thenReturn(SimpleTransactionStatus())
        service = DocumentOpenSearchSyncService(repository, documentRepository, converter, transactionManager)
    }

    @Test
    fun `upsertById reloads the document and saves the converted os document`() {
        val id = UUID.randomUUID()
        val document: JsonSchemaDocument = mock()
        val osDocument = osDocument(id.toString())
        whenever(documentRepository.findById(JsonSchemaDocumentId.existingId(id))).thenReturn(Optional.of(document))
        whenever(converter.toOsDocument(document)).thenReturn(osDocument)

        service.upsertById(id)

        verify(repository).save(osDocument)
    }

    @Test
    fun `upsertById swallows a version conflict (a newer version is already indexed)`() {
        val id = UUID.randomUUID()
        val document: JsonSchemaDocument = mock()
        val osDocument = osDocument(id.toString())
        whenever(documentRepository.findById(JsonSchemaDocumentId.existingId(id))).thenReturn(Optional.of(document))
        whenever(converter.toOsDocument(document)).thenReturn(osDocument)
        whenever(repository.save(osDocument)).thenThrow(VersionConflictException("conflict"))

        assertThatCode { service.upsertById(id) }.doesNotThrowAnyException()
    }

    @Test
    fun `upsertById propagates a non-conflict failure`() {
        val id = UUID.randomUUID()
        val document: JsonSchemaDocument = mock()
        val osDocument = osDocument(id.toString())
        whenever(documentRepository.findById(JsonSchemaDocumentId.existingId(id))).thenReturn(Optional.of(document))
        whenever(converter.toOsDocument(document)).thenReturn(osDocument)
        whenever(repository.save(osDocument)).thenThrow(RuntimeException("transport error"))

        assertThatThrownBy { service.upsertById(id) }.isInstanceOf(RuntimeException::class.java)
    }

    @Test
    fun `upsertById skips a document that no longer exists (already deleted)`() {
        val id = UUID.randomUUID()
        whenever(documentRepository.findById(JsonSchemaDocumentId.existingId(id))).thenReturn(Optional.empty())

        service.upsertById(id)

        verify(converter, never()).toOsDocument(any())
        verify(repository, never()).save(any())
    }

    @Test
    fun `delete removes the document from opensearch by id`() {
        val id = UUID.randomUUID()

        service.delete(id)

        verify(repository).deleteById(id.toString())
    }

    private fun osDocument(id: String) = JsonSchemaDocumentOsDocument(
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
        internalStatus = null,
        caseTags = null,
        relations = null,
        relatedFiles = null,
        retentionDate = null,
    )
}
