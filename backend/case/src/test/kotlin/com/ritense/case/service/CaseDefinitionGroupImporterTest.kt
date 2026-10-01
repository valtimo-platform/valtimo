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

import com.ritense.case.domain.group.CaseDefinitionGroup
import com.ritense.case.domain.group.CaseDefinitionGroupMember
import com.ritense.case.domain.group.GroupListColumn
import com.ritense.case.domain.group.GroupListColumnPathMapping
import com.ritense.case.domain.group.GroupSearchField
import com.ritense.case.domain.group.GroupSearchFieldPathMapping
import com.ritense.case.repository.CaseDefinitionGroupMemberRepository
import com.ritense.case.repository.CaseDefinitionGroupRepository
import com.ritense.case.repository.GroupListColumnPathMappingRepository
import com.ritense.case.repository.GroupListColumnRepository
import com.ritense.case.repository.GroupSearchFieldPathMappingRepository
import com.ritense.case.repository.GroupSearchFieldRepository
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argThat
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.semver4j.Semver
import java.util.Optional

class CaseDefinitionGroupImporterTest {

    private lateinit var groupRepository: CaseDefinitionGroupRepository
    private lateinit var memberRepository: CaseDefinitionGroupMemberRepository
    private lateinit var listColumnRepository: GroupListColumnRepository
    private lateinit var listColumnPathMappingRepository: GroupListColumnPathMappingRepository
    private lateinit var searchFieldRepository: GroupSearchFieldRepository
    private lateinit var searchFieldPathMappingRepository: GroupSearchFieldPathMappingRepository
    private lateinit var caseDefinitionRepository: CaseDefinitionRepository
    private lateinit var importer: CaseDefinitionGroupImporter
    private val objectMapper = MapperSingleton.get()

    @BeforeEach
    fun setUp() {
        groupRepository = mock()
        memberRepository = mock()
        listColumnRepository = mock()
        listColumnPathMappingRepository = mock()
        searchFieldRepository = mock()
        searchFieldPathMappingRepository = mock()
        caseDefinitionRepository = mock()

        importer = CaseDefinitionGroupImporter(
            objectMapper,
            groupRepository,
            memberRepository,
            listColumnRepository,
            listColumnPathMappingRepository,
            searchFieldRepository,
            searchFieldPathMappingRepository,
            caseDefinitionRepository
        )
    }

    @Test
    fun `should return correct type`() {
        assertThat(importer.type()).isEqualTo(ValtimoImportTypes.CASE_DEFINITION_GROUP)
    }

    @Test
    fun `should have no dependencies`() {
        assertThat(importer.dependsOn()).isEmpty()
    }

    @Test
    fun `should not be part of case definition`() {
        assertThat(importer.partOfCaseDefinition()).isFalse()
    }

    @Test
    fun `should not be part of building block definition`() {
        assertThat(importer.partOfBuildingBlockDefinition()).isFalse()
    }

    @Test
    fun `should support correct filename pattern`() {
        assertThat(importer.supports("/case-group/my-group/my-group.case-group.json")).isTrue()
        assertThat(importer.supports("/case-group/test/test.case-group.json")).isTrue()
        assertThat(importer.supports("/case/my-case/case.json")).isFalse()
        assertThat(importer.supports("/case-group.json")).isFalse()
    }

    @Test
    fun `should import group with basic data`() {
        val json = """
            {
                "key": "my-group",
                "title": "My Group",
                "description": "A test group",
                "order": 0,
                "color": "#FF0000",
                "members": [],
                "listColumns": [],
                "searchFields": []
            }
        """.trimIndent()

        whenever(caseDefinitionRepository.findAll()).thenReturn(emptyList())
        whenever(groupRepository.findById("my-group")).thenReturn(Optional.empty())
        whenever(groupRepository.save(any<CaseDefinitionGroup>())).thenAnswer { it.arguments[0] }

        importer.import(createImportRequest(json))

        verify(groupRepository).save(argThat<CaseDefinitionGroup> { group ->
            group.key == "my-group" &&
                group.title == "My Group" &&
                group.description == "A test group" &&
                group.order == 0 &&
                group.color == "#FF0000"
        })
    }

