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
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.case.deployment.CaseDefinitionGroupExportDto
import com.ritense.case.deployment.GroupListColumnExportDto
import com.ritense.case.deployment.GroupSearchFieldExportDto
import com.ritense.case.domain.group.CaseDefinitionGroup
import com.ritense.case.domain.group.CaseDefinitionGroupMember
import com.ritense.case.domain.group.CaseDefinitionGroupMemberId
import com.ritense.case.domain.group.GroupListColumn
import com.ritense.case.domain.group.GroupListColumnId
import com.ritense.case.domain.group.GroupListColumnPathMapping
import com.ritense.case.domain.group.GroupListColumnPathMappingId
import com.ritense.case.domain.group.GroupSearchField
import com.ritense.case.domain.group.SortableCaseField
import com.ritense.case.domain.group.GroupSearchFieldPathMapping
import com.ritense.case.domain.group.GroupSearchFieldPathMappingId
import com.ritense.case.repository.CaseDefinitionGroupMemberRepository
import com.ritense.case.repository.CaseDefinitionGroupRepository
import com.ritense.case.repository.GroupListColumnPathMappingRepository
import com.ritense.case.repository.GroupListColumnRepository
import com.ritense.case.repository.GroupSearchFieldPathMappingRepository
import com.ritense.case.repository.GroupSearchFieldRepository
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_DEFINITION_GROUP
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
class CaseDefinitionGroupImporter(
    private val objectMapper: ObjectMapper,
    private val groupRepository: CaseDefinitionGroupRepository,
    private val memberRepository: CaseDefinitionGroupMemberRepository,
    private val listColumnRepository: GroupListColumnRepository,
    private val listColumnPathMappingRepository: GroupListColumnPathMappingRepository,
    private val searchFieldRepository: GroupSearchFieldRepository,
    private val searchFieldPathMappingRepository: GroupSearchFieldPathMappingRepository,
    private val caseDefinitionRepository: CaseDefinitionRepository,
) : Importer {

    override fun type() = CASE_DEFINITION_GROUP

    override fun dependsOn(): Set<String> = emptySet()

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun partOfCaseDefinition() = false

    override fun partOfBuildingBlockDefinition() = false

    override fun import(request: ImportRequest) {
        val dto = objectMapper.readValue<CaseDefinitionGroupExportDto>(
            request.content.toString(Charsets.UTF_8)
        )

        val existingCaseDefinitionKeys = caseDefinitionRepository.findAll()
            .map { it.id.key }
            .toSet()

        val group = importGroup(dto)
        importMembers(dto, group, existingCaseDefinitionKeys)
        importListColumns(dto, group, existingCaseDefinitionKeys)
        importSearchFields(dto, group, existingCaseDefinitionKeys)
    }

    private fun importGroup(dto: CaseDefinitionGroupExportDto): CaseDefinitionGroup {
        val existingGroup = groupRepository.findById(dto.key).orElse(null)
        val group = CaseDefinitionGroup(
            key = dto.key,
            title = dto.title,
            description = dto.description,
            order = dto.order,
            color = dto.color,
            createdBy = existingGroup?.createdBy ?: "import",
            createdOn = existingGroup?.createdOn ?: java.time.ZonedDateTime.now()
        )
        return groupRepository.save(group)
    }

    private fun importMembers(
        dto: CaseDefinitionGroupExportDto,
        group: CaseDefinitionGroup,
        existingCaseDefinitionKeys: Set<String>
    ) {
        memberRepository.deleteByIdGroupKey(dto.key)

        dto.members.forEach { memberDto ->
            if (existingCaseDefinitionKeys.contains(memberDto.caseDefinitionKey)) {
                memberRepository.save(
                    CaseDefinitionGroupMember(
                        id = CaseDefinitionGroupMemberId(dto.key, memberDto.caseDefinitionKey),
                        group = group,
                        order = memberDto.order
                    )
                )
            } else {
                logger.warn {
                    "Skipping member '${memberDto.caseDefinitionKey}' for group '${dto.key}': " +
                        "case definition does not exist"
                }
            }
        }
    }

    private fun importListColumns(
        dto: CaseDefinitionGroupExportDto,
        group: CaseDefinitionGroup,
        existingCaseDefinitionKeys: Set<String>
    ) {
        listColumnRepository.deleteByIdGroupKey(dto.key)

        var defaultSortAssigned = false

        dto.listColumns.forEach { columnDto ->
            val sortable = columnDto.sortable && hasSortablePath(dto.key, columnDto)
            var defaultSort = columnDto.defaultSort.takeIf { sortable }
            if (defaultSort != null) {
                if (defaultSortAssigned) {
                    logger.warn {
                        "Ignoring default sort for column '${columnDto.key}' in group '${dto.key}': " +
                            "another column already has a default sort"
                    }
                    defaultSort = null
                } else {
                    defaultSortAssigned = true
                }
            }
            val column = listColumnRepository.save(
                GroupListColumn(
                    id = GroupListColumnId(groupKey = dto.key, columnKey = columnDto.key),
                    group = group,
                    title = columnDto.title,
                    displayType = columnDto.displayType,
                    sortable = sortable,
                    defaultSort = defaultSort,
                    order = columnDto.order,
                    exportable = columnDto.exportable
                )
            )

            importColumnPathMappings(dto.key, columnDto, column, existingCaseDefinitionKeys)
        }
    }

    private fun hasSortablePath(groupKey: String, columnDto: GroupListColumnExportDto): Boolean {
        val valid = SortableCaseField.sortPathOf(columnDto.pathMappings.map { it.path }) != null
        if (!valid) {
            logger.warn {
                "Column '${columnDto.key}' in group '$groupKey' cannot be sortable: " +
                    "all path mappings must reference the same sortable case field. Sorting is disabled."
            }
        }
        return valid
    }

    private fun importColumnPathMappings(
        groupKey: String,
        columnDto: GroupListColumnExportDto,
        column: GroupListColumn,
        existingCaseDefinitionKeys: Set<String>
    ) {
        columnDto.pathMappings.forEach { mappingDto ->
            if (existingCaseDefinitionKeys.contains(mappingDto.caseDefinitionKey)) {
                listColumnPathMappingRepository.save(
                    GroupListColumnPathMapping(
                        id = GroupListColumnPathMappingId(
                            groupKey = groupKey,
                            columnKey = columnDto.key,
                            caseDefinitionKey = mappingDto.caseDefinitionKey
                        ),
                        column = column,
                        path = mappingDto.path
                    )
                )
            } else {
                logger.warn {
                    "Skipping path mapping for column '${columnDto.key}' in group '$groupKey': " +
                        "case definition '${mappingDto.caseDefinitionKey}' does not exist"
                }
            }
        }
    }

    private fun importSearchFields(
        dto: CaseDefinitionGroupExportDto,
        group: CaseDefinitionGroup,
        existingCaseDefinitionKeys: Set<String>
    ) {
        searchFieldRepository.deleteByGroupKey(dto.key)

        dto.searchFields.forEach { fieldDto ->
            val field = searchFieldRepository.save(
                GroupSearchField(
                    id = UUID.randomUUID(),
                    groupKey = dto.key,
                    group = group,
                    key = fieldDto.key,
                    title = fieldDto.title,
                    dataType = fieldDto.dataType,
                    fieldType = fieldDto.fieldType,
                    matchType = fieldDto.matchType,
                    dropdownDataProvider = fieldDto.dropdownDataProvider,
                    order = fieldDto.order
                )
            )

            importSearchFieldPathMappings(dto.key, fieldDto, field, existingCaseDefinitionKeys)
        }
    }

    private fun importSearchFieldPathMappings(
        groupKey: String,
        fieldDto: GroupSearchFieldExportDto,
        field: GroupSearchField,
        existingCaseDefinitionKeys: Set<String>
    ) {
        fieldDto.pathMappings.forEach { mappingDto ->
            if (existingCaseDefinitionKeys.contains(mappingDto.caseDefinitionKey)) {
                searchFieldPathMappingRepository.save(
                    GroupSearchFieldPathMapping(
                        id = GroupSearchFieldPathMappingId(
                            groupSearchFieldId = field.id,
                            caseDefinitionKey = mappingDto.caseDefinitionKey
                        ),
                        searchField = field,
                        path = mappingDto.path
                    )
                )
            } else {
                logger.warn {
                    "Skipping path mapping for search field '${fieldDto.key}' in group '$groupKey': " +
                        "case definition '${mappingDto.caseDefinitionKey}' does not exist"
                }
            }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        private val FILENAME_REGEX = """/case-group/[^/]+/[^/]+\.case-group\.json""".toRegex()
    }
}
