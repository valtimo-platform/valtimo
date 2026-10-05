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
import com.ritense.case_.authorization.CaseDefinitionActionProvider
import com.ritense.case_.domain.definition.CaseDefinition
import java.util.UUID
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
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.domain.search.SearchWithConfigRequest
import com.ritense.document.opensearch.BaseOpenSearchIntegrationTest
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.search.domain.DisplayType
import com.ritense.search.domain.EmptyDisplayTypeParameter
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valueresolver.ValueResolverService
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assumptions.assumeFalse
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import org.junit.jupiter.api.DynamicTest
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.env.Environment
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.security.test.context.support.WithMockUser

@WithMockUser(username = BaseOpenSearchIntegrationTest.USERNAME, authorities = [BaseOpenSearchIntegrationTest.FULL_ACCESS_ROLE])
class DocumentSearchSortParityIntTest : BaseOpenSearchIntegrationTest() {

    @Autowired
    @Qualifier("jpaDocumentSearchService")
    lateinit var jpaSearchService: com.ritense.document.service.impl.JsonSchemaDocumentSearchService

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
            seedDocument("house", index, status, "Street ${(index * 7) % 10}")
        }
        personStatuses.forEachIndexed { index, status ->
            seedDocument("person", index, status, null)
        }
        refreshIndex()
    }

    @TestFactory
    fun `sorting yields identical order on JPA and OpenSearch`(): List<DynamicTest> =
        SORT_PROPERTIES.flatMap { property ->
            listOf(Sort.Direction.ASC, Sort.Direction.DESC).flatMap { direction ->
                listOf(true, false).map { multi ->
                    DynamicTest.dynamicTest("$property $direction ${if (multi) "multi" else "single"}") {
                        assumeFalse(isMysql && property.removePrefix("case:") in DATE_PROPERTIES, "MySQL dates have lower precision")
                        assertParity(property, direction, multi)
                    }
                }
            }
        }

    @Test
    fun `group search ignores non sortable column keys and sorts identically on both engines`() {
        val groupKey = "parity_group"
        val role = roleRepository.findByKey(FULL_ACCESS_ROLE)!!
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
        saveColumn(group, "street", false, "doc:street")

        val sorted = groupCaseInstanceService.search(
            groupKey,
            SearchWithConfigRequest(),
            PageRequest.of(0, 50, Sort.by(Sort.Order.desc("created"), Sort.Order.asc("street")))
        )
        val unsortedByDoc = groupCaseInstanceService.search(
            groupKey,
            SearchWithConfigRequest(),
            PageRequest.of(0, 50, Sort.by("street"))
        )

        assertThat(sorted.content.map { it.id }).hasSize(14)
        assertThat(unsortedByDoc.content).hasSize(14)
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
        service: com.ritense.document.service.DocumentSearchService,
        multi: Boolean,
        pageable: PageRequest
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

    private fun seedDocument(definitionName: String, index: Int, status: String?, street: String?) {
        val content = objectMapper.createObjectNode().apply { street?.let { put("street", it) } }
        val created = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(definitionName, definitionName, "1.0.0", content)
            ).resultingDocument().get()
        }
        if (status != null) {
            runWithoutAuthorization { documentService.setInternalStatus(created.id(), status) }
        }
        val jpaDoc = documentRepository.findById(created.id()).orElseThrow()
        if (index % 3 != 0) {
            jpaDoc.setAssignee("user-$definitionName-$index", "Assignee ${(index * 5) % 9} $definitionName")
            documentRepository.save(jpaDoc)
        }
        val osContent = objectMapper.convertValue(jpaDoc.content().asJson(), object : TypeReference<Map<String, Any?>>() {})
        openSearchRepository.save(converter.toOsDocument(jpaDoc).copy(content = osContent))
    }

    companion object {
        private val DATE_PROPERTIES = setOf("createdOn", "modifiedOn", "retentionDate")

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
