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

import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.opensearch.OpenSearchProperties
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.opensearch.domain.OsBlueprintId
import com.ritense.document.opensearch.domain.OsDefinitionId
import com.ritense.document.opensearch.repository.OpenSearchReconcileStateRepository
import com.ritense.document.opensearch.repository.PendingIndexDeletionRepository
import jakarta.persistence.EntityManager
import net.javacrumbs.shedlock.core.LockProvider
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.opensearch.data.client.orhlc.NativeSearchQueryBuilder
import org.opensearch.index.query.QueryBuilders
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import org.springframework.transaction.PlatformTransactionManager
import java.util.UUID

/**
 * Verifies that two schema versions of one definition — where a content path is a SCALAR in one version and an
 * OBJECT in another — land in SEPARATE concrete indices (no mapping collision, neither dropped) and both stay
 * searchable through the per-definition read alias: the version-evolution case the per-(key, versionTag) topology
 * exists for.
 */
class DocumentOpenSearchVersionIsolationIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    lateinit var converter: JsonSchemaDocumentOsConverter

    @Autowired
    lateinit var osOperations: ElasticsearchOperations

    @Autowired
    lateinit var stateRepository: OpenSearchReconcileStateRepository

    @Autowired
    lateinit var pendingIndexDeletionRepository: PendingIndexDeletionRepository

    @Autowired
    lateinit var entityManager: EntityManager

    @Autowired
    lateinit var transactionManager: PlatformTransactionManager

    @Autowired
    lateinit var lockProvider: LockProvider

    @Autowired
    lateinit var openSearchProperties: OpenSearchProperties

    // Drop the extra version concretes this test creates so they don't leak into other test classes (the base
    // only clears documents, not indices), then restore the default 1.0.0 index.
    @AfterEach
    fun dropVersionIndices() {
        listOf("1.0.0", "2.0.0").forEach { tag ->
            val alias = indexNameResolver.writeAliasFor("house", tag)
            if (osOperations.indexOps(IndexCoordinates.of(alias)).exists()) {
                concretesBehind(alias).forEach { indexInitializer.dropIndex(it) }
            }
        }
        indexInitializer.ensureIndex("house", "1.0.0")
    }

    @Test
    fun `a scalar in v1 and an object at the same path in v2 index into separate indices and stay queryable`() {
        val v1 = houseDoc(tag = "1.0.0", openzaakgegevens = "scalar-value")
        val v2 = houseDoc(tag = "2.0.0", openzaakgegevens = mapOf("x" to "nested-value"))

        converter.indexChunk(listOf(v1))
        converter.indexChunk(listOf(v2))
        refreshIndex()

        // Both documents indexed, nothing dropped, both visible through the shared read alias.
        assertThat(findIndexedById(v1.id)).`as`("v1 (scalar) indexed").isNotNull()
        assertThat(findIndexedById(v2.id)).`as`("v2 (object) indexed").isNotNull()

        // Each version lives in its own concrete index.
        val v1Concrete = concreteBehind(indexNameResolver.writeAliasFor("house", "1.0.0"))
        val v2Concrete = concreteBehind(indexNameResolver.writeAliasFor("house", "2.0.0"))
        assertThat(v1Concrete).`as`("versions must not share a concrete index").isNotEqualTo(v2Concrete)

        // The per-definition read alias spans both versions' concrete indices.
        assertThat(concretesBehind(indexNameResolver.indexNameFor("house"))).contains(v1Concrete, v2Concrete)

        // Both remain queryable through the per-definition read alias: v1's scalar value (text+keyword) and v2's
        // nested flat_object leaf — matching what Postgres would return for each.
        assertThat(searchIds("content.openzaakgegevens.keyword", "scalar-value"))
            .`as`("v1 scalar queryable").containsExactly(v1.id)
        assertThat(searchIds("content.openzaakgegevens.x", "nested-value"))
            .`as`("v2 nested leaf queryable").containsExactly(v2.id)
    }

    @Test
    fun `reconcile prunes an empty version index but keeps the non-empty one`() {
        // house v1.0.0 holds a document; v2.0.0 is a later, unused (empty) version.
        val v1 = houseDoc(tag = "1.0.0", openzaakgegevens = "value")
        converter.indexChunk(listOf(v1))
        indexInitializer.ensureIndex("house", "2.0.0")
        refreshIndex()
        val v1Concrete = concreteBehind(indexNameResolver.writeAliasFor("house", "1.0.0"))
        val v2WriteAlias = indexNameResolver.writeAliasFor("house", "2.0.0")
        assertThat(osOperations.indexOps(IndexCoordinates.of(v2WriteAlias)).exists()).`as`("precondition: v2 exists").isTrue()

        freshReconcileService().reconcile()
        refreshIndex()

        assertThat(osOperations.indexOps(IndexCoordinates.of(v2WriteAlias)).exists())
            .`as`("empty version index pruned").isFalse()
        assertThat(osOperations.indexOps(IndexCoordinates.of(v1Concrete)).exists())
            .`as`("non-empty version index kept").isTrue()
        assertThat(findIndexedById(v1.id)).`as`("non-empty version still queryable").isNotNull()
    }

    @Test
    fun `reconcile keeps the only (empty) version index of a definition so its read alias survives`() {
        // The base setup provisions a single, empty person 1.0.0 index.
        val personRead = indexNameResolver.indexNameFor("person")
        assertThat(concretesBehind(personRead)).`as`("precondition: one empty concrete").hasSize(1)

        freshReconcileService().reconcile()
        refreshIndex()

        assertThat(osOperations.indexOps(IndexCoordinates.of(personRead)).exists()).`as`("read alias preserved").isTrue()
        assertThat(concretesBehind(personRead)).`as`("last concrete not pruned").hasSize(1)
    }

    private fun freshReconcileService() = DocumentOpenSearchReconcileService(
        entityManager, converter, osOperations, indexNameResolver, stateRepository,
        pendingIndexDeletionRepository, transactionManager, lockProvider, openSearchProperties,
        indexInitializer, indexCompletenessService,
    )

    private fun searchIds(field: String, value: String): List<String> {
        val query = NativeSearchQueryBuilder().withQuery(QueryBuilders.termQuery(field, value)).build()
        return osOperations.search(
            query,
            JsonSchemaDocumentOsDocument::class.java,
            IndexCoordinates.of(indexNameResolver.indexNameFor("house")),
        ).searchHits.map { it.id }
    }

    private fun concreteBehind(alias: String): String = concretesBehind(alias).single()

    private fun concretesBehind(alias: String): List<String> =
        osOperations.indexOps(IndexCoordinates.of(alias)).getAliasesForIndex(alias).keys.toList()

    private fun houseDoc(tag: String, openzaakgegevens: Any): JsonSchemaDocumentOsDocument =
        JsonSchemaDocumentOsDocument(
            id = UUID.randomUUID().toString(),
            content = mapOf("openzaakgegevens" to openzaakgegevens),
            definitionId = OsDefinitionId(
                name = "house",
                version = null,
                blueprintId = OsBlueprintId(
                    blueprintType = "CASE",
                    blueprintKey = null,
                    blueprintVersionTag = tag,
                    isBuildingBlock = null,
                    isCase = null,
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
            contentText = null,
        )
}
