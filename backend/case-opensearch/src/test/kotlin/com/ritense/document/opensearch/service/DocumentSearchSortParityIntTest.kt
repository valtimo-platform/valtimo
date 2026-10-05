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

import com.fasterxml.jackson.core.type.TypeReference
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.case.domain.group.CaseDefinitionGroup
import com.ritense.case.domain.group.CaseDefinitionGroupMember
import com.ritense.case.domain.group.CaseDefinitionGroupMemberId
import com.ritense.case.domain.group.GroupListColumn
import com.ritense.case.domain.group.GroupListColumnId
import com.ritense.case.domain.group.GroupListColumnPathMapping
import com.ritense.case.domain.group.GroupListColumnPathMappingId
import com.ritense.case.repository.CaseDefinitionGroupMemberRepository
import com.ritense.case.repository.CaseDefinitionGroupRepository
import com.ritense.case.repository.GroupListColumnPathMappingRepository
import com.ritense.case.repository.GroupListColumnRepository
import com.ritense.case.service.GroupCaseInstanceService
import com.ritense.case_.authorization.CaseDefinitionActionProvider
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.domain.search.SearchWithConfigRequest
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.service.DocumentSearchService
import com.ritense.document.service.impl.JsonSchemaDocumentSearchService
import com.ritense.search.domain.DisplayType
import com.ritense.search.domain.EmptyDisplayTypeParameter
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valueresolver.ValueResolverService
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.env.Environment
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.context.bean.override.mockito.MockitoBean
import java.time.LocalDateTime
import java.util.UUID

