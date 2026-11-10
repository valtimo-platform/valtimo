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

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.condition.ExpressionPermissionCondition
import com.ritense.authorization.permission.condition.PermissionConditionOperator.GREATER_THAN
import com.ritense.authorization.role.Role
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.domain.search.AdvancedSearchRequest
import com.ritense.document.domain.search.DatabaseSearchType
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.service.DocumentSearchService
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.document.service.impl.JsonSchemaDocumentSearchService
import com.ritense.valtimo.contract.blueprint.BlueprintType
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.SoftAssertions.assertSoftly
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.spy
import org.mockito.kotlin.whenever
import org.opensearch.data.client.orhlc.NativeSearchQueryBuilder
import org.opensearch.index.query.QueryBuilders
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.dao.DataAccessResourceFailureException
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.PlatformTransactionManager
import java.net.ConnectException
import java.util.UUID

/**
 * Reproduction tests for the BLOCKER findings (F1–F4) of the second per-definition OpenSearch review.
 *
 * Every test asserts the CORRECT behaviour, so a red test confirms the finding and a green test refutes it. Cases
 * are seeded on `person` (its schema allows nested objects) in both PostgreSQL and OpenSearch, so the JPA search
 * service is the oracle: a finding only counts as real when the JPA control returns the expected result.
 */
