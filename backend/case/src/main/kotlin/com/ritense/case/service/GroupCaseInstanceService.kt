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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.case.domain.group.CaseDefinitionGroup
import com.ritense.case.domain.group.CaseDefinitionGroupMember
import com.ritense.case.domain.group.GroupListColumn
import com.ritense.case.domain.group.GroupSearchField
import com.ritense.case.domain.group.SortableCaseField
import com.ritense.case.domain.group.GroupQuickSearch
import com.ritense.case.repository.CaseDefinitionGroupMemberRepository
import com.ritense.case.repository.CaseDefinitionGroupRepository
import com.ritense.case.repository.GroupListColumnPathMappingRepository
import com.ritense.case.repository.GroupListColumnRepository
import com.ritense.case.repository.GroupQuickSearchRepository
import com.ritense.case.repository.GroupSearchFieldPathMappingRepository
import com.ritense.case.repository.GroupSearchFieldRepository
import com.ritense.case.web.rest.dto.CaseDefinitionQuickSearchDto
import com.ritense.case.web.rest.dto.CaseListRowDto
import com.ritense.case.web.rest.dto.GroupListColumnDto
import com.ritense.case.web.rest.dto.GroupCaseListRowDto
import com.ritense.case_.authorization.CaseDefinitionActionProvider
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.Document
import org.springframework.security.access.AccessDeniedException
import com.ritense.document.domain.impl.searchfield.SearchFieldDataType
import com.ritense.document.domain.impl.searchfield.SearchFieldMatchType
import com.ritense.document.domain.search.SearchWithConfigRequest
import com.ritense.document.domain.InternalCaseStatus
import com.ritense.document.service.DocumentSearchService
import com.ritense.document.service.GlobalSearchFieldMeta
import com.ritense.document.service.InternalCaseStatusService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valueresolver.ValueResolverService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Transactional(readOnly = true)
@Service
@SkipComponentScan
class GroupCaseInstanceService(
    private val groupRepository: CaseDefinitionGroupRepository,
    private val memberRepository: CaseDefinitionGroupMemberRepository,
    private val listColumnRepository: GroupListColumnRepository,
    private val listColumnPathMappingRepository: GroupListColumnPathMappingRepository,
    private val searchFieldRepository: GroupSearchFieldRepository,
    private val searchFieldPathMappingRepository: GroupSearchFieldPathMappingRepository,
    private val quickSearchRepository: GroupQuickSearchRepository,
    private val documentSearchService: DocumentSearchService,
    private val valueResolverService: ValueResolverService,
    private val authorizationService: AuthorizationService,
    private val caseDefinitionService: CaseDefinitionService,
    private val internalCaseStatusService: InternalCaseStatusService
) {

    fun getAccessibleGroups(): List<CaseDefinitionGroup> {
        val groups = groupRepository.findAllByOrderByOrderAsc()
        return groups.filter { group ->
            getAccessibleMembers(group.key).isNotEmpty()
        }
    }

    fun getGroup(groupKey: String): CaseDefinitionGroup {
        return groupRepository.findById(groupKey)
            .orElseThrow { IllegalArgumentException("No group found with key '$groupKey'") }
    }

    fun getAccessibleMembers(groupKey: String): List<CaseDefinitionGroupMember> {
        val members = memberRepository.findByIdGroupKeyOrderByOrderAsc(groupKey)
        return members.filter { member ->
            hasViewPermission(member.id.caseDefinitionKey)
        }
    }

    fun getListColumns(groupKey: String): List<GroupListColumnDto> {
        val columns = listColumnRepository.findByIdGroupKeyOrderByOrderAsc(groupKey)
        val mappingsByColumn = listColumnPathMappingRepository.findByIdGroupKey(groupKey)
            .groupBy { it.id.columnKey }
        return columns.map { column ->
            val sortPath = SortableCaseField.sortPathOf(
                (mappingsByColumn[column.id.columnKey] ?: emptyList()).map { it.path }
            )
            val dto = GroupListColumnDto.of(column)
            if (column.sortable && sortPath != null) {
                dto
            } else {
                dto.copy(sortable = false, defaultSort = null)
            }
        }
    }

    fun getSearchFields(groupKey: String): List<GroupSearchField> {
        return searchFieldRepository.findByGroupKeyOrderByOrderAsc(groupKey)
    }

    fun getInternalCaseStatuses(groupKey: String): List<InternalCaseStatus> {
        val accessibleMemberKeys = getAccessibleMembers(groupKey).map { it.id.caseDefinitionKey }
        return internalCaseStatusService.getInternalCaseStatusesByKeys(accessibleMemberKeys)
    }

    fun search(
        groupKey: String,
        searchRequest: SearchWithConfigRequest,
        pageable: Pageable
    ): Page<GroupCaseListRowDto> {
        val accessibleMemberKeys = getAccessibleMembers(groupKey).map { it.id.caseDefinitionKey }
        if (accessibleMemberKeys.isEmpty()) {
            return PageImpl(emptyList(), pageable, 0)
        }

        val searchFields = searchFieldRepository.findByGroupKeyOrderByOrderAsc(groupKey)
        val searchFieldIds = searchFields.map { it.id }
        val allSearchFieldMappings = searchFieldPathMappingRepository
            .findByIdGroupSearchFieldIdIn(searchFieldIds)
            .groupBy { it.id.groupSearchFieldId }

        val filterPathMappings = searchFields.associate { searchField ->
            searchField.key to (allSearchFieldMappings[searchField.id] ?: emptyList())
                .associate { it.id.caseDefinitionKey to it.path }
        }

        val globalSearchFields = searchFields.associate { searchField ->
            searchField.key to GlobalSearchFieldMeta(
                SearchFieldDataType.fromString(searchField.dataType.key),
                searchField.matchType?.let { SearchFieldMatchType.fromString(it.key) }
            )
        }

        val columns = listColumnRepository.findByIdGroupKeyOrderByOrderAsc(groupKey)
        val allColumnMappings = listColumnPathMappingRepository.findByIdGroupKey(groupKey)
        val mappingsByColumn = allColumnMappings.groupBy { it.id.columnKey }

        val columnPathMappings = columns.associate { column ->
            column.id.columnKey to (mappingsByColumn[column.id.columnKey] ?: emptyList())
                .associate { it.id.caseDefinitionKey to it.path }
        }

        val sortPathByColumnKey = columns
            .filter { it.sortable }
            .mapNotNull { column ->
                SortableCaseField.sortPathOf(columnPathMappings[column.id.columnKey]?.values ?: emptyList())
                    ?.let { column.id.columnKey to it }
            }
            .toMap()

        val searchResults = documentSearchService.search(
            accessibleMemberKeys,
            BlueprintType.CASE,
            searchRequest,
            filterPathMappings,
            globalSearchFields,
            translateSort(pageable, sortPathByColumnKey)
        )

        return searchResults.map { document ->
            val caseDefinitionKey = document.definitionId().name()
            toGroupCaseListRowDto(document, caseDefinitionKey, columns, columnPathMappings)
        }
    }

    private fun translateSort(pageable: Pageable, sortPathByColumnKey: Map<String, String>): Pageable {
        if (pageable.isUnpaged) {
            return pageable
        }
        val orders = pageable.sort.mapNotNull { order ->
            val sortPath = sortPathByColumnKey[order.property]
            if (sortPath == null) {
                logger.debug { "Ignoring sort on non-sortable group column '${order.property}'" }
                null
            } else {
                order.withProperty(sortPath)
            }
        }.toList()
        return PageRequest.of(pageable.pageNumber, pageable.pageSize, Sort.by(orders))
    }

    private fun toGroupCaseListRowDto(
        document: Document,
        caseDefinitionKey: String,
        columns: List<GroupListColumn>,
        pathMappings: Map<String, Map<String, String>>
    ): GroupCaseListRowDto {
        val paths = columns.mapNotNull { column ->
            pathMappings[column.id.columnKey]?.get(caseDefinitionKey)
        }

        val resolvedValuesMap = runWithoutAuthorization {
            valueResolverService.resolveValues(document.id().id.toString(), paths)
        }

        val items = columns.map { column ->
            val path = pathMappings[column.id.columnKey]?.get(caseDefinitionKey)
            val value = if (path != null) resolvedValuesMap[path] else null
            CaseListRowDto.CaseListItemDto(column.id.columnKey, value)
        }.toMutableList()

        return GroupCaseListRowDto(
            id = document.id().toString(),
            caseDefinitionKey = caseDefinitionKey,
            items = items
        )
    }

    private fun hasViewPermission(caseDefinitionKey: String): Boolean {
        return try {
            val caseDefinition = runWithoutAuthorization {
                caseDefinitionService.getActiveCaseDefinition(caseDefinitionKey)
            }
            authorizationService.hasPermission(
                EntityAuthorizationRequest(
                    CaseDefinition::class.java,
                    CaseDefinitionActionProvider.VIEW_LIST,
                    caseDefinition
                )
            )
        } catch (e: AccessDeniedException) {
            false
        }
    }

    fun getQuickSearchList(groupKey: String, userId: String): List<GroupQuickSearch> {
        requireAccessibleGroup(groupKey)
        return quickSearchRepository.findAllByGroupKeyAndUserId(groupKey, userId)
    }

    @Transactional
    fun storeQuickSearch(groupKey: String, request: CaseDefinitionQuickSearchDto, userId: String) {
        requireAccessibleGroup(groupKey)
        require(
            !quickSearchRepository.existsByGroupKeyAndUserIdAndTitle(groupKey, userId, request.title)
        ) {
            "Failed to create quick search. A quick search for this user, for this group, " +
                "with this title, already exists."
        }
        quickSearchRepository.save(
            GroupQuickSearch(
                queryPath = request.queryPath,
                title = request.title,
                groupKey = groupKey,
                userId = userId,
            )
        )
    }

    @Transactional
    fun deleteQuickSearch(groupKey: String, userId: String, title: String) {
        requireAccessibleGroup(groupKey)
        require(
            quickSearchRepository.existsByGroupKeyAndUserIdAndTitle(groupKey, userId, title)
        ) {
            "Failed to delete quick search. No quick search found for this user, group, and title."
        }
        quickSearchRepository.deleteByGroupKeyAndUserIdAndTitle(groupKey, userId, title)
    }

    private fun requireAccessibleGroup(groupKey: String) {
        require(getAccessibleMembers(groupKey).isNotEmpty()) {
            "Access denied to group '$groupKey'"
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
