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

import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case.domain.ColumnDefaultSort
import com.ritense.case.domain.PinnedItem
import com.ritense.case.domain.PinnedItemType
import com.ritense.case.domain.group.GroupQuickSearch
import com.ritense.case.domain.group.GroupSearchField
import com.ritense.case.exception.CaseDefinitionGroupAccessDeniedException
import com.ritense.case.exception.CaseDefinitionGroupNotFoundException
import com.ritense.case.exception.InvalidGroupSearchFieldException
import com.ritense.case.repository.GroupHiddenListColumnRepository
import com.ritense.case.repository.GroupQuickSearchRepository
import com.ritense.case.repository.GroupSearchFieldRepository
import com.ritense.case.repository.PinnedItemRepository
import com.ritense.case.web.rest.dto.GroupListColumnDto
import com.ritense.case.web.rest.dto.GroupListColumnPathMappingDto
import com.ritense.case.web.rest.dto.GroupSearchFieldDto
import com.ritense.case.web.rest.dto.HiddenGroupListColumnDto
import com.ritense.search.domain.DataType
import com.ritense.search.domain.DisplayType
import com.ritense.search.domain.FieldType
import com.ritense.search.domain.EmptyDisplayTypeParameter
import jakarta.persistence.EntityManager
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.hibernate.exception.ConstraintViolationException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.annotation.Transactional