    @Test
    fun `should import members for existing case definitions`() {
        val json = """
            {
                "key": "my-group",
                "title": "My Group",
                "description": null,
                "order": 0,
                "color": null,
                "members": [
                    {"caseDefinitionKey": "existing-case", "order": 0},
                    {"caseDefinitionKey": "missing-case", "order": 1}
                ],
                "listColumns": [],
                "searchFields": []
            }
        """.trimIndent()

        val existingCaseDef = createCaseDefinition("existing-case")
        whenever(caseDefinitionRepository.findAll()).thenReturn(listOf(existingCaseDef))
        whenever(groupRepository.findById("my-group")).thenReturn(Optional.empty())
        whenever(groupRepository.save(any<CaseDefinitionGroup>())).thenAnswer { it.arguments[0] }
        whenever(memberRepository.save(any<CaseDefinitionGroupMember>())).thenAnswer { it.arguments[0] }

        importer.import(createImportRequest(json))

        verify(memberRepository).save(argThat<CaseDefinitionGroupMember> { member ->
            member.id.caseDefinitionKey == "existing-case"
        })
        verify(memberRepository, never()).save(argThat<CaseDefinitionGroupMember> { member ->
            member.id.caseDefinitionKey == "missing-case"
        })
    }

    @Test
    fun `should import list column path mappings only for existing case definitions`() {
        val json = """
            {
                "key": "my-group",
                "title": "My Group",
                "description": null,
                "order": 0,
                "color": null,
                "members": [],
                "listColumns": [{
                    "key": "status",
                    "title": "Status",
                    "displayType": {"type": "text", "displayTypeParameters": {}},
                    "sortable": true,
                    "defaultSort": null,
                    "order": 0,
                    "exportable": true,
                    "pathMappings": [
                        {"caseDefinitionKey": "existing-case", "path": "doc:status"},
                        {"caseDefinitionKey": "missing-case", "path": "doc:status"}
                    ]
                }],
                "searchFields": []
            }
        """.trimIndent()

        val existingCaseDef = createCaseDefinition("existing-case")
        whenever(caseDefinitionRepository.findAll()).thenReturn(listOf(existingCaseDef))
        whenever(groupRepository.findById("my-group")).thenReturn(Optional.empty())
        whenever(groupRepository.save(any<CaseDefinitionGroup>())).thenAnswer { it.arguments[0] }
        whenever(listColumnRepository.save(any<GroupListColumn>())).thenAnswer { it.arguments[0] }
        whenever(listColumnPathMappingRepository.save(any<GroupListColumnPathMapping>())).thenAnswer { it.arguments[0] }

        importer.import(createImportRequest(json))

        verify(listColumnRepository).save(any())
        verify(listColumnPathMappingRepository).save(argThat<GroupListColumnPathMapping> { mapping ->
            mapping.id.caseDefinitionKey == "existing-case"
        })
        verify(listColumnPathMappingRepository, never()).save(argThat<GroupListColumnPathMapping> { mapping ->
            mapping.id.caseDefinitionKey == "missing-case"
        })
    }

    @Test
    fun `should import search field path mappings only for existing case definitions`() {
        val json = """
            {
                "key": "my-group",
                "title": "My Group",
                "description": null,
                "order": 0,
                "color": null,
                "members": [],
                "listColumns": [],
                "searchFields": [{
                    "key": "name",
                    "title": "Name",
                    "dataType": "TEXT",
                    "fieldType": "SINGLE",
                    "matchType": "LIKE",
                    "dropdownDataProvider": null,
                    "order": 0,
                    "pathMappings": [
                        {"caseDefinitionKey": "existing-case", "path": "doc:name"},
                        {"caseDefinitionKey": "missing-case", "path": "doc:name"}
                    ]
                }]
            }
        """.trimIndent()

        val existingCaseDef = createCaseDefinition("existing-case")
        whenever(caseDefinitionRepository.findAll()).thenReturn(listOf(existingCaseDef))
        whenever(groupRepository.findById("my-group")).thenReturn(Optional.empty())
        whenever(groupRepository.save(any<CaseDefinitionGroup>())).thenAnswer { it.arguments[0] }
        whenever(searchFieldRepository.save(any<GroupSearchField>())).thenAnswer { it.arguments[0] }
        whenever(searchFieldPathMappingRepository.save(any<GroupSearchFieldPathMapping>())).thenAnswer { it.arguments[0] }

        importer.import(createImportRequest(json))

        verify(searchFieldRepository).save(any())
        verify(searchFieldPathMappingRepository).save(argThat<GroupSearchFieldPathMapping> { mapping ->
            mapping.id.caseDefinitionKey == "existing-case"
        })
        verify(searchFieldPathMappingRepository, never()).save(argThat<GroupSearchFieldPathMapping> { mapping ->
            mapping.id.caseDefinitionKey == "missing-case"
        })
    }

