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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.service.versionmigration.BuildingBlockVersionMigrationService
import com.ritense.buildingblock.web.rest.dto.BuildingBlockInUseVersionDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationExecuteRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationPreviewDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationPreviewRequestDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationResultDto
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
@RequestMapping("/api/management/v1/building-block/version-migration", produces = [APPLICATION_JSON_UTF8_VALUE])
class BuildingBlockVersionMigrationResource(
    private val buildingBlockVersionMigrationService: BuildingBlockVersionMigrationService,
) {

    @EndpointDescription(
        en = "List building block versions that are in use",
        nl = "Bouwblokversies in gebruik ophalen",
    )
    @GetMapping("/in-use")
    fun getInUseVersions(
        @RequestParam(value = "key", required = false) key: String?,
    ): ResponseEntity<List<BuildingBlockInUseVersionDto>> {
        return ResponseEntity.ok(runWithoutAuthorization { buildingBlockVersionMigrationService.getInUseVersions(key) })
    }

    @EndpointDescription(
        en = "Preview a building block version migration",
        nl = "Bouwblokversiemigratie voorbereiden",
    )
    @PostMapping("/preview", consumes = [APPLICATION_JSON_UTF8_VALUE])
    fun preview(
        @Valid @RequestBody request: BuildingBlockVersionMigrationPreviewRequestDto,
    ): ResponseEntity<BuildingBlockVersionMigrationPreviewDto> {
        return ResponseEntity.ok(runWithoutAuthorization { buildingBlockVersionMigrationService.preview(request) })
    }

    @EndpointDescription(
        en = "Execute a building block version migration",
        nl = "Bouwblokversiemigratie uitvoeren",
    )
    @PostMapping("/execute", consumes = [APPLICATION_JSON_UTF8_VALUE])
    fun execute(
        @Valid @RequestBody request: BuildingBlockVersionMigrationExecuteRequestDto,
    ): ResponseEntity<BuildingBlockVersionMigrationResultDto> {
        return ResponseEntity.ok(runWithoutAuthorization { buildingBlockVersionMigrationService.execute(request) })
    }
}
