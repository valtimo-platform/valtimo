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
import com.ritense.document.opensearch.domain.OsBlueprintId
import com.ritense.document.opensearch.domain.OsDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.eq
import org.mockito.kotlin.inOrder
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.springframework.data.elasticsearch.BulkFailureException
import org.springframework.data.elasticsearch.BulkFailureException.FailureDetails
import org.springframework.data.elasticsearch.VersionConflictException
import org.springframework.dao.DataAccessResourceFailureException
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.SearchHit
import org.springframework.data.elasticsearch.core.SearchHits
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import org.springframework.data.elasticsearch.core.query.Query
import java.util.UUID

class JsonSchemaDocumentOsConverterTest {

    private val objectMapper: ObjectMapper = mock()
    private val operations: ElasticsearchOperations = mock()
    private val resolver = OpenSearchIndexNameResolver()
    private val indexInitializer: DocumentOpenSearchIndexInitializer = mock()
    private val completeness: IndexCompletenessService = mock()
    private lateinit var converter: JsonSchemaDocumentOsConverter

    private val index = IndexCoordinates.of(resolver.writeAliasFor(DEFINITION, VERSION_TAG))

    @BeforeEach
    fun setUp() {
        converter = JsonSchemaDocumentOsConverter(objectMapper, operations, resolver, indexInitializer, completeness)
        indexedCopies()
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

        verify(operations).save(eq(listOf(house)), eq(IndexCoordinates.of(resolver.writeAliasFor("house", VERSION_TAG))))
        verify(operations).save(eq(listOf(person)), eq(IndexCoordinates.of(resolver.writeAliasFor("person", VERSION_TAG))))
    }

    @Test
    fun `indexChunk ensures each definition's index before saving to it`() {
        val house = osDocument("h", definitionName = "house")

        converter.indexChunk(listOf(house))

        inOrder(indexInitializer, operations) {
            verify(indexInitializer).ensureIndex("house", VERSION_TAG)
            verify(operations).save(eq(listOf(house)), eq(IndexCoordinates.of(resolver.writeAliasFor("house", VERSION_TAG))))
        }
    }

    @Test
    fun `indexChunk with an override index does not provision (the scoped rebuild already did)`() {
        val override = IndexCoordinates.of("some_rebuild_index")

        converter.indexChunk(listOf(osDocument("a")), override)

        verify(operations).save(eq(listOf(osDocument("a"))), eq(override))
        verifyNoInteractions(indexInitializer)
    }

    @Test
    fun `indexChunk records a rejected document so its definition is searched in the database`() {
        val id = UUID.randomUUID()
        val poison = osDocument(id.toString())
        whenever(operations.save(any<List<JsonSchemaDocumentOsDocument>>(), any<IndexCoordinates>()))
            .thenThrow(BulkFailureException("bulk failed", mapOf(id.toString() to FailureDetails(400, "mapper_parsing_exception"))))
        whenever(operations.save(eq(poison), any<IndexCoordinates>())).thenThrow(RuntimeException("mapping error"))

        converter.indexChunk(listOf(poison))

        verify(completeness).recordRejected(mapOf(id to DEFINITION))
        verify(indexInitializer).recordWriteFailure()
    }

    @Test
    fun `indexChunk clears the rejection of a document it indexed`() {
        val id = UUID.randomUUID()

        converter.indexChunk(listOf(osDocument(id.toString())))

        verify(completeness).clearRejected(listOf(id))
    }

    @Test
    fun `indexChunk propagates a transport failure instead of rejecting the document`() {
        val document = osDocument("a")
        whenever(operations.save(any<List<JsonSchemaDocumentOsDocument>>(), any<IndexCoordinates>()))
            .thenThrow(BulkFailureException("bulk failed", mapOf("a" to FailureDetails(500, "transient"))))
        whenever(operations.save(eq(document), any<IndexCoordinates>()))
            .thenThrow(DataAccessResourceFailureException("Connection refused"))

        assertThatThrownBy { converter.indexChunk(listOf(document)) }
            .isInstanceOf(DataAccessResourceFailureException::class.java)
    }

