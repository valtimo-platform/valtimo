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

import com.ritense.case.service.GroupCaseInstanceService
import com.ritense.case.web.rest.dto.CaseDefinitionGroupResponseDto
import com.ritense.case.web.rest.dto.CaseDefinitionQuickSearchDto
import com.ritense.case.web.rest.dto.GroupCaseListRowDto
import com.ritense.case.web.rest.dto.GroupListColumnDto
import com.ritense.case.web.rest.dto.GroupMemberDto
import com.ritense.case.web.rest.dto.GroupSearchFieldDto
import com.ritense.document.domain.search.SearchWithConfigRequest
import com.ritense.document.web.rest.dto.InternalCaseStatusResponseDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.authorization.UserManagementServiceHolder
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import jakarta.validation.Valid
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping

@Controller
@SkipComponentScan
@RequestMapping("/api/v1/case-definition-group", produces = [APPLICATION_JSON_UTF8_VALUE])
class CaseDefinitionGroupResource(
    private val groupCaseInstanceService: GroupCaseInstanceService
) {

    @GetMapping
    fun getGroups(): ResponseEntity<List<CaseDefinitionGroupResponseDto>> {
        val groups = groupCaseInstanceService.getAccessibleGroups()
            .map { CaseDefinitionGroupResponseDto.of(it) }
        return ResponseEntity.ok(groups)
    }

    @GetMapping("/{groupKey}")
    fun getGroup(
        @PathVariable groupKey: String
    ): ResponseEntity<CaseDefinitionGroupResponseDto> {
        val group = groupCaseInstanceService.getGroup(groupKey)
        return ResponseEntity.ok(CaseDefinitionGroupResponseDto.of(group))
    }

    @GetMapping("/{groupKey}/member")
    fun getMembers(
        @PathVariable groupKey: String
    ): ResponseEntity<List<GroupMemberDto>> {
        val members = groupCaseInstanceService.getAccessibleMembers(groupKey)
            .map { GroupMemberDto.of(it) }
        return ResponseEntity.ok(members)
    }

    @GetMapping("/{groupKey}/list-column")
    fun getListColumns(
        @PathVariable groupKey: String
    ): ResponseEntity<List<GroupListColumnDto>> {
        val columns = groupCaseInstanceService.getListColumns(groupKey)
            .map { GroupListColumnDto.of(it) }
        return ResponseEntity.ok(columns)
    }

    @GetMapping("/{groupKey}/search-field")
    fun getSearchFields(
        @PathVariable groupKey: String
    ): ResponseEntity<List<GroupSearchFieldDto>> {
        val fields = groupCaseInstanceService.getSearchFields(groupKey)
            .map { GroupSearchFieldDto.of(it) }
        return ResponseEntity.ok(fields)
    }

    @GetMapping("/{groupKey}/internal-status")
    fun getInternalCaseStatuses(
        @PathVariable groupKey: String
    ): ResponseEntity<List<InternalCaseStatusResponseDto>> {
        val statuses = groupCaseInstanceService.getInternalCaseStatuses(groupKey)
            .map { InternalCaseStatusResponseDto(it) }
        return ResponseEntity.ok(statuses)
    }

    @PostMapping("/{groupKey}/search")
    fun search(
        @PathVariable groupKey: String,
        @Valid @RequestBody searchRequest: SearchWithConfigRequest,
        pageable: Pageable
    ): ResponseEntity<Page<GroupCaseListRowDto>> {
        val result = groupCaseInstanceService.search(groupKey, searchRequest, pageable)
        return ResponseEntity.ok(result)
    }

    @GetMapping("/{groupKey}/stored-quick-search")
    fun getQuickSearchList(
        @PathVariable groupKey: String
    ): ResponseEntity<List<CaseDefinitionQuickSearchDto>> {
        val currentUserId = UserManagementServiceHolder.currentInstance.currentUserId
        val result = groupCaseInstanceService.getQuickSearchList(groupKey, currentUserId)
            .map { CaseDefinitionQuickSearchDto(it.queryPath, it.title) }
        return ResponseEntity.ok(result)
    }

    @PostMapping("/{groupKey}/stored-quick-search")
    fun saveQuickSearch(
        @PathVariable groupKey: String,
        @Valid @RequestBody request: CaseDefinitionQuickSearchDto
    ): ResponseEntity<Void> {
        val currentUserId = UserManagementServiceHolder.currentInstance.currentUserId
        groupCaseInstanceService.storeQuickSearch(groupKey, request, currentUserId)
        return ResponseEntity.ok().build()
    }

    @DeleteMapping("/{groupKey}/stored-quick-search/{title}")
    fun deleteQuickSearch(
        @PathVariable groupKey: String,
        @PathVariable title: String
    ): ResponseEntity<Void> {
        val currentUserId = UserManagementServiceHolder.currentInstance.currentUserId
        groupCaseInstanceService.deleteQuickSearch(groupKey, userId = currentUserId, title)
        return ResponseEntity.ok().build()
    }
}
