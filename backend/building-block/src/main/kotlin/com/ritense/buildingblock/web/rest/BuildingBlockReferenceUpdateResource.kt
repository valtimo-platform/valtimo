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
import com.ritense.buildingblock.service.referenceupdate.BuildingBlockReferenceUpdateService
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateExecuteRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdatePreviewDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdatePreviewRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateResultDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api/management/v1/building-block/reference-update", produces = [APPLICATION_JSON_UTF8_VALUE])
class BuildingBlockReferenceUpdateResource(
    private val buildingBlockReferenceUpdateService: BuildingBlockReferenceUpdateService,
) {

    @EndpointDescription(
        en = "List references to a building block version (management)",
        nl = "Verwijzingen naar een bouwblokversie ophalen (beheer)",
    )
    @RunWithoutAuthorization
    @GetMapping("/references/{key}/version/{versionTag}")
    fun getReferences(
        @PathVariable key: String,
        @PathVariable versionTag: String,
    ): ResponseEntity<List<BuildingBlockReferenceDto>> {
        return ResponseEntity.ok(buildingBlockReferenceUpdateService.getReferences(key, versionTag))
    }

    @EndpointDescription(
        en = "Preview a building block reference update (management)",
        nl = "Bijwerken van bouwblokgebruik voorbereiden (beheer)",
    )
    @RunWithoutAuthorization
    @PostMapping("/preview", consumes = [APPLICATION_JSON_UTF8_VALUE])
    fun preview(
        @Valid @RequestBody request: BuildingBlockReferenceUpdatePreviewRequestDto,
    ): ResponseEntity<BuildingBlockReferenceUpdatePreviewDto> {
        return ResponseEntity.ok(buildingBlockReferenceUpdateService.preview(request))
    }

    @EndpointDescription(
        en = "Execute a building block reference update (management)",
        nl = "Bouwblokgebruik bijwerken (beheer)",
    )
    @RunWithoutAuthorization
    @PostMapping("/execute", consumes = [APPLICATION_JSON_UTF8_VALUE])
    fun execute(
        @Valid @RequestBody request: BuildingBlockReferenceUpdateExecuteRequestDto,
    ): ResponseEntity<BuildingBlockReferenceUpdateResultDto> {
        return ResponseEntity.ok(buildingBlockReferenceUpdateService.execute(request))
    }
}
