package com.ritense.buildingblock.web.rest

import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.RequestMapping

@Controller
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class BuildingBlockDefinitionResource(
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
) {
}