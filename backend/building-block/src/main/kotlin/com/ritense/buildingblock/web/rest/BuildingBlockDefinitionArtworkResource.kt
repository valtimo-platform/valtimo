/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import com.ritense.buildingblock.service.BuildingBlockDefinitionArtworkService
import com.ritense.buildingblock.web.rest.dto.BuildingBlockDefinitionArtworkDto
import com.ritense.buildingblock.web.rest.dto.CreateBuildingBlockDefinitionArtworkDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api/management/v1/building-block", produces = [APPLICATION_JSON_UTF8_VALUE])
class BuildingBlockDefinitionArtworkResource(
    private val buildingBlockDefinitionArtworkService: BuildingBlockDefinitionArtworkService
) {

    @EndpointDescription(
        en = "Get building block artwork",
        nl = "Bouwblokafbeelding ophalen",
    )
    @GetMapping("/{key}/version/{versionTag}/artwork")
    fun getArtwork(
        @PathVariable key: String,
        @PathVariable versionTag: String
    ): ResponseEntity<BuildingBlockDefinitionArtworkDto> {
        val dto = runWithoutAuthorization { buildingBlockDefinitionArtworkService.getArtwork(key, versionTag) }
        return dto?.let { ResponseEntity.ok(it) }
            ?: ResponseEntity.notFound().build()
    }

    @EndpointDescription(
        en = "Create building block artwork",
        nl = "Bouwblokafbeelding aanmaken",
    )
    @PostMapping(
        path = ["/{key}/version/{versionTag}/artwork"],
        consumes = [APPLICATION_JSON_UTF8_VALUE]
    )
    fun createArtwork(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @Valid @RequestBody dto: CreateBuildingBlockDefinitionArtworkDto
    ): ResponseEntity<BuildingBlockDefinitionArtworkDto> {
        val created =
            runWithoutAuthorization { buildingBlockDefinitionArtworkService.createArtwork(key, versionTag, dto) }
        return ResponseEntity.ok(created)
    }

    @EndpointDescription(
        en = "Delete building block artwork",
        nl = "Bouwblokafbeelding verwijderen",
    )
    @DeleteMapping("/{key}/version/{versionTag}/artwork")
    fun deleteArtwork(
        @PathVariable key: String,
        @PathVariable versionTag: String
    ): ResponseEntity<Void> {
        runWithoutAuthorization { buildingBlockDefinitionArtworkService.deleteArtwork(key, versionTag) }
        return ResponseEntity.noContent().build()
    }
}