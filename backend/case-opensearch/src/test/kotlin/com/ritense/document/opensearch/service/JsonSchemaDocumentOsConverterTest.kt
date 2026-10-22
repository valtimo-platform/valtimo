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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.opensearch.domain.OsDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.elasticsearch.BulkFailureException
import org.springframework.data.elasticsearch.BulkFailureException.FailureDetails
import org.springframework.data.elasticsearch.VersionConflictException
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates

class JsonSchemaDocumentOsConverterTest {

    private val objectMapper: ObjectMapper = mock()
    private val operations: ElasticsearchOperations = mock()
    private val resolver = OpenSearchIndexNameResolver()
    private lateinit var converter: JsonSchemaDocumentOsConverter

    private val index = IndexCoordinates.of(resolver.indexNameFor(DEFINITION))

    @BeforeEach
    fun setUp() {
        converter = JsonSchemaDocumentOsConverter(objectMapper, operations, resolver)
    }

    @Test
    fun `indexChunk bulk-saves to the definition's index and reports zero skips on success`() {
        val chunk = listOf(osDocument("a"), osDocument("b"))

        val skipped = converter.indexChunk(chunk)

        assertThat(skipped).isZero()
        verify(operations).save(eq(chunk), eq(index))
    }

    @Test
    fun `indexChunk re-processes only the failed documents and isolates a real failure`() {
        val good = osDocument("good")
        val poison = osDocument("poison")
        whenever(operations.save(any<List<JsonSchemaDocumentOsDocument>>(), any<IndexCoordinates>()))
            .thenThrow(BulkFailureException("bulk failed", mapOf("poison" to FailureDetails(400, "mapper_parsing_exception"))))
        whenever(operations.save(eq(poison), any<IndexCoordinates>())).thenThrow(RuntimeException("mapping error"))

        val skipped = converter.indexChunk(listOf(good, poison))

        assertThat(skipped).isEqualTo(1L)
        verify(operations).save(eq(poison), eq(index))
        // "good" was not in the failure map, so it is never re-processed.
        verify(operations, never()).save(eq(good), any<IndexCoordinates>())
    }

    @Test
    fun `indexChunk treats a version conflict as benign (no skip, no retry)`() {
        val document = osDocument("a")
        whenever(operations.save(any<List<JsonSchemaDocumentOsDocument>>(), any<IndexCoordinates>()))
            .thenThrow(BulkFailureException("bulk failed", mapOf("a" to FailureDetails(409, "version_conflict_engine_exception ..."))))

        val skipped = converter.indexChunk(listOf(document))

        assertThat(skipped).isZero()
        // A 409 means the stored doc is already ≥ this version — never re-saved.
        verify(operations, never()).save(any<JsonSchemaDocumentOsDocument>(), any<IndexCoordinates>())
    }

    @Test
    fun `indexChunk classifies a version conflict by message when status is absent`() {
        val document = osDocument("a")
        whenever(operations.save(any<List<JsonSchemaDocumentOsDocument>>(), any<IndexCoordinates>()))
            .thenThrow(BulkFailureException("bulk failed", mapOf("a" to FailureDetails(null, "... version_conflict_engine_exception ..."))))

        val skipped = converter.indexChunk(listOf(document))

        assertThat(skipped).isZero()
        verify(operations, never()).save(any<JsonSchemaDocumentOsDocument>(), any<IndexCoordinates>())
    }

    @Test
    fun `indexChunk treats a VersionConflictException on retry as benign`() {
        val document = osDocument("a")
        whenever(operations.save(any<List<JsonSchemaDocumentOsDocument>>(), any<IndexCoordinates>()))
            .thenThrow(BulkFailureException("bulk failed", mapOf("a" to FailureDetails(500, "transient"))))
        whenever(operations.save(eq(document), any<IndexCoordinates>())).thenThrow(VersionConflictException("conflict"))

        val skipped = converter.indexChunk(listOf(document))

        assertThat(skipped).isZero()
        verify(operations).save(eq(document), eq(index))
    }

    @Test
    fun `indexChunk routes each document to its own definition's index`() {
        val house = osDocument("h", definitionName = "house")
        val person = osDocument("p", definitionName = "person")

        converter.indexChunk(listOf(house, person))

        verify(operations).save(eq(listOf(house)), eq(IndexCoordinates.of(resolver.indexNameFor("house"))))
        verify(operations).save(eq(listOf(person)), eq(IndexCoordinates.of(resolver.indexNameFor("person"))))
    }

    private fun osDocument(id: String, definitionName: String = DEFINITION) = JsonSchemaDocumentOsDocument(
        id = id,
        content = null,
        definitionId = OsDefinitionId(name = definitionName, version = null, blueprintId = null),
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

    companion object {
        private const val DEFINITION = "test"
    }
}
