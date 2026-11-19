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

package com.ritense.case.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case.domain.group.CaseDefinitionGroup
import com.ritense.case.domain.group.CaseDefinitionGroupMember
import com.ritense.case.domain.group.CaseDefinitionGroupMemberId
import com.ritense.case.domain.group.GroupListColumn
import com.ritense.case.domain.group.GroupListColumnId
import com.ritense.case.domain.group.GroupListColumnPathMapping
import com.ritense.case.domain.group.GroupListColumnPathMappingId
import com.ritense.case.domain.group.GroupSearchField
import com.ritense.case.domain.group.GroupSearchFieldPathMapping
import com.ritense.case.domain.group.GroupSearchFieldPathMappingId
import com.ritense.case.repository.CaseDefinitionGroupMemberRepository
import com.ritense.case.repository.CaseDefinitionGroupRepository
import com.ritense.case.repository.GroupListColumnPathMappingRepository
import com.ritense.case.repository.GroupListColumnRepository
import com.ritense.case.repository.GroupSearchFieldPathMappingRepository
import com.ritense.case.repository.GroupSearchFieldRepository
import com.ritense.exporter.request.CaseDefinitionGroupExportRequest
import com.ritense.search.domain.DataType
import com.ritense.search.domain.DisplayType
import com.ritense.search.domain.EmptyDisplayTypeParameter
import com.ritense.search.domain.FieldType
import com.ritense.search.domain.SearchFieldMatchType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.skyscreamer.jsonassert.JSONAssert
import org.skyscreamer.jsonassert.JSONCompareMode
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
class CaseDefinitionGroupExporterIntTest @Autowired constructor(
    private val objectMapper: ObjectMapper,
    private val exporter: CaseDefinitionGroupExporter,
    private val groupRepository: CaseDefinitionGroupRepository,
    private val memberRepository: CaseDefinitionGroupMemberRepository,
    private val listColumnRepository: GroupListColumnRepository,
    private val listColumnPathMappingRepository: GroupListColumnPathMappingRepository,
    private val groupSearchFieldRepository: GroupSearchFieldRepository,
    private val searchFieldPathMappingRepository: GroupSearchFieldPathMappingRepository,
) : BaseIntegrationTest() {

    private val testGroupKey = "test-export-group"
    private val testCaseDefKey = "some-case-type"

    @BeforeEach
    fun setUp() {
        cleanUpTestData()
    }

    @AfterEach
    fun tearDown() {
        cleanUpTestData()
    }

    private fun cleanUpTestData() {
        searchFieldPathMappingRepository.deleteAll(
            groupSearchFieldRepository.findByGroupKeyOrderByOrderAsc(testGroupKey)
                .flatMap { searchFieldPathMappingRepository.findByIdGroupSearchFieldId(it.id) }
        )
        groupSearchFieldRepository.deleteByGroupKey(testGroupKey)
        listColumnPathMappingRepository.deleteByIdGroupKey(testGroupKey)
        listColumnRepository.deleteByIdGroupKey(testGroupKey)
        memberRepository.deleteByIdGroupKey(testGroupKey)
        groupRepository.deleteById(testGroupKey)
    }

    @Test
    fun `should export group with all data`(): Unit = runWithoutAuthorization {
        val group = createTestGroup()
        val member = createTestMember(group)
        val listColumn = createTestListColumn(group)
        val listColumnMapping = createTestListColumnPathMapping(listColumn)
        val searchField = createTestSearchField(group)
        val searchFieldMapping = createTestSearchFieldPathMapping(searchField)

        val request = CaseDefinitionGroupExportRequest(testGroupKey)
        val exportResult = exporter.export(request)

        assertThat(exportResult.exportFiles).hasSize(1)
        val exportFile = exportResult.exportFiles.first()

        val exportJson = objectMapper.readTree(exportFile.content)
        assertThat(exportJson.get("key").asText()).isEqualTo(testGroupKey)
        assertThat(exportJson.get("title").asText()).isEqualTo("Test Export Group")
        assertThat(exportJson.get("description").asText()).isEqualTo("Test description")
        assertThat(exportJson.get("order").asInt()).isEqualTo(1)
        assertThat(exportJson.get("color").asText()).isEqualTo("#FF0000")

        val membersJson = exportJson.get("members")
        assertThat(membersJson).hasSize(1)
        assertThat(membersJson[0].get("caseDefinitionKey").asText()).isEqualTo(testCaseDefKey)
        assertThat(membersJson[0].get("order").asInt()).isEqualTo(0)

        val listColumnsJson = exportJson.get("listColumns")
        assertThat(listColumnsJson).hasSize(1)
        assertThat(listColumnsJson[0].get("key").asText()).isEqualTo("status-column")
        assertThat(listColumnsJson[0].get("title").asText()).isEqualTo("Status")
        assertThat(listColumnsJson[0].get("pathMappings")).hasSize(1)
        assertThat(listColumnsJson[0].get("pathMappings")[0].get("caseDefinitionKey").asText()).isEqualTo(testCaseDefKey)
        assertThat(listColumnsJson[0].get("pathMappings")[0].get("path").asText()).isEqualTo("doc:status")

        val searchFieldsJson = exportJson.get("searchFields")
        assertThat(searchFieldsJson).hasSize(1)
        assertThat(searchFieldsJson[0].get("key").asText()).isEqualTo("name-field")
        assertThat(searchFieldsJson[0].get("title").asText()).isEqualTo("Name")
        assertThat(searchFieldsJson[0].get("pathMappings")).hasSize(1)
        assertThat(searchFieldsJson[0].get("pathMappings")[0].get("caseDefinitionKey").asText()).isEqualTo(testCaseDefKey)
        assertThat(searchFieldsJson[0].get("pathMappings")[0].get("path").asText()).isEqualTo("doc:name")
    }

    @Test
    fun `should export group with correct file path`(): Unit = runWithoutAuthorization {
        createTestGroup()

        val request = CaseDefinitionGroupExportRequest(testGroupKey)
        val exportResult = exporter.export(request)

        assertThat(exportResult.exportFiles).hasSize(1)
        val exportFile = exportResult.exportFiles.first()
        assertThat(exportFile.path).isEqualTo("config/global/case-group/$testGroupKey/$testGroupKey.case-group.json")
    }

    @Test
    fun `should not include related export requests`(): Unit = runWithoutAuthorization {
        createTestGroup()

        val request = CaseDefinitionGroupExportRequest(testGroupKey)
        val exportResult = exporter.export(request)

        assertThat(exportResult.relatedRequests).isEmpty()
    }

    private fun createTestGroup(): CaseDefinitionGroup {
        return groupRepository.save(
            CaseDefinitionGroup(
                key = testGroupKey,
                title = "Test Export Group",
                description = "Test description",
                order = 1,
                color = "#FF0000"
            )
        )
    }

    private fun createTestMember(group: CaseDefinitionGroup): CaseDefinitionGroupMember {
        return memberRepository.save(
            CaseDefinitionGroupMember(
                id = CaseDefinitionGroupMemberId(testGroupKey, testCaseDefKey),
                group = group,
                order = 0
            )
        )
    }

    private fun createTestListColumn(group: CaseDefinitionGroup): GroupListColumn {
        return listColumnRepository.save(
            GroupListColumn(
                id = GroupListColumnId(testGroupKey, "status-column"),
                group = group,
                title = "Status",
                displayType = DisplayType("text", EmptyDisplayTypeParameter()),
                sortable = true,
                defaultSort = null,
                order = 0,
                exportable = true
            )
        )
    }

    private fun createTestListColumnPathMapping(column: GroupListColumn): GroupListColumnPathMapping {
        return listColumnPathMappingRepository.save(
            GroupListColumnPathMapping(
                id = GroupListColumnPathMappingId(testGroupKey, "status-column", testCaseDefKey),
                column = column,
                path = "doc:status"
            )
        )
    }

    private fun createTestSearchField(group: CaseDefinitionGroup): GroupSearchField {
        return groupSearchFieldRepository.save(
            GroupSearchField(
                id = UUID.randomUUID(),
                groupKey = testGroupKey,
                group = group,
                key = "name-field",
                title = "Name",
                dataType = DataType.TEXT,
                fieldType = FieldType.SINGLE,
                matchType = SearchFieldMatchType.LIKE,
                dropdownDataProvider = null,
                order = 0
            )
        )
    }

    private fun createTestSearchFieldPathMapping(searchField: GroupSearchField): GroupSearchFieldPathMapping {
        return searchFieldPathMappingRepository.save(
            GroupSearchFieldPathMapping(
                id = GroupSearchFieldPathMappingId(searchField.id, testCaseDefKey),
                searchField = searchField,
                path = "doc:name"
            )
        )
    }
}
