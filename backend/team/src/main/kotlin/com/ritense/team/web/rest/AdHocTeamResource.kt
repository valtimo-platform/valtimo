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

package com.ritense.team.web.rest

import com.ritense.team.web.rest.dto.AdHocTeamCreateRequestDto
import com.ritense.team.web.rest.dto.AdHocTeamResponseDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.authentication.TeamManagementService
import jakarta.validation.Valid
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.web.SortDefault
import org.springframework.data.web.SortDefault.SortDefaults
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api/v1/case/{caseId}/team")
class AdHocTeamResource(
    private val teamManagementService: TeamManagementService,
) {

    @GetMapping
    fun getAdHocTeams(
        @PathVariable caseId: UUID,
        @RequestParam(required = false) titleContains: String?,
        @SortDefaults(SortDefault(sort = ["title"])) pageable: Pageable,
    ): Page<AdHocTeamResponseDto> {
        return teamManagementService.findAllByAdHocCaseDocumentId(caseId, titleContains, pageable)
            .map { AdHocTeamResponseDto.from(it) }
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun createAdHocTeam(
        @PathVariable caseId: UUID,
        @Valid @RequestBody(required = false) request: AdHocTeamCreateRequestDto?,
    ): AdHocTeamResponseDto {
        val team = teamManagementService.createAdHocTeam(caseId, request?.title)
        return AdHocTeamResponseDto.from(team)
    }

    @DeleteMapping("/{teamKey}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteAdHocTeam(
        @PathVariable caseId: UUID,
        @PathVariable teamKey: String,
    ) {
        val team = teamManagementService.findByKey(teamKey)
            ?: throw IllegalArgumentException("Team not found")
        require(team.adHocCaseDocumentId == caseId) { "Team does not belong to this case" }
        teamManagementService.delete(teamKey)
    }
}