@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class DocumentOpenSearchBlockerReproIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    @Qualifier("jpaDocumentSearchService")
    lateinit var jpaSearchService: JsonSchemaDocumentSearchService

    @Autowired
    @Qualifier("openSearchDocumentSearchService")
    lateinit var openSearchSearchService: JsonSchemaDocumentOpenSearchService

    @Autowired
    lateinit var converter: JsonSchemaDocumentOsConverter

    @Autowired
    lateinit var reindexProgressGate: ReindexProgressGate

    @Autowired
    lateinit var documentRepository: JsonSchemaDocumentRepository

    @Autowired
    lateinit var transactionManager: PlatformTransactionManager

    @AfterEach
    fun cleanUp() {
        searchEngineToggle.deactivateFallback()
        val newVersionAlias = indexNameResolver.writeAliasFor("person", NEW_VERSION_TAG)
        if (elasticsearchOperations.indexOps(IndexCoordinates.of(newVersionAlias)).exists()) {
            elasticsearchOperations.indexOps(IndexCoordinates.of(newVersionAlias)).getAliasesForIndex(newVersionAlias).keys
                .forEach { indexInitializer.dropIndex(it) }
        }
    }

    // ---------------------------------------------------------------- F1

    @Test
    fun `F1a control - an equal filter on a top-level field matches on both engines`() {
        val rotterdam = seedPerson("Alice", plaats = "Rotterdam")
        seedPerson("Bob", plaats = "Utrecht")
        val request = AdvancedSearchRequest().addOtherFilters(equalFilter("doc:firstName", "Alice"))

        assertThat(searchIds(jpaSearchService, request)).`as`("CONTROL JPA").containsExactly(rotterdam.id().toString())
        assertThat(searchIds(openSearchSearchService, request)).`as`("CONTROL OpenSearch").containsExactly(rotterdam.id().toString())
    }

    @Test
    fun `F1a an equal filter on a field nested inside an object matches like PostgreSQL`() {
        val rotterdam = seedPerson("Alice", plaats = "Rotterdam")
        seedPerson("Bob", plaats = "Utrecht")
        val request = AdvancedSearchRequest().addOtherFilters(equalFilter("doc:adres.plaats", "Rotterdam"))

        assertThat(searchIds(jpaSearchService, request)).`as`("precondition JPA").containsExactly(rotterdam.id().toString())
        assertThat(searchIds(openSearchSearchService, request))
            .`as`("F1a: OpenSearch equal filter on nested doc:adres.plaats")
            .containsExactly(rotterdam.id().toString())
    }

    @Test
    fun `F1b control - a like filter on a top-level field matches on both engines`() {
        val alice = seedPerson("Alice", plaats = "Rotterdam")
        seedPerson("Bob", plaats = "Utrecht")
        val request = AdvancedSearchRequest().addOtherFilters(likeFilter("doc:firstName", "lic"))

        assertThat(searchIds(jpaSearchService, request)).`as`("CONTROL JPA").containsExactly(alice.id().toString())
        assertThat(searchIds(openSearchSearchService, request)).`as`("CONTROL OpenSearch").containsExactly(alice.id().toString())
    }

    @Test
    fun `F1b a like filter on a field nested inside an object matches like PostgreSQL`() {
        val rotterdam = seedPerson("Alice", plaats = "Rotterdam")
        seedPerson("Bob", plaats = "Utrecht")
        val request = AdvancedSearchRequest().addOtherFilters(likeFilter("doc:adres.plaats", "otter"))

        assertThat(searchIds(jpaSearchService, request)).`as`("precondition JPA").containsExactly(rotterdam.id().toString())
        assertThat(searchIds(openSearchSearchService, request))
            .`as`("F1b: OpenSearch like filter on nested doc:adres.plaats")
            .containsExactly(rotterdam.id().toString())
    }

    @Test
    fun `F1c control - sorting on a top-level field orders like PostgreSQL`() {
        val expected = listOf(seedPerson("Carol", "Utrecht"), seedPerson("Alice", "Rotterdam"), seedPerson("Bob", "Amsterdam"))
            .sortedBy { it.content().asJson().get("firstName").asText() }.map { it.id().toString() }
        val pageable = PageRequest.of(0, 10, Sort.by(Sort.Direction.ASC, "doc:firstName"))

        assertThat(searchIds(jpaSearchService, AdvancedSearchRequest(), pageable)).`as`("CONTROL JPA").isEqualTo(expected)
        assertThat(searchIds(openSearchSearchService, AdvancedSearchRequest(), pageable)).`as`("CONTROL OpenSearch").isEqualTo(expected)
    }

    @Test
    fun `F1c sorting on a field nested inside an object orders like PostgreSQL`() {
        val seeded = listOf(seedPerson("Carol", "Utrecht"), seedPerson("Alice", "Rotterdam"), seedPerson("Bob", "Amsterdam"))
        val expected = seeded.sortedBy { it.content().asJson().at("/adres/plaats").asText() }.map { it.id().toString() }
        val pageable = PageRequest.of(0, 10, Sort.by(Sort.Direction.ASC, "doc:adres.plaats"))

        assertThat(searchIds(jpaSearchService, AdvancedSearchRequest(), pageable)).`as`("precondition JPA").isEqualTo(expected)
        val result = runCatching { searchIds(openSearchSearchService, AdvancedSearchRequest(), pageable) }
        assertThat(result.exceptionOrNull())
            .`as`("F1c: OpenSearch sort on nested doc:adres.plaats threw: ${result.exceptionOrNull()?.message}")
            .isNull()
        assertThat(result.getOrNull()).`as`("F1c: OpenSearch order on nested doc:adres.plaats").isEqualTo(expected)
    }

    // ---------------------------------------------------------------- F2

    @Test
    @WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [RANGE_ROLE])
    fun `F2a control - a range permission on a top-level number filters like PostgreSQL`() {
        seedPerson("Young", plaats = "Utrecht", age = 5)
        val old = seedPerson("Old", plaats = "Utrecht", age = 40)
        setUpRangePermission(path = "$.age", value = 30)

        assertThat(searchIds(jpaSearchService)).`as`("CONTROL JPA").containsExactly(old.id().toString())
        assertThat(searchIds(openSearchSearchService)).`as`("CONTROL OpenSearch").containsExactly(old.id().toString())
    }

    @Test
    @WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [RANGE_ROLE])
    fun `F2a a range permission on a number nested inside an object must not show cases below the bound`() {
        seedPerson("Small", plaats = "Utrecht", bedrag = 200)
        val large = seedPerson("Large", plaats = "Utrecht", bedrag = 2000)
        setUpRangePermission(path = "$.lening.bedrag", value = 1000)

        assertThat(searchIds(jpaSearchService)).`as`("precondition JPA").containsExactly(large.id().toString())
        assertThat(searchIds(openSearchSearchService))
            .`as`("F2a: OpenSearch with permission lening.bedrag > 1000 (amounts 200 and 2000)")
            .containsExactly(large.id().toString())
    }

    @Test
    fun `F2b control - a range filter on a top-level number matches like PostgreSQL`() {
        seedPerson("Young", plaats = "Utrecht", age = 5)
        val old = seedPerson("Old", plaats = "Utrecht", age = 40)
        val request = AdvancedSearchRequest().addOtherFilters(gteFilter("doc:age", 30))

        assertThat(searchIds(jpaSearchService, request)).`as`("CONTROL JPA").containsExactly(old.id().toString())
        assertThat(searchIds(openSearchSearchService, request)).`as`("CONTROL OpenSearch").containsExactly(old.id().toString())
    }

    @Test
    fun `F2b a range filter on a number nested inside an object must not match values below the bound`() {
        seedPerson("Small", plaats = "Utrecht", bedrag = 200)
        val large = seedPerson("Large", plaats = "Utrecht", bedrag = 2000)
        val request = AdvancedSearchRequest().addOtherFilters(gteFilter("doc:lening.bedrag", 1000))

        assertThat(searchIds(jpaSearchService, request)).`as`("precondition JPA").containsExactly(large.id().toString())
        assertThat(searchIds(openSearchSearchService, request))
            .`as`("F2b: OpenSearch filter lening.bedrag >= 1000 (amounts 200 and 2000)")
            .containsExactly(large.id().toString())
    }

    // ---------------------------------------------------------------- F3

    @Test
    fun `F3 control - an unreachable OpenSearch search falls back to PostgreSQL`() {
        val person = seedPerson("Alice", plaats = "Rotterdam")
        val delegating = delegatingSearchService(TopologyGate(indexInitializer))

        assertThat(searchIds(delegating)).`as`("CONTROL: fallback to PostgreSQL").containsExactly(person.id().toString())
    }

    @Test
    fun `F3 an unreachable OpenSearch must fall back to PostgreSQL instead of failing every search`() {
        val person = seedPerson("Alice", plaats = "Rotterdam")
        val unreachableInitializer = spy(indexInitializer)
        doThrow(connectionRefused()).whenever(unreachableInitializer).isLegacyOrStale()
        val delegating = delegatingSearchService(TopologyGate(unreachableInitializer))

        val first = runCatching { searchIds(delegating) }
        val second = runCatching { searchIds(delegating) }

        assertSoftly { soft ->
            soft.assertThat(first.exceptionOrNull())
                .`as`("F3: first search during an outage threw: ${first.exceptionOrNull()}").isNull()
            soft.assertThat(second.exceptionOrNull())
                .`as`("F3: search after the fallback activated still threw: ${second.exceptionOrNull()}").isNull()
            soft.assertThat(first.getOrNull()).`as`("F3: results from PostgreSQL").containsExactly(person.id().toString())
        }
    }

    // ---------------------------------------------------------------- F4

    @Test
    fun `F4 control - re-indexing a case on the same version keeps one up-to-date copy`() {
        val result = reindexAfterContentChange(newVersionTag = TEST_VERSION_TAG)

        assertThat(result.hitsForId).`as`("CONTROL: copies").isEqualTo(1)
        assertThat(result.oldValueMatches).`as`("CONTROL: stale value matches").isEmpty()
        assertThat(result.copiesAfterDelete).`as`("CONTROL: copies after delete").isZero()
    }

    @Test
    fun `F4 a case that changes definition version must not keep a stale copy in the old version index`() {
        val result = reindexAfterContentChange(newVersionTag = NEW_VERSION_TAG)

        assertSoftly { soft ->
            soft.assertThat(result.listedIds.count { it == result.id })
                .`as`("F4: times the case appears in the case list (${result.listedIds})").isEqualTo(1)
            soft.assertThat(result.totalElements).`as`("F4: total in the case list").isEqualTo(1L)
            soft.assertThat(result.oldValueMatches)
                .`as`("F4: a filter on the pre-migration value still finds the case").isEmpty()
            soft.assertThat(result.copiesAfterDelete).`as`("F4: copies left in OpenSearch after delete").isZero()
        }
    }

    private data class VersionChangeResult(
        val id: String,
        val hitsForId: Int,
        val listedIds: List<String>,
        val totalElements: Long,
        val oldValueMatches: List<String>,
        val copiesAfterDelete: Int,
    )

    private fun reindexAfterContentChange(newVersionTag: String): VersionChangeResult {
        val person = seedPerson("Old", plaats = "Utrecht")
        val id = person.id().toString()

        // The re-indexed copy carries the new content, a bumped document version (as a real change does, so
        // OpenSearch's external versioning accepts it) and, for a migration, the new version tag.
        val migratingConverter = spy(converter)
        doAnswer { invocation ->
            val osDocument = invocation.callRealMethod() as JsonSchemaDocumentOsDocument
            val definitionId = requireNotNull(osDocument.definitionId)
            val blueprintId = requireNotNull(definitionId.blueprintId)
            osDocument.copy(
                content = mapOf("firstName" to "New", "adres" to mapOf("plaats" to "Utrecht")),
                indexVersion = (osDocument.indexVersion ?: 1L) + 1,
                definitionId = definitionId.copy(blueprintId = blueprintId.copy(blueprintVersionTag = newVersionTag)),
            )
        }.whenever(migratingConverter).toOsDocument(any())
        val sync = DocumentOpenSearchSyncService(
            elasticsearchOperations, documentRepository, migratingConverter, indexNameResolver, indexInitializer, transactionManager,
        )

        sync.upsertById(UUID.fromString(id))
        refreshIndex()

        val page = openSearchSearchService.search("person", BlueprintType.CASE, AdvancedSearchRequest(), PageRequest.of(0, 50))
        val hitsForId = copiesInOpenSearch(id)
        val oldValueMatches = searchIds(openSearchSearchService, AdvancedSearchRequest().addOtherFilters(equalFilter("doc:firstName", "Old")))

        sync.delete(UUID.fromString(id))
        refreshIndex()

        return VersionChangeResult(
            id = id,
            hitsForId = hitsForId,
            listedIds = page.content.map { it.id().toString() },
            totalElements = page.totalElements,
            oldValueMatches = oldValueMatches,
            copiesAfterDelete = copiesInOpenSearch(id),
        )
    }

    private fun copiesInOpenSearch(id: String): Int =
        elasticsearchOperations.search(
            NativeSearchQueryBuilder().withQuery(QueryBuilders.idsQuery().addIds(id)).build(),
            JsonSchemaDocumentOsDocument::class.java,
            IndexCoordinates.of(OpenSearchIndexNameResolver.READ_ALIAS),
        ).searchHits.size

    // ---------------------------------------------------------------- helpers

    private fun delegatingSearchService(topologyGate: TopologyGate): DelegatingDocumentSearchService {
        searchEngineToggle.set(SearchEngineToggle.Engine.OPENSEARCH)
        val unreachableOpenSearch = mock<DocumentSearchService>(defaultAnswer = { throw connectionRefused() })
        return DelegatingDocumentSearchService(
            unreachableOpenSearch, jpaSearchService, searchEngineToggle, reindexProgressGate, topologyGate,
        )
    }

    // What spring-data-opensearch throws when the cluster refuses the connection.
    private fun connectionRefused() =
        DataAccessResourceFailureException("Connection refused", ConnectException("Connection refused"))

    private fun searchIds(
        service: DocumentSearchService,
        request: AdvancedSearchRequest = AdvancedSearchRequest(),
        pageable: PageRequest = PageRequest.of(0, 50),
    ): List<String> = service.search("person", BlueprintType.CASE, request, pageable).content.map { it.id().toString() }

    private fun equalFilter(path: String, value: String) =
        AdvancedSearchRequest.OtherFilter().path(path).searchType(DatabaseSearchType.EQUAL).addValue(value)

    private fun likeFilter(path: String, value: String) =
        AdvancedSearchRequest.OtherFilter().path(path).searchType(DatabaseSearchType.LIKE).addValue(value)

    private fun gteFilter(path: String, value: Int) =
        AdvancedSearchRequest.OtherFilter().path(path).searchType(DatabaseSearchType.GREATER_THAN_OR_EQUAL_TO).rangeFrom(value)

    private fun setUpRangePermission(path: String, value: Int) {
        permissionRepository.deleteAll()
        val role = roleRepository.findByKey(RANGE_ROLE) ?: roleRepository.save(Role(UUID.randomUUID(), RANGE_ROLE))
        permissionRepository.save(
            Permission(
                UUID.randomUUID(),
                JsonSchemaDocument::class.java,
                mutableListOf(JsonSchemaDocumentActionProvider.VIEW_LIST),
                ConditionContainer(listOf(ExpressionPermissionCondition("content", path, GREATER_THAN, value, Int::class.java))),
                role,
            )
        )
    }

    private fun seedPerson(firstName: String, plaats: String, age: Int? = null, bedrag: Int? = null): JsonSchemaDocument {
        val content = objectMapper.createObjectNode().apply {
            put("firstName", firstName)
            set<ObjectNode>("adres", objectMapper.createObjectNode().put("plaats", plaats))
            age?.let { put("age", it) }
            bedrag?.let { set<ObjectNode>("lening", objectMapper.createObjectNode().put("bedrag", it)) }
        }
        val document = runWithoutAuthorization {
            documentService.createDocument(NewDocumentRequest("person", "person", "1.0.0", content)).resultingDocument().get()
        }
        @Suppress("UNCHECKED_CAST")
        val osContent = objectMapper.convertValue(content, Map::class.java) as Map<String, Any?>
        indexOsDocument(converter.toOsDocument(document).copy(content = osContent))
        refreshIndex()
        return document
    }

    companion object {
        const val RANGE_ROLE = "range-permission-test-role"
        private const val NEW_VERSION_TAG = "2.0.0"
    }
}
