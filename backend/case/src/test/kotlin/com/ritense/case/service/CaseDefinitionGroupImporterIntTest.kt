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
import com.ritense.case.repository.CaseDefinitionGroupMemberRepository
import com.ritense.case.repository.CaseDefinitionGroupRepository
import com.ritense.case.repository.GroupListColumnPathMappingRepository
import com.ritense.case.repository.GroupListColumnRepository
import com.ritense.case.repository.GroupSearchFieldPathMappingRepository
import com.ritense.case.repository.GroupSearchFieldRepository
import com.ritense.importer.ImportRequest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

@Transactional
class CaseDefinitionGroupImporterIntTest @Autowired constructor(
    private val objectMapper: ObjectMapper,
    private val importer: CaseDefinitionGroupImporter,
    private val groupRepository: CaseDefinitionGroupRepository,
    private val memberRepository: CaseDefinitionGroupMemberRepository,
    private val listColumnRepository: GroupListColumnRepository,
    private val listColumnPathMappingRepository: GroupListColumnPathMappingRepository,
    private val groupSearchFieldRepository: GroupSearchFieldRepository,
    private val searchFieldPathMappingRepository: GroupSearchFieldPathMappingRepository,
) : BaseIntegrationTest() {

    private val testGroupKey = "test-import-group"
    private val existingCaseDefKey = "some-case-type"

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
    fun `should import group to database`() {
        val json = """
            {
                "key": "$testGroupKey",
                "title": "Test Import Group",
                "description": "Test description",
                "order": 5,
                "color": "#00FF00",
                "members": [
                    {"caseDefinitionKey": "$existingCaseDefKey", "order": 0}
                ],
                "listColumns": [
                    {
                        "key": "status-column",
                        "title": "Status",
                        "displayType": {"type": "text", "displayTypeParameters": {}},
                        "sortable": true,
                        "defaultSort": null,
                        "order": 0,
                        "exportable": true,
                        "pathMappings": [
                            {"caseDefinitionKey": "$existingCaseDefKey", "path": "doc:status"}
                        ]
                    }
                ],
                "searchFields": [
                    {
                        "key": "name-field",
                        "title": "Name",
                        "dataType": "TEXT",
                        "fieldType": "SINGLE",
                        "matchType": "LIKE",
                        "dropdownDataProvider": null,
                        "order": 0,
                        "pathMappings": [
                            {"caseDefinitionKey": "$existingCaseDefKey", "path": "doc:name"}
                        ]
                    }
                ]
            }
        """.trimIndent()

        importer.import(createImportRequest(json))

        val group = groupRepository.findById(testGroupKey).orElseThrow()
        assertThat(group.title).isEqualTo("Test Import Group")
        assertThat(group.description).isEqualTo("Test description")
        assertThat(group.order).isEqualTo(5)
        assertThat(group.color).isEqualTo("#00FF00")

        val members = memberRepository.findByIdGroupKeyOrderByOrderAsc(testGroupKey)
        assertThat(members).hasSize(1)
        assertThat(members[0].id.caseDefinitionKey).isEqualTo(existingCaseDefKey)

        val listColumns = listColumnRepository.findByIdGroupKeyOrderByOrderAsc(testGroupKey)
        assertThat(listColumns).hasSize(1)
        assertThat(listColumns[0].id.columnKey).isEqualTo("status-column")

        val columnMappings = listColumnPathMappingRepository.findByIdGroupKey(testGroupKey)
        assertThat(columnMappings).hasSize(1)
        assertThat(columnMappings[0].id.caseDefinitionKey).isEqualTo(existingCaseDefKey)
        assertThat(columnMappings[0].path).isEqualTo("doc:status")

        val searchFields = groupSearchFieldRepository.findByGroupKeyOrderByOrderAsc(testGroupKey)
        assertThat(searchFields).hasSize(1)
        assertThat(searchFields[0].key).isEqualTo("name-field")

        val fieldMappings = searchFieldPathMappingRepository.findByIdGroupSearchFieldId(searchFields[0].id)
        assertThat(fieldMappings).hasSize(1)
        assertThat(fieldMappings[0].id.caseDefinitionKey).isEqualTo(existingCaseDefKey)
        assertThat(fieldMappings[0].path).isEqualTo("doc:name")
    }

    @Test
    fun `should update existing group on re-import`() {
        val initialJson = """
            {
                "key": "$testGroupKey",
                "title": "Initial Title",
                "description": "Initial description",
                "order": 1,
                "color": "#FF0000",
                "members": [],
                "listColumns": [],
                "searchFields": []
            }
        """.trimIndent()

        importer.import(createImportRequest(initialJson))

        val updatedJson = """
            {
                "key": "$testGroupKey",
                "title": "Updated Title",
                "description": "Updated description",
                "order": 10,
                "color": "#00FF00",
                "members": [],
                "listColumns": [],
                "searchFields": []
            }
        """.trimIndent()

        importer.import(createImportRequest(updatedJson))

        val group = groupRepository.findById(testGroupKey).orElseThrow()
        assertThat(group.title).isEqualTo("Updated Title")
        assertThat(group.description).isEqualTo("Updated description")
        assertThat(group.order).isEqualTo(10)
        assertThat(group.color).isEqualTo("#00FF00")

        val allGroups = groupRepository.findAll().filter { it.key == testGroupKey }
        assertThat(allGroups).hasSize(1)
    }

    @Test
    fun `should delete old data on re-import`() {
        val initialJson = """
            {
                "key": "$testGroupKey",
                "title": "Test Group",
                "description": null,
                "order": 0,
                "color": null,
                "members": [
                    {"caseDefinitionKey": "$existingCaseDefKey", "order": 0}
                ],
                "listColumns": [
                    {
                        "key": "col1",
                        "title": "Column 1",
                        "displayType": {"type": "text", "displayTypeParameters": {}},
                        "sortable": true,
                        "defaultSort": null,
                        "order": 0,
                        "exportable": true,
                        "pathMappings": []
                    },
                    {
                        "key": "col2",
                        "title": "Column 2",
                        "displayType": {"type": "text", "displayTypeParameters": {}},
                        "sortable": true,
                        "defaultSort": null,
                        "order": 1,
                        "exportable": true,
                        "pathMappings": []
                    },
                    {
                        "key": "col3",
                        "title": "Column 3",
                        "displayType": {"type": "text", "displayTypeParameters": {}},
                        "sortable": true,
                        "defaultSort": null,
                        "order": 2,
                        "exportable": true,
                        "pathMappings": []
                    }
                ],
                "searchFields": []
            }
        """.trimIndent()

        importer.import(createImportRequest(initialJson))

        assertThat(memberRepository.findByIdGroupKeyOrderByOrderAsc(testGroupKey)).hasSize(1)
        assertThat(listColumnRepository.findByIdGroupKeyOrderByOrderAsc(testGroupKey)).hasSize(3)

        val reducedJson = """
            {
                "key": "$testGroupKey",
                "title": "Test Group",
                "description": null,
                "order": 0,
                "color": null,
                "members": [],
                "listColumns": [
                    {
                        "key": "col-new",
                        "title": "New Column",
                        "displayType": {"type": "text", "displayTypeParameters": {}},
                        "sortable": true,
                        "defaultSort": null,
                        "order": 0,
                        "exportable": true,
                        "pathMappings": []
                    }
                ],
                "searchFields": []
            }
        """.trimIndent()

        importer.import(createImportRequest(reducedJson))

        val members = memberRepository.findByIdGroupKeyOrderByOrderAsc(testGroupKey)
        assertThat(members).isEmpty()

        val listColumns = listColumnRepository.findByIdGroupKeyOrderByOrderAsc(testGroupKey)
        assertThat(listColumns).hasSize(1)
        assertThat(listColumns[0].id.columnKey).isEqualTo("col-new")
    }

    @Test
    fun `should skip members for non-existent case definitions`() {
        val json = """
            {
                "key": "$testGroupKey",
                "title": "Test Group",
                "description": null,
                "order": 0,
                "color": null,
                "members": [
                    {"caseDefinitionKey": "$existingCaseDefKey", "order": 0},
                    {"caseDefinitionKey": "non-existent-case", "order": 1}
                ],
                "listColumns": [],
                "searchFields": []
            }
        """.trimIndent()

        importer.import(createImportRequest(json))

        val group = groupRepository.findById(testGroupKey).orElseThrow()
        assertThat(group).isNotNull

        val members = memberRepository.findByIdGroupKeyOrderByOrderAsc(testGroupKey)
        assertThat(members).hasSize(1)
        assertThat(members[0].id.caseDefinitionKey).isEqualTo(existingCaseDefKey)
    }

    @Test
    fun `should preserve audit fields on update`() {
        val initialJson = """
            {
                "key": "$testGroupKey",
                "title": "Initial Title",
                "description": null,
                "order": 0,
                "color": null,
                "members": [],
                "listColumns": [],
                "searchFields": []
            }
        """.trimIndent()

        importer.import(createImportRequest(initialJson))

        val initialGroup = groupRepository.findById(testGroupKey).orElseThrow()
        val originalCreatedBy = initialGroup.createdBy
        val originalCreatedOn = initialGroup.createdOn

        val updatedJson = """
            {
                "key": "$testGroupKey",
                "title": "Updated Title",
                "description": "Updated",
                "order": 5,
                "color": "#FF0000",
                "members": [],
                "listColumns": [],
                "searchFields": []
            }
        """.trimIndent()

        importer.import(createImportRequest(updatedJson))

        val updatedGroup = groupRepository.findById(testGroupKey).orElseThrow()
        assertThat(updatedGroup.title).isEqualTo("Updated Title")
        assertThat(updatedGroup.createdBy).isEqualTo(originalCreatedBy)
        assertThat(updatedGroup.createdOn).isEqualTo(originalCreatedOn)
    }

    private fun createImportRequest(json: String) = ImportRequest(
        fileName = "/global/case-group/$testGroupKey/$testGroupKey.case-group.json",
        content = json.toByteArray()
    )
}
