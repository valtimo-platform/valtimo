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

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.case.domain.ColumnDefaultSort
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
import com.ritense.case.web.rest.dto.GroupListColumnDto
import com.ritense.case.web.rest.dto.GroupListColumnPathMappingDto
import com.ritense.case.web.rest.dto.GroupSearchFieldDto
import com.ritense.case.web.rest.dto.GroupSearchFieldPathMappingDto
import com.ritense.search.domain.DataType
import com.ritense.search.domain.DisplayType
import com.ritense.search.domain.FieldType
import com.ritense.search.domain.SearchFieldMatchType
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
@Service
@SkipComponentScan
class CaseDefinitionGroupService(
    private val groupRepository: CaseDefinitionGroupRepository,
    private val memberRepository: CaseDefinitionGroupMemberRepository,
    private val listColumnRepository: GroupListColumnRepository,
    private val listColumnPathMappingRepository: GroupListColumnPathMappingRepository,
    private val searchFieldRepository: GroupSearchFieldRepository,
    private val searchFieldPathMappingRepository: GroupSearchFieldPathMappingRepository,
    private val authorizationService: AuthorizationService
) {

    @Transactional(readOnly = true)
    fun getGroups(): List<CaseDefinitionGroup> {
        denyAuthorization()
        return groupRepository.findAllByOrderByOrderAsc()
    }

    @Transactional(readOnly = true)
    fun getGroup(groupKey: String): CaseDefinitionGroup {
        denyAuthorization()
        return groupRepository.findById(groupKey)
            .orElseThrow { IllegalArgumentException("No group found with key '$groupKey'") }
    }

    fun createGroup(title: String, description: String?): CaseDefinitionGroup {
        denyAuthorization()
        val key = generateGroupKey(title)
        val order = groupRepository.findMaxOrder() + 1
        return groupRepository.save(
            CaseDefinitionGroup(
                key = key,
                title = title,
                description = description,
                order = order
            )
        )
    }

    fun updateGroup(groupKey: String, title: String, description: String?): CaseDefinitionGroup {
        denyAuthorization()
        val group = getGroup(groupKey)
        return groupRepository.save(
            group.copy(
                title = title,
                description = description
            )
        )
    }

    fun deleteGroup(groupKey: String) {
        denyAuthorization()
        groupRepository.deleteById(groupKey)
        updateGroupOrder()
    }

    @Transactional(readOnly = true)
    fun getMembers(groupKey: String): List<CaseDefinitionGroupMember> {
        denyAuthorization()
        return memberRepository.findByIdGroupKeyOrderByOrderAsc(groupKey)
    }

    fun addMember(groupKey: String, caseDefinitionKey: String): CaseDefinitionGroupMember {
        denyAuthorization()
        val group = getGroup(groupKey)
        val order = memberRepository.findMaxOrderByGroupKey(groupKey) + 1
        return memberRepository.save(
            CaseDefinitionGroupMember(
                id = CaseDefinitionGroupMemberId(groupKey = groupKey, caseDefinitionKey = caseDefinitionKey),
                group = group,
                order = order
            )
        )
    }

    fun removeMember(groupKey: String, caseDefinitionKey: String) {
        denyAuthorization()
        memberRepository.deleteByIdGroupKeyAndIdCaseDefinitionKey(groupKey, caseDefinitionKey)
        updateMemberOrder(groupKey)
    }

    fun updateMemberOrder(groupKey: String, caseDefinitionKeys: List<String>) {
        denyAuthorization()
        val group = getGroup(groupKey)
        val members = caseDefinitionKeys.mapIndexed { index, key ->
            CaseDefinitionGroupMember(
                id = CaseDefinitionGroupMemberId(groupKey = groupKey, caseDefinitionKey = key),
                group = group,
                order = index
            )
        }
        memberRepository.deleteByIdGroupKey(groupKey)
        memberRepository.saveAll(members)
    }

    @Transactional(readOnly = true)
    fun getListColumns(groupKey: String): List<GroupListColumn> {
        denyAuthorization()
        return listColumnRepository.findByIdGroupKeyOrderByOrderAsc(groupKey)
    }

    fun updateListColumns(groupKey: String, columns: List<GroupListColumnDto>): List<GroupListColumn> {
        denyAuthorization()
        val group = getGroup(groupKey)

        val existingMappings = mutableMapOf<String, List<GroupListColumnPathMapping>>()
        listColumnRepository.findByIdGroupKeyOrderByOrderAsc(groupKey).forEach { column ->
            existingMappings[column.id.columnKey] = listColumnPathMappingRepository
                .findByIdGroupKeyAndIdColumnKey(groupKey, column.id.columnKey)
        }

        listColumnRepository.deleteByIdGroupKey(groupKey)

        val savedColumns = columns.mapIndexed { index, dto ->
            val column = listColumnRepository.save(
                GroupListColumn(
                    id = GroupListColumnId(groupKey = groupKey, columnKey = dto.key),
                    group = group,
                    title = dto.title,
                    displayType = dto.displayType,
                    sortable = dto.sortable,
                    defaultSort = dto.defaultSort,
                    order = index,
                    exportable = dto.exportable
                )
            )

            existingMappings[dto.key]?.forEach { mapping ->
                listColumnPathMappingRepository.save(
                    GroupListColumnPathMapping(
                        id = GroupListColumnPathMappingId(
                            groupKey = groupKey,
                            columnKey = dto.key,
                            caseDefinitionKey = mapping.id.caseDefinitionKey
                        ),
                        column = column,
                        path = mapping.path
                    )
                )
            }

            column
        }

        return savedColumns
    }

    @Transactional(readOnly = true)
    fun getListColumnPathMappings(groupKey: String, columnKey: String): List<GroupListColumnPathMapping> {
        denyAuthorization()
        return listColumnPathMappingRepository.findByIdGroupKeyAndIdColumnKey(groupKey, columnKey)
    }

    fun updateListColumnPathMappings(
        groupKey: String,
        columnKey: String,
        mappings: List<GroupListColumnPathMappingDto>
    ): List<GroupListColumnPathMapping> {
        denyAuthorization()
        val column = listColumnRepository.findById(GroupListColumnId(groupKey, columnKey))
            .orElseThrow { IllegalArgumentException("No column found with key '$columnKey' in group '$groupKey'") }

        listColumnPathMappingRepository.deleteByIdGroupKeyAndIdColumnKey(groupKey, columnKey)

        return mappings.map { dto ->
            listColumnPathMappingRepository.save(
                GroupListColumnPathMapping(
                    id = GroupListColumnPathMappingId(
                        groupKey = groupKey,
                        columnKey = columnKey,
                        caseDefinitionKey = dto.caseDefinitionKey
                    ),
                    column = column,
                    path = dto.path
                )
            )
        }
    }

    @Transactional(readOnly = true)
    fun getSearchFields(groupKey: String): List<GroupSearchField> {
        denyAuthorization()
        return searchFieldRepository.findByGroupKeyOrderByOrderAsc(groupKey)
    }

    fun updateSearchFields(groupKey: String, fields: List<GroupSearchFieldDto>): List<GroupSearchField> {
        denyAuthorization()
        val group = getGroup(groupKey)

        val existingMappings = mutableMapOf<String, List<GroupSearchFieldPathMapping>>()
        searchFieldRepository.findByGroupKeyOrderByOrderAsc(groupKey).forEach { field ->
            existingMappings[field.key] = searchFieldPathMappingRepository.findByIdGroupSearchFieldId(field.id)
        }

        searchFieldRepository.deleteByGroupKey(groupKey)

        return fields.mapIndexed { index, dto ->
            val field = searchFieldRepository.save(
                GroupSearchField(
                    id = UUID.randomUUID(),
                    groupKey = groupKey,
                    group = group,
                    key = dto.key,
                    title = dto.title,
                    dataType = dto.dataType,
                    fieldType = dto.fieldType,
                    matchType = dto.matchType,
                    dropdownDataProvider = dto.dropdownDataProvider,
                    order = index
                )
            )

            existingMappings[dto.key]?.forEach { mapping ->
                searchFieldPathMappingRepository.save(
                    GroupSearchFieldPathMapping(
                        id = GroupSearchFieldPathMappingId(
                            groupSearchFieldId = field.id,
                            caseDefinitionKey = mapping.id.caseDefinitionKey
                        ),
                        searchField = field,
                        path = mapping.path
                    )
                )
            }

            field
        }
    }

    @Transactional(readOnly = true)
    fun getSearchFieldPathMappings(groupKey: String, fieldKey: String): List<GroupSearchFieldPathMapping> {
        denyAuthorization()
        val field = searchFieldRepository.findByGroupKeyAndKey(groupKey, fieldKey)
            ?: throw IllegalArgumentException("No search field found with key '$fieldKey' in group '$groupKey'")
        return searchFieldPathMappingRepository.findByIdGroupSearchFieldId(field.id)
    }

    fun updateSearchFieldPathMappings(
        groupKey: String,
        fieldKey: String,
        mappings: List<GroupSearchFieldPathMappingDto>
    ): List<GroupSearchFieldPathMapping> {
        denyAuthorization()
        val field = searchFieldRepository.findByGroupKeyAndKey(groupKey, fieldKey)
            ?: throw IllegalArgumentException("No search field found with key '$fieldKey' in group '$groupKey'")

        searchFieldPathMappingRepository.deleteByIdGroupSearchFieldId(field.id)

        return mappings.map { dto ->
            searchFieldPathMappingRepository.save(
                GroupSearchFieldPathMapping(
                    id = GroupSearchFieldPathMappingId(
                        groupSearchFieldId = field.id,
                        caseDefinitionKey = dto.caseDefinitionKey
                    ),
                    searchField = field,
                    path = dto.path
                )
            )
        }
    }

    private fun updateGroupOrder() {
        val groups = groupRepository.findAllByOrderByOrderAsc()
            .mapIndexed { index, group -> group.copy(order = index) }
        groupRepository.saveAll(groups)
    }

    private fun updateMemberOrder(groupKey: String) {
        val members = memberRepository.findByIdGroupKeyOrderByOrderAsc(groupKey)
            .mapIndexed { index, member -> member.copy(order = index) }
        memberRepository.saveAll(members)
    }

    private fun generateGroupKey(title: String): String {
        val baseKey = title
            .lowercase()
            .replace("(^[^a-z]+)|([^0-9a-z]+\$)".toRegex(), "")
            .replace("[^0-9a-z]+".toRegex(), "_")
        var key = baseKey
        var i = 2
        while (groupRepository.existsByKey(key)) {
            key = "${baseKey}_${i++}"
        }
        return key
    }

    private fun denyAuthorization() {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                CaseDefinitionGroup::class.java,
                Action.deny()
            )
        )
    }
}
