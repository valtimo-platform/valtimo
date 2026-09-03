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

package com.ritense.case.web.rest

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.case.service.CaseDefinitionGroupService
import com.ritense.case.web.rest.dto.AddGroupMemberRequestDto
import com.ritense.case.web.rest.dto.CaseDefinitionGroupCreateRequestDto
import com.ritense.case.web.rest.dto.CaseDefinitionGroupResponseDto
import com.ritense.case.web.rest.dto.CaseDefinitionGroupUpdateRequestDto
import com.ritense.case.web.rest.dto.CaseDefinitionGroupWithMembersResponseDto
import com.ritense.case.web.rest.dto.GroupListColumnDto
import com.ritense.case.web.rest.dto.GroupListColumnPathMappingDto
import com.ritense.case.web.rest.dto.GroupMemberDto
import com.ritense.case.web.rest.dto.GroupSearchFieldDto
import com.ritense.case.web.rest.dto.GroupSearchFieldPathMappingDto
import com.ritense.case.web.rest.dto.UpdateGroupMemberOrderRequestDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping

@Controller
@SkipComponentScan
@RequestMapping("/api/management/v1/case-definition-group", produces = [APPLICATION_JSON_UTF8_VALUE])
class CaseDefinitionGroupManagementResource(
    private val groupService: CaseDefinitionGroupService
) {

    @RunWithoutAuthorization
    @GetMapping
    fun getGroups(): ResponseEntity<List<CaseDefinitionGroupResponseDto>> {
        val groups = groupService.getGroups().map { CaseDefinitionGroupResponseDto.of(it) }
        return ResponseEntity.ok(groups)
    }

    @RunWithoutAuthorization
    @GetMapping("/{groupKey}")
    fun getGroup(
        @PathVariable groupKey: String
    ): ResponseEntity<CaseDefinitionGroupWithMembersResponseDto> {
        val group = groupService.getGroup(groupKey)
        return ResponseEntity.ok(CaseDefinitionGroupWithMembersResponseDto.of(group))
    }

    @RunWithoutAuthorization
    @PostMapping
    fun createGroup(
        @Valid @RequestBody request: CaseDefinitionGroupCreateRequestDto
    ): ResponseEntity<CaseDefinitionGroupResponseDto> {
        val group = groupService.createGroup(request.title, request.description)
        return ResponseEntity.ok(CaseDefinitionGroupResponseDto.of(group))
    }

    @RunWithoutAuthorization
    @PutMapping("/{groupKey}")
    fun updateGroup(
        @PathVariable groupKey: String,
        @Valid @RequestBody request: CaseDefinitionGroupUpdateRequestDto
    ): ResponseEntity<CaseDefinitionGroupResponseDto> {
        val group = groupService.updateGroup(groupKey, request.title, request.description)
        return ResponseEntity.ok(CaseDefinitionGroupResponseDto.of(group))
    }

    @RunWithoutAuthorization
    @DeleteMapping("/{groupKey}")
    fun deleteGroup(
        @PathVariable groupKey: String
    ): ResponseEntity<Unit> {
        groupService.deleteGroup(groupKey)
        return ResponseEntity.noContent().build()
    }

    @RunWithoutAuthorization
    @GetMapping("/{groupKey}/member")
    fun getMembers(
        @PathVariable groupKey: String
    ): ResponseEntity<List<GroupMemberDto>> {
        val members = groupService.getMembers(groupKey).map { GroupMemberDto.of(it) }
        return ResponseEntity.ok(members)
    }

    @RunWithoutAuthorization
    @PostMapping("/{groupKey}/member")
    fun addMember(
        @PathVariable groupKey: String,
        @Valid @RequestBody request: AddGroupMemberRequestDto
    ): ResponseEntity<GroupMemberDto> {
        val member = groupService.addMember(groupKey, request.caseDefinitionKey)
        return ResponseEntity.ok(GroupMemberDto.of(member))
    }

    @RunWithoutAuthorization
    @DeleteMapping("/{groupKey}/member/{caseDefinitionKey}")
    fun removeMember(
        @PathVariable groupKey: String,
        @PathVariable caseDefinitionKey: String
    ): ResponseEntity<Unit> {
        groupService.removeMember(groupKey, caseDefinitionKey)
        return ResponseEntity.noContent().build()
    }

    @RunWithoutAuthorization
    @PutMapping("/{groupKey}/member/order")
    fun updateMemberOrder(
        @PathVariable groupKey: String,
        @Valid @RequestBody request: UpdateGroupMemberOrderRequestDto
    ): ResponseEntity<List<GroupMemberDto>> {
        groupService.updateMemberOrder(groupKey, request.caseDefinitionKeys)
        val members = groupService.getMembers(groupKey).map { GroupMemberDto.of(it) }
        return ResponseEntity.ok(members)
    }

    @RunWithoutAuthorization
    @GetMapping("/{groupKey}/list-column")
    fun getListColumns(
        @PathVariable groupKey: String
    ): ResponseEntity<List<GroupListColumnDto>> {
        val columns = groupService.getListColumns(groupKey).map { GroupListColumnDto.of(it) }
        return ResponseEntity.ok(columns)
    }

    @RunWithoutAuthorization
    @PutMapping("/{groupKey}/list-column")
    fun updateListColumns(
        @PathVariable groupKey: String,
        @Valid @RequestBody columns: List<GroupListColumnDto>
    ): ResponseEntity<List<GroupListColumnDto>> {
        val updated = groupService.updateListColumns(groupKey, columns).map { GroupListColumnDto.of(it) }
        return ResponseEntity.ok(updated)
    }

    @RunWithoutAuthorization
    @GetMapping("/{groupKey}/list-column/{columnKey}/path-mapping")
    fun getListColumnPathMappings(
        @PathVariable groupKey: String,
        @PathVariable columnKey: String
    ): ResponseEntity<List<GroupListColumnPathMappingDto>> {
        val mappings = groupService.getListColumnPathMappings(groupKey, columnKey)
            .map { GroupListColumnPathMappingDto.of(it) }
        return ResponseEntity.ok(mappings)
    }

    @RunWithoutAuthorization
    @PutMapping("/{groupKey}/list-column/{columnKey}/path-mapping")
    fun updateListColumnPathMappings(
        @PathVariable groupKey: String,
        @PathVariable columnKey: String,
        @Valid @RequestBody mappings: List<GroupListColumnPathMappingDto>
    ): ResponseEntity<List<GroupListColumnPathMappingDto>> {
        val updated = groupService.updateListColumnPathMappings(groupKey, columnKey, mappings)
            .map { GroupListColumnPathMappingDto.of(it) }
        return ResponseEntity.ok(updated)
    }

    @RunWithoutAuthorization
    @GetMapping("/{groupKey}/search-field")
    fun getSearchFields(
        @PathVariable groupKey: String
    ): ResponseEntity<List<GroupSearchFieldDto>> {
        val fields = groupService.getSearchFields(groupKey).map { GroupSearchFieldDto.of(it) }
        return ResponseEntity.ok(fields)
    }

    @RunWithoutAuthorization
    @PutMapping("/{groupKey}/search-field")
    fun updateSearchFields(
        @PathVariable groupKey: String,
        @Valid @RequestBody fields: List<GroupSearchFieldDto>
    ): ResponseEntity<List<GroupSearchFieldDto>> {
        val updated = groupService.updateSearchFields(groupKey, fields).map { GroupSearchFieldDto.of(it) }
        return ResponseEntity.ok(updated)
    }

    @RunWithoutAuthorization
    @GetMapping("/{groupKey}/search-field/{fieldKey}/path-mapping")
    fun getSearchFieldPathMappings(
        @PathVariable groupKey: String,
        @PathVariable fieldKey: String
    ): ResponseEntity<List<GroupSearchFieldPathMappingDto>> {
        val mappings = groupService.getSearchFieldPathMappings(groupKey, fieldKey)
            .map { GroupSearchFieldPathMappingDto.of(it) }
        return ResponseEntity.ok(mappings)
    }

    @RunWithoutAuthorization
    @PutMapping("/{groupKey}/search-field/{fieldKey}/path-mapping")
    fun updateSearchFieldPathMappings(
        @PathVariable groupKey: String,
        @PathVariable fieldKey: String,
        @Valid @RequestBody mappings: List<GroupSearchFieldPathMappingDto>
    ): ResponseEntity<List<GroupSearchFieldPathMappingDto>> {
        val updated = groupService.updateSearchFieldPathMappings(groupKey, fieldKey, mappings)
            .map { GroupSearchFieldPathMappingDto.of(it) }
        return ResponseEntity.ok(updated)
    }
}