@Transactional
class CaseDefinitionGroupServiceIntTest @Autowired constructor(
    private val groupService: CaseDefinitionGroupService,
    private val groupCaseInstanceService: GroupCaseInstanceService,
    private val pinnedItemRepository: PinnedItemRepository,
    private val quickSearchRepository: GroupQuickSearchRepository,
    private val hiddenListColumnRepository: GroupHiddenListColumnRepository,
    private val groupSearchFieldRepository: GroupSearchFieldRepository,
    private val entityManager: EntityManager,
) : BaseIntegrationTest() {

    @Test
    @WithMockUser(username = "admin", authorities = [FULL_ACCESS_ROLE])
    fun `should generate valid distinct keys for numeric and very long titles`() {
        val numeric = runWithoutAuthorization { groupService.createGroup("2026", null) }
        val numericAgain = runWithoutAuthorization { groupService.createGroup("2026", null) }
        val longTitle = "a".repeat(255)
        val long1 = runWithoutAuthorization { groupService.createGroup(longTitle, null) }
        val long2 = runWithoutAuthorization { groupService.createGroup(longTitle, null) }
        entityManager.flush()

        val keys = listOf(numeric.key, numericAgain.key, long1.key, long2.key)
        assertThat(keys).doesNotHaveDuplicates()
        assertThat(keys).allSatisfy {
            assertThat(it).isNotBlank().hasSizeLessThanOrEqualTo(255).matches("^[a-z0-9][a-z0-9_]*$")
        }
        assertThat(runWithoutAuthorization { groupService.getGroup(numeric.key) }.title).isEqualTo("2026")
    }

    @Test
    @WithMockUser(username = "admin", authorities = [FULL_ACCESS_ROLE])
    fun `should remove pins quick searches and hidden columns when deleting a group`() {
        runWithoutAuthorization {
            val group = runWithoutAuthorization { groupService.createGroup("Cleanup group", null) }
            runWithoutAuthorization {
                groupService.addMember(group.key, CASE_DEFINITION_KEY)
                groupService.updateListColumns(group.key, listOf(columnDto("col1")))
            }
            groupCaseInstanceService.saveHiddenListColumns(group.key, listOf(HiddenGroupListColumnDto("col1")), "user-a")
            listOf("user-a", "user-b").forEach {
                pinnedItemRepository.save(PinnedItem(userId = it, itemType = PinnedItemType.CASE_DEFINITION_GROUP, itemKey = group.key))
                quickSearchRepository.save(GroupQuickSearch(queryPath = "q", title = "qs", groupKey = group.key, userId = it))
            }
            entityManager.flush()
            entityManager.clear()

            runWithoutAuthorization { groupService.deleteGroup(group.key) }
            entityManager.flush()
            entityManager.clear()

            val recreated = runWithoutAuthorization { groupService.createGroup("Cleanup group", null) }
            entityManager.flush()

            assertThat(recreated.key).isEqualTo(group.key)
            assertThat(pinnedItemRepository.findByUserIdOrderByPinnedAtDesc("user-a")).isEmpty()
            assertThat(pinnedItemRepository.findByUserIdOrderByPinnedAtDesc("user-b")).isEmpty()
            assertThat(quickSearchRepository.findAllByGroupKeyAndUserId(group.key, "user-a")).isEmpty()
            assertThat(quickSearchRepository.findAllByGroupKeyAndUserId(group.key, "user-b")).isEmpty()
            assertThat(hiddenListColumnRepository.findAllByUserIdAndGroupKey("user-a", group.key)).isEmpty()
        }
    }

    @Test
    @WithMockUser(username = "admin", authorities = [FULL_ACCESS_ROLE])
    fun `should reject duplicate search field keys and enforce the unique constraint`() {
        val group = runWithoutAuthorization { groupService.createGroup("Duplicate fields", null) }

        assertThrows<InvalidGroupSearchFieldException> {
            runWithoutAuthorization {
                groupService.updateSearchFields(group.key, listOf(searchFieldDto("f"), searchFieldDto("f")))
            }
        }

        val entityGroup = runWithoutAuthorization { groupService.getGroup(group.key) }
        groupSearchFieldRepository.save(searchFieldEntity(group.key, entityGroup, "f"))
        entityManager.flush()
        groupSearchFieldRepository.save(searchFieldEntity(group.key, entityGroup, "f"))
        assertThrows<ConstraintViolationException> { entityManager.flush() }
    }

    @Test
    @WithMockUser(username = "admin", authorities = [FULL_ACCESS_ROLE])
    fun `should replace search fields with the same keys without violating the unique constraint`() {
        val group = runWithoutAuthorization { groupService.createGroup("Replace fields", null) }

        runWithoutAuthorization { groupService.updateSearchFields(group.key, listOf(searchFieldDto("f"))) }
        entityManager.flush()
        runWithoutAuthorization { groupService.updateSearchFields(group.key, listOf(searchFieldDto("f"))) }
        entityManager.flush()

        assertThat(groupSearchFieldRepository.findByGroupKeyOrderByOrderAsc(group.key)).hasSize(1)
    }

    @Test
    @WithMockUser(username = "admin", authorities = [FULL_ACCESS_ROLE])
    fun `should read back exact for a text search field persisted without match type`() {
        val group = runWithoutAuthorization { groupService.createGroup("Match type", null) }

        runWithoutAuthorization { groupService.updateSearchFields(group.key, listOf(searchFieldDto("f"))) }
        entityManager.flush()
        entityManager.clear()

        val stored = groupSearchFieldRepository.findByGroupKeyOrderByOrderAsc(group.key).single()
        assertThat(stored.matchType).isEqualTo(com.ritense.search.domain.SearchFieldMatchType.EXACT)
    }

    @Test
    @WithMockUser(username = "admin", authorities = [FULL_ACCESS_ROLE])
    fun `should throw not found for unknown groups`() {
        runWithoutAuthorization {
            assertThrows<CaseDefinitionGroupNotFoundException> { groupService.getGroup("unknown") }
            assertThrows<CaseDefinitionGroupNotFoundException> { groupService.getMembers("unknown") }
            assertThrows<CaseDefinitionGroupNotFoundException> { groupService.getListColumns("unknown") }
            assertThrows<CaseDefinitionGroupNotFoundException> { groupService.getSearchFields("unknown") }
            assertThrows<CaseDefinitionGroupNotFoundException> { groupService.deleteGroup("unknown") }
        }
        listOf<() -> Any>(
            { groupCaseInstanceService.getGroup("unknown") },
            { groupCaseInstanceService.getListColumns("unknown") },
            { groupCaseInstanceService.getSearchFields("unknown") },
            { groupCaseInstanceService.requireAccessibleMembers("unknown") },
            { groupCaseInstanceService.getInternalCaseStatuses("unknown") },
            { groupCaseInstanceService.getHiddenListColumns("unknown", "user-a") },
        ).forEach { call -> assertThrows<CaseDefinitionGroupNotFoundException> { call() } }
    }

    @Test
    @WithMockUser(username = "admin", authorities = [FULL_ACCESS_ROLE])
    fun `should report accessible member count and round trip hidden columns per user`() {
        runWithoutAuthorization {
            val group = runWithoutAuthorization { groupService.createGroup("Hidden columns", null) }
            runWithoutAuthorization {
                groupService.addMember(group.key, CASE_DEFINITION_KEY)
                groupService.updateListColumns(group.key, listOf(columnDto("col1"), columnDto("col2")))
            }

            assertThat(groupCaseInstanceService.getAccessibleGroup(group.key).memberCount).isEqualTo(1)
            assertThat(
                groupCaseInstanceService.getAccessibleGroupsWithMemberCount().first { it.group.key == group.key }.memberCount
            ).isEqualTo(1)

            groupCaseInstanceService.saveHiddenListColumns(
                group.key,
                listOf(HiddenGroupListColumnDto("col1"), HiddenGroupListColumnDto("unknown")),
                "user-a"
            )
            entityManager.flush()

            assertThat(groupCaseInstanceService.getHiddenListColumns(group.key, "user-a").map { it.key })
                .containsExactly("col1")
            assertThat(groupCaseInstanceService.getHiddenListColumns(group.key, "user-b")).isEmpty()

            entityManager.clear()
            runWithoutAuthorization { groupService.updateListColumns(group.key, listOf(columnDto("col1"), columnDto("col2"))) }
            entityManager.flush()
            assertThat(groupCaseInstanceService.getHiddenListColumns(group.key, "user-a").map { it.key })
                .containsExactly("col1")

            groupCaseInstanceService.saveHiddenListColumns(group.key, emptyList(), "user-a")
            entityManager.flush()
            assertThat(groupCaseInstanceService.getHiddenListColumns(group.key, "user-a")).isEmpty()
        }
    }

    @Test
    @WithMockUser(username = "nobody", authorities = ["ROLE_WITHOUT_PERMISSIONS"])
    fun `should deny access to group details for users without access to the members`() {
        val group = runWithoutAuthorization {
            groupService.createGroup("Restricted", null).also {
                groupService.addMember(it.key, CASE_DEFINITION_KEY)
                groupService.updateListColumns(it.key, listOf(columnDto("col1")))
            }
        }

        assertThrows<CaseDefinitionGroupAccessDeniedException> { groupCaseInstanceService.getGroup(group.key) }
        assertThrows<CaseDefinitionGroupAccessDeniedException> { groupCaseInstanceService.getListColumns(group.key) }
        assertThrows<CaseDefinitionGroupAccessDeniedException> { groupCaseInstanceService.getSearchFields(group.key) }
        assertThrows<CaseDefinitionGroupAccessDeniedException> { groupCaseInstanceService.requireAccessibleMembers(group.key) }
        assertThrows<CaseDefinitionGroupAccessDeniedException> {
            groupCaseInstanceService.saveHiddenListColumns(group.key, emptyList(), "nobody")
        }
        assertThat(groupCaseInstanceService.getAccessibleGroupsWithMemberCount().map { it.group.key })
            .doesNotContain(group.key)
    }

    private fun columnDto(key: String) = GroupListColumnDto(
        key = key,
        title = key,
        displayType = DisplayType("string", EmptyDisplayTypeParameter()),
        sortable = false,
        defaultSort = null as ColumnDefaultSort?,
        order = null,
        pathMappings = listOf(GroupListColumnPathMappingDto(CASE_DEFINITION_KEY, "doc:name"))
    )

    private fun searchFieldDto(key: String) = GroupSearchFieldDto(
        key = key,
        title = key,
        dataType = DataType.TEXT,
        fieldType = FieldType.SINGLE,
        matchType = null,
        dropdownDataProvider = null,
        order = null
    )

    private fun searchFieldEntity(groupKey: String, group: com.ritense.case.domain.group.CaseDefinitionGroup, key: String) =
        GroupSearchField(
            id = UUID.randomUUID(),
            groupKey = groupKey,
            group = group,
            key = key,
            title = key,
            dataType = DataType.TEXT,
            fieldType = FieldType.SINGLE,
            matchType = null,
            dropdownDataProvider = null,
            order = 0
        )

    companion object {
        private const val CASE_DEFINITION_KEY = "some-case-type"
    }
}