@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class DocumentSearchSortParityIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    @Qualifier("jpaDocumentSearchService")
    lateinit var jpaSearchService: JsonSchemaDocumentSearchService

    @Autowired
    @Qualifier("openSearchDocumentSearchService")
    lateinit var openSearchSearchService: JsonSchemaDocumentOpenSearchService

    @Autowired
    lateinit var converter: JsonSchemaDocumentOsConverter

    @Autowired
    lateinit var documentRepository: JsonSchemaDocumentRepository

    @MockitoBean
    lateinit var valueResolverService: ValueResolverService

    @Autowired
    lateinit var entityManager: EntityManager

    @Autowired
    lateinit var environment: Environment

    @Autowired
    lateinit var groupRepository: CaseDefinitionGroupRepository

    @Autowired
    lateinit var memberRepository: CaseDefinitionGroupMemberRepository

    @Autowired
    lateinit var listColumnRepository: GroupListColumnRepository

    @Autowired
    lateinit var listColumnPathMappingRepository: GroupListColumnPathMappingRepository

    @Autowired
    lateinit var groupCaseInstanceService: GroupCaseInstanceService

    private val isMysql: Boolean
        get() = environment.getProperty("spring.datasource.url").orEmpty().contains("mysql")

    @BeforeEach
    fun seed() {
        val houseStatuses = listOf("started", null, "closed", "suspended", "started", "closed", null, "suspended")
        val personStatuses = listOf("closed", "started", null, "started", "closed", null)
        houseStatuses.forEachIndexed { index, status ->
            seedDocument("house", index, index, status, "Street ${(index * 7) % 10}")
        }
        personStatuses.forEachIndexed { index, status ->
            seedDocument("person", index, houseStatuses.size + index, status, null)
        }
        refreshIndex()
    }

    @Test
    fun `seeded dates do not follow the sequence order`() {
        val byCreatedOn = search(jpaSearchService, true, PageRequest.of(0, 50, Sort.by("case:createdOn")))
        val bySequence = search(
            jpaSearchService,
            true,
            PageRequest.of(0, 50, Sort.by("case:sequence", "case:documentDefinitionId.name"))
        )
        val houses = search(jpaSearchService, false, PageRequest.of(0, 50))

        assertThat(byCreatedOn.map { it.id() }).isNotEqualTo(bySequence.map { it.id() })
        assertThat(houses.count { (it as JsonSchemaDocument).retentionDate().isPresent }).isGreaterThanOrEqualTo(2)
        assertThat(houses.count { (it as JsonSchemaDocument).modifiedOn().isPresent }).isGreaterThanOrEqualTo(2)
    }

    @TestFactory
    fun `sorting yields identical order on JPA and OpenSearch`(): List<DynamicTest> =
        SORT_PROPERTIES.flatMap { property ->
            listOf(Sort.Direction.ASC, Sort.Direction.DESC).flatMap { direction ->
                listOf(true, false).map { multi ->
                    DynamicTest.dynamicTest("$property $direction ${if (multi) "multi" else "single"}") {
                        assertParity(property, direction, multi)
                    }
                }
            }
        }

    @Test
    fun `group search translates column keys and sorts identically on both engines`() {
        val groupKey = createParityGroup()
        val expectedSort = Sort.by(Sort.Order.desc("case:sequence"), Sort.Order.asc("case:documentDefinitionId.name"))
        val expectedIds = search(jpaSearchService, true, PageRequest.of(0, 50, expectedSort)).map { it.id().toString() }

        SearchEngineToggle.Engine.entries.forEach { engine ->
            searchEngineToggle.set(engine)

            val result = groupCaseInstanceService.search(
                groupKey,
                SearchWithConfigRequest(),
                PageRequest.of(0, 50, Sort.by(Sort.Order.desc("created"), Sort.Order.asc("type")))
            )

            assertThat(result.pageable.sort.toList()).describedAs("$engine sort").isEqualTo(expectedSort.toList())
            assertThat(result.content.map { it.id }).describedAs("$engine order").isEqualTo(expectedIds)
        }
    }

    @Test
    fun `group search ignores sorting on non sortable column keys on both engines`() {
        val groupKey = createParityGroup()

        SearchEngineToggle.Engine.entries.forEach { engine ->
            searchEngineToggle.set(engine)

            val unsorted = groupCaseInstanceService.search(groupKey, SearchWithConfigRequest(), PageRequest.of(0, 50))
            val sortedByDocColumn = groupCaseInstanceService.search(
                groupKey,
                SearchWithConfigRequest(),
                PageRequest.of(0, 50, Sort.by("street"))
            )

            assertThat(sortedByDocColumn.pageable.sort.isUnsorted).describedAs("$engine sort").isTrue()
            assertThat(sortedByDocColumn.content.map { it.id })
                .describedAs("$engine order")
                .isEqualTo(unsorted.content.map { it.id })
        }
    }

    @Test
    fun `group search translates the sort of unpaged requests`() {
        val groupKey = createParityGroup()
        val expectedSort = Sort.by(Sort.Order.desc("case:sequence"), Sort.Order.asc("case:documentDefinitionId.name"))
        val expectedIds = search(jpaSearchService, true, PageRequest.of(0, 50, expectedSort)).map { it.id().toString() }

        val result = groupCaseInstanceService.search(
            groupKey,
            SearchWithConfigRequest(),
            Pageable.unpaged(Sort.by(Sort.Order.desc("created"), Sort.Order.asc("type")))
        )

        assertThat(result.content.map { it.id }).isEqualTo(expectedIds)
    }

    private fun createParityGroup(): String {
        val groupKey = "parity_group"
        val role = requireNotNull(roleRepository.findByKey(FULL_ACCESS_ROLE))
        permissionRepository.save(
            Permission(
                UUID.randomUUID(), CaseDefinition::class.java,
                mutableListOf(CaseDefinitionActionProvider.VIEW_LIST), ConditionContainer(emptyList()), role
            )
        )
        val group = groupRepository.save(CaseDefinitionGroup(key = groupKey, title = "Parity", description = null, order = 0))
        listOf("house", "person").forEachIndexed { index, key ->
            memberRepository.save(
                CaseDefinitionGroupMember(CaseDefinitionGroupMemberId(groupKey, key), group, index)
            )
        }
        saveColumn(group, "created", true, "case:sequence")
        saveColumn(group, "type", true, "case:documentDefinitionId.name")
        saveColumn(group, "street", false, "doc:street")
        return groupKey
    }

    private fun saveColumn(group: CaseDefinitionGroup, key: String, sortable: Boolean, path: String): GroupListColumn {
        val column = listColumnRepository.save(
            GroupListColumn(
                id = GroupListColumnId(group.key, key),
                group = group,
                title = key,
                displayType = DisplayType("string", EmptyDisplayTypeParameter()),
                sortable = sortable,
                defaultSort = null,
                order = 0,
                exportable = false
            )
        )
        listOf("house", "person").forEach { definitionKey ->
            listColumnPathMappingRepository.save(
                GroupListColumnPathMapping(
                    id = GroupListColumnPathMappingId(group.key, key, definitionKey),
                    column = column,
                    path = path
                )
            )
        }
        return column
    }

    private fun assertParity(property: String, direction: Sort.Direction, multi: Boolean) {
        val tieBreakers = listOf("case:documentDefinitionId.name", "case:sequence")
            .filter { it != property.takeIf { p -> p.startsWith("case:") } && it.removePrefix("case:") != property }
        val sort = Sort.by(listOf(Sort.Order(direction, property)) + tieBreakers.map { Sort.Order.asc(it) })

        val pages = if (isMysql) listOf(0 to 50) else listOf(0 to 5, 1 to 5)
        pages.forEach { (pageNumber, pageSize) ->
            val pageable = PageRequest.of(pageNumber, pageSize, sort)
            val jpa = search(jpaSearchService, multi, pageable)
            val openSearch = search(openSearchSearchService, multi, pageable)

            if (isMysql) {
                assertThat(openSearch.filter { hasValue(it, property) }.map { it.id() })
                    .describedAs("$property $direction page $pageNumber")
                    .isEqualTo(jpa.filter { hasValue(it, property) }.map { it.id() })
            } else {
                assertThat(openSearch.map { it.id() })
                    .describedAs("$property $direction page $pageNumber")
                    .isEqualTo(jpa.map { it.id() })
            }
        }
    }

    private fun search(
        service: DocumentSearchService,
        multi: Boolean,
        pageable: Pageable
    ): List<Document> =
        if (multi) {
            service.search(
                listOf("house", "person"), BlueprintType.CASE, SearchWithConfigRequest(), emptyMap(), emptyMap(), pageable
            ).content
        } else {
            service.search("house", BlueprintType.CASE, SearchWithConfigRequest(), pageable).content
        }

    private fun hasValue(document: Document, property: String): Boolean {
        val doc = document as JsonSchemaDocument
        return when (property.removePrefix("case:")) {
            "modifiedOn" -> doc.modifiedOn().isPresent
            "retentionDate" -> doc.retentionDate().isPresent
            "assigneeFullName" -> doc.assigneeFullName() != null
            "internalStatus" -> doc.internalStatus() != null
            "doc:street" -> doc.content().asJson().has("street")
            else -> true
        }
    }

    private fun seedDocument(definitionName: String, index: Int, globalIndex: Int, status: String?, street: String?) {
        val content = objectMapper.createObjectNode().apply { street?.let { put("street", it) } }
        val created = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(definitionName, definitionName, "1.0.0", content)
            ).resultingDocument().get()
        }
        if (status != null) {
            runWithoutAuthorization { documentService.setInternalStatus(created.id(), status) }
        }
        if (index % 3 != 0) {
            val assigned = documentRepository.findById(created.id()).orElseThrow()
            assigned.setAssignee("user-$definitionName-$index", "Assignee ${(index * 5) % 9} $definitionName")
            documentRepository.save(assigned)
        }
        setDates(created.id().id, globalIndex)
        val jpaDoc = documentRepository.findById(created.id()).orElseThrow()
        val osContent = objectMapper.convertValue(jpaDoc.content().asJson(), object : TypeReference<Map<String, Any?>>() {})
        openSearchRepository.save(converter.toOsDocument(jpaDoc).copy(content = osContent))
    }

    private fun setDates(documentId: UUID, globalIndex: Int) {
        entityManager.flush()
        entityManager.createQuery(
            "UPDATE JsonSchemaDocument d " +
                "SET d.createdOn = :createdOn, d.modifiedOn = :modifiedOn, d.retentionDate = :retentionDate " +
                "WHERE d.id.id = :id"
        )
            .setParameter("createdOn", BASE_DATE.plusSeconds(((globalIndex * 5) % 14).toLong()))
            .setParameter(
                "modifiedOn",
                if (globalIndex % 4 == 0) null else BASE_DATE.plusHours(1).plusSeconds(((globalIndex * 3) % 14).toLong())
            )
            .setParameter(
                "retentionDate",
                if (globalIndex % 3 == 0) null else BASE_DATE.plusDays(1).plusSeconds(((globalIndex * 11) % 14).toLong())
            )
            .setParameter("id", documentId)
            .executeUpdate()
        entityManager.clear()
    }

    companion object {
        private val BASE_DATE = LocalDateTime.of(2026, 1, 1, 12, 0, 0)

        private val SORT_PROPERTIES = listOf(
            "case:createdOn",
            "case:modifiedOn",
            "case:sequence",
            "case:createdBy",
            "case:assigneeFullName",
            "case:retentionDate",
            "case:internalStatus",
            "internalStatus",
            "sequence",
            "case:documentDefinitionId.name",
            "doc:street"
        )
    }
}
