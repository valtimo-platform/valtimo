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
import com.ritense.document.domain.search.AdvancedSearchRequest
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.opensearch.domain.ReindexRunStatus
import com.ritense.valtimo.contract.blueprint.BlueprintType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.domain.PageRequest
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.util.UUID

@Transactional(propagation = Propagation.NOT_SUPPORTED)
@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class DocumentOpenSearchLifecycleIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    @Qualifier("openSearchDocumentSearchService")
    lateinit var openSearchSearchService: JsonSchemaDocumentOpenSearchService

    @Autowired
    lateinit var reindexService: DocumentOpenSearchReindexService

    @Autowired
    lateinit var reindexRunService: OpenSearchReindexRunService

    @Autowired
    lateinit var converter: JsonSchemaDocumentOsConverter

    private val createdIndices = mutableListOf<String>()

    @AfterEach
    fun cleanUp() {
        runWithoutAuthorization { documentService.removeDocuments("house") }
        createdIndices.forEach { indexInitializer.dropIndex(it) }
        TEST_DEFINITION_KEYS.forEach { key ->
            val alias = indexNameResolver.indexNameFor(key)
            if (indexExists(alias)) {
                elasticsearchOperations.indexOps(IndexCoordinates.of(alias)).getAliasesForIndex(alias).keys
                    .forEach { indexInitializer.dropIndex(it) }
            }
            indexInitializer.ensureIndex(key, TEST_VERSION_TAG)
        }
    }

    @Test
    fun `searching a definition that has no index yet returns an empty page`() {
        val request = AdvancedSearchRequest()

        val page = openSearchSearchService.search("no-index-yet", BlueprintType.CASE, request, PageRequest.of(0, 10))
        val count = openSearchSearchService.count("no-index-yet", BlueprintType.CASE, request)

        assertThat(page.content).isEmpty()
        assertThat(count).isZero()
    }

    @Test
    fun `an orphaned index left behind by an interrupted rebuild is dropped once it is old enough`() {
        val orphan = createIndex("${indexNameResolver.writeAliasFor("house", TEST_VERSION_TAG)}_1000")

        indexInitializer.dropOrphanedIndices()
        assertThat(indexExists(orphan)).`as`("an index created moments ago may still be getting its aliases").isTrue()

        indexInitializer.dropOrphanedIndices(minAge = Duration.ZERO)
        assertThat(indexExists(orphan)).`as`("orphan").isFalse()
        assertThat(indexExists(indexNameResolver.writeAliasFor("house", TEST_VERSION_TAG))).`as`("live index").isTrue()
    }

    @Test
    fun `the legacy index is never treated as an orphan`() {
        val legacy = createIndex(OpenSearchIndexNameResolver.LEGACY_INDEX)

        indexInitializer.dropOrphanedIndices(minAge = Duration.ZERO)

        assertThat(indexExists(legacy)).isTrue()
    }

    @Test
    fun `an unscoped recreate on a migrated cluster rebuilds every index and drops cases that no longer exist`() {
        val kept = createHouseDocument("kept")
        val orphan = converter.toOsDocument(createHouseDocument("orphan")).copy(id = UUID.randomUUID().toString())
        indexOsDocument(orphan)
        refreshIndex()
        val houseWriteAlias = indexNameResolver.writeAliasFor("house", TEST_VERSION_TAG)
        val before = concreteBehind(houseWriteAlias)

        val run = reindexRunService.startOrResume(ReindexRequest(recreateIndex = true))
        reindexService.reindex(run.id)
        refreshIndex()

        assertThat(reindexRunService.toStatusMap(run.id)["status"]).isEqualTo(ReindexRunStatus.COMPLETED)
        assertThat(concreteBehind(houseWriteAlias)).`as`("house index rebuilt").isNotEqualTo(before)
        assertThat(indexExists(before)).`as`("replaced index dropped").isFalse()
        assertThat(findIndexedById(kept.id().id.toString())).`as`("existing case").isNotNull()
        assertThat(findIndexedById(orphan.id)).`as`("case missing from the database").isNull()
    }

    private fun createIndex(name: String): String {
        elasticsearchOperations.indexOps(IndexCoordinates.of(name)).create()
        createdIndices += name
        return name
    }

    private fun concreteBehind(alias: String): String =
        elasticsearchOperations.indexOps(IndexCoordinates.of(alias)).getAliasesForIndex(alias).keys.single()

    private fun indexExists(name: String): Boolean = elasticsearchOperations.indexOps(IndexCoordinates.of(name)).exists()

    private fun createHouseDocument(street: String): JsonSchemaDocument =
        runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest("house", "house", "1.0.0", objectMapper.createObjectNode().put("street", street))
            ).resultingDocument().get()
        }
}
