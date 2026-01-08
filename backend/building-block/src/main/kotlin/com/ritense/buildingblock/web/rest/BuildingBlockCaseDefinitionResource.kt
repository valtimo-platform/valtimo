package com.ritense.buildingblock.web.rest

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.service.BuildingBlockCaseDefinitionService
import com.ritense.buildingblock.web.rest.dto.CaseDefinitionFinalizableResponseDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api/management/v1/case-definition", produces = [APPLICATION_JSON_UTF8_VALUE])
class BuildingBlockCaseDefinitionResource(
    private val buildingBlockCaseDefinitionService: BuildingBlockCaseDefinitionService,
) {

    @GetMapping("/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/finalizable")
    fun isCaseDefinitionFinalizable(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
    ): ResponseEntity<CaseDefinitionFinalizableResponseDto> {
        val finalizable = runWithoutAuthorization {
            buildingBlockCaseDefinitionService.isCaseDefinitionFinalizable(caseDefinitionKey, caseDefinitionVersionTag)
        }
        return ResponseEntity.ok(CaseDefinitionFinalizableResponseDto(finalizable))
    }
}