    @Test
    fun `should delete existing members before importing new ones`() {
        val json = """
            {
                "key": "my-group",
                "title": "My Group",
                "description": null,
                "order": 0,
                "color": null,
                "members": [{"caseDefinitionKey": "existing-case", "order": 0}],
                "listColumns": [],
                "searchFields": []
            }
        """.trimIndent()

        val existingCaseDef = createCaseDefinition("existing-case")
        whenever(caseDefinitionRepository.findAll()).thenReturn(listOf(existingCaseDef))
        whenever(groupRepository.findById("my-group")).thenReturn(Optional.empty())
        whenever(groupRepository.save(any<CaseDefinitionGroup>())).thenAnswer { it.arguments[0] }
        whenever(memberRepository.save(any<CaseDefinitionGroupMember>())).thenAnswer { it.arguments[0] }

        importer.import(createImportRequest(json))

        verify(memberRepository).deleteByIdGroupKey("my-group")
    }

    @Test
    fun `should delete existing list columns before importing`() {
        val json = """
            {
                "key": "my-group",
                "title": "My Group",
                "description": null,
                "order": 0,
                "color": null,
                "members": [],
                "listColumns": [{
                    "key": "status",
                    "title": "Status",
                    "displayType": {"type": "text", "displayTypeParameters": {}},
                    "sortable": true,
                    "defaultSort": null,
                    "order": 0,
                    "exportable": true,
                    "pathMappings": []
                }],
                "searchFields": []
            }
        """.trimIndent()

        whenever(caseDefinitionRepository.findAll()).thenReturn(emptyList())
        whenever(groupRepository.findById("my-group")).thenReturn(Optional.empty())
        whenever(groupRepository.save(any<CaseDefinitionGroup>())).thenAnswer { it.arguments[0] }
        whenever(listColumnRepository.save(any<GroupListColumn>())).thenAnswer { it.arguments[0] }

        importer.import(createImportRequest(json))

        verify(listColumnRepository).deleteByIdGroupKey("my-group")
    }

    @Test
    fun `should delete existing search fields before importing`() {
        val json = """
            {
                "key": "my-group",
                "title": "My Group",
                "description": null,
                "order": 0,
                "color": null,
                "members": [],
                "listColumns": [],
                "searchFields": [{
                    "key": "name",
                    "title": "Name",
                    "dataType": "TEXT",
                    "fieldType": "SINGLE",
                    "matchType": "LIKE",
                    "dropdownDataProvider": null,
                    "order": 0,
                    "pathMappings": []
                }]
            }
        """.trimIndent()

        whenever(caseDefinitionRepository.findAll()).thenReturn(emptyList())
        whenever(groupRepository.findById("my-group")).thenReturn(Optional.empty())
        whenever(groupRepository.save(any<CaseDefinitionGroup>())).thenAnswer { it.arguments[0] }
        whenever(searchFieldRepository.save(any<GroupSearchField>())).thenAnswer { it.arguments[0] }

        importer.import(createImportRequest(json))

        verify(searchFieldRepository).deleteByGroupKey("my-group")
    }

    @Test
    fun `should preserve existing group audit fields on update`() {
        val json = """
            {
                "key": "my-group",
                "title": "Updated Title",
                "description": "Updated",
                "order": 5,
                "color": "#00FF00",
                "members": [],
                "listColumns": [],
                "searchFields": []
            }
        """.trimIndent()

        val existingGroup = CaseDefinitionGroup(
            key = "my-group",
            title = "Old Title",
            description = "Old",
            order = 0,
            color = "#FF0000",
            createdBy = "original-user",
            createdOn = java.time.ZonedDateTime.parse("2024-01-01T00:00:00Z")
        )

        whenever(caseDefinitionRepository.findAll()).thenReturn(emptyList())
        whenever(groupRepository.findById("my-group")).thenReturn(Optional.of(existingGroup))
        whenever(groupRepository.save(any<CaseDefinitionGroup>())).thenAnswer { it.arguments[0] }

        importer.import(createImportRequest(json))

        verify(groupRepository).save(argThat<CaseDefinitionGroup> { group ->
            group.title == "Updated Title" &&
                group.createdBy == "original-user" &&
                group.createdOn == existingGroup.createdOn
        })
    }

    private fun createImportRequest(json: String) = ImportRequest(
        fileName = "/case-group/my-group/my-group.case-group.json",
        content = json.toByteArray()
    )

    private fun createCaseDefinition(key: String): CaseDefinition {
        val caseDef = mock<CaseDefinition>()
        val id = CaseDefinitionId(key, Semver("1.0.0"))
        whenever(caseDef.id).thenReturn(id)
        return caseDef
    }
}
