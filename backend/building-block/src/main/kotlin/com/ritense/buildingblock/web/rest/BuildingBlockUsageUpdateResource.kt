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

package com.ritense.buildingblock.web.rest

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.buildingblock.service.usageupdate.BuildingBlockUsageUpdateService
import com.ritense.buildingblock.web.rest.dto.BuildingBlockInUseVersionDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockUsageUpdateExecuteRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockUsageUpdatePreviewDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockUsageUpdatePreviewRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockUsageUpdateResultDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api/management/v1/building-block/usage-update", produces = [APPLICATION_JSON_UTF8_VALUE])
class BuildingBlockUsageUpdateResource(
    private val buildingBlockUsageUpdateService: BuildingBlockUsageUpdateService,
) {

    @EndpointDescription(
        en = "List building block versions that are in use (management)",
        nl = "Bouwblokversies in gebruik ophalen (beheer)",
    )
    @RunWithoutAuthorization
    @GetMapping("/in-use")
    fun getInUseVersions(
        @RequestParam(value = "key", required = false) key: String?,
    ): ResponseEntity<List<BuildingBlockInUseVersionDto>> {
        return ResponseEntity.ok(buildingBlockUsageUpdateService.getInUseVersions(key))
    }

    @EndpointDescription(
        en = "Preview a building block usage update (management)",
        nl = "Bijwerken van bouwblokgebruik voorbereiden (beheer)",
    )
    @RunWithoutAuthorization
    @PostMapping("/preview", consumes = [APPLICATION_JSON_UTF8_VALUE])
    fun preview(
        @Valid @RequestBody request: BuildingBlockUsageUpdatePreviewRequestDto,
    ): ResponseEntity<BuildingBlockUsageUpdatePreviewDto> {
        return ResponseEntity.ok(buildingBlockUsageUpdateService.preview(request))
    }

    @EndpointDescription(
        en = "Execute a building block usage update (management)",
        nl = "Bouwblokgebruik bijwerken (beheer)",
    )
    @RunWithoutAuthorization
    @PostMapping("/execute", consumes = [APPLICATION_JSON_UTF8_VALUE])
    fun execute(
        @Valid @RequestBody request: BuildingBlockUsageUpdateExecuteRequestDto,
    ): ResponseEntity<BuildingBlockUsageUpdateResultDto> {
        return ResponseEntity.ok(buildingBlockUsageUpdateService.execute(request))
    }
}