    @Test
    fun `indexChunk skips only the documents whose index cannot be created`() {
        val house = osDocument(UUID.randomUUID().toString(), definitionName = "house")
        val person = osDocument(UUID.randomUUID().toString(), definitionName = "person")
        doThrow(RuntimeException("maximum shards open")).whenever(indexInitializer).ensureIndex("house", VERSION_TAG)

        val skipped = converter.indexChunk(listOf(house, person))

        assertThat(skipped).isEqualTo(1L)
        verify(completeness).recordRejected(mapOf(UUID.fromString(house.id) to "house"))
        verify(operations).save(eq(listOf(person)), eq(IndexCoordinates.of(resolver.writeAliasFor("person", VERSION_TAG))))
    }

    @Test
    fun `indexChunk propagates a transport failure while creating an index`() {
        doThrow(DataAccessResourceFailureException("Connection refused")).whenever(indexInitializer).ensureIndex(DEFINITION, VERSION_TAG)

        assertThatThrownBy { converter.indexChunk(listOf(osDocument("a"))) }
            .isInstanceOf(DataAccessResourceFailureException::class.java)
    }

    @Test
    fun `indexChunk removes the copy a document left in its previous version's index`() {
        val document = osDocument("a")
        indexedCopies(document, osDocument("a", versionTag = "0.9.0"))

        converter.indexChunk(listOf(document))

        verify(operations).delete(eq("a"), eq(IndexCoordinates.of(resolver.writeAliasFor(DEFINITION, "0.9.0"))))
        verify(operations, never()).delete(eq("a"), eq(index))
    }

    @Test
    fun `indexable truncates long strings inside objects only`() {
        val long = "x".repeat(40_000)
        val document = osDocument("a").copy(content = mapOf("top" to long, "object" to mapOf("leaf" to long), "list" to listOf(mapOf("leaf" to long))))

        val content = requireNotNull(converter.indexable(document).content)

        assertThat(content["top"]).isEqualTo(long)
        assertThat(((content["object"] as Map<*, *>)["leaf"] as String).toByteArray().size).isLessThanOrEqualTo(16_384)
        assertThat((((content["list"] as List<*>).single() as Map<*, *>)["leaf"] as String)).hasSizeLessThanOrEqualTo(16_384)
    }

    @Test
    fun `indexable does not split a multi-byte character`() {
        val document = osDocument("a").copy(content = mapOf("object" to mapOf("leaf" to "é".repeat(10_000))))

        val leaf = (requireNotNull(converter.indexable(document).content)["object"] as Map<*, *>)["leaf"] as String

        assertThat(leaf).matches("é+")
        assertThat(leaf.toByteArray().size).isLessThanOrEqualTo(16_384)
    }

    private fun indexedCopies(vararg copies: JsonSchemaDocumentOsDocument) {
        val hits: SearchHits<JsonSchemaDocumentOsDocument> = mock()
        val searchHits = copies.map { copy ->
            mock<SearchHit<JsonSchemaDocumentOsDocument>>().also { whenever(it.content).thenReturn(copy) }
        }
        whenever(hits.searchHits).thenReturn(searchHits)
        whenever(operations.search(any<Query>(), eq(JsonSchemaDocumentOsDocument::class.java), any<IndexCoordinates>()))
            .thenReturn(hits)
    }

    private fun osDocument(id: String, definitionName: String = DEFINITION, versionTag: String = VERSION_TAG) = JsonSchemaDocumentOsDocument(
        id = id,
        content = null,
        definitionId = OsDefinitionId(
            name = definitionName,
            version = null,
            blueprintId = OsBlueprintId(
                blueprintType = null, blueprintKey = null, blueprintVersionTag = versionTag,
                isBuildingBlock = null, isCase = null,
            ),
        ),
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
        private const val VERSION_TAG = "1.0.0"
    }
}
