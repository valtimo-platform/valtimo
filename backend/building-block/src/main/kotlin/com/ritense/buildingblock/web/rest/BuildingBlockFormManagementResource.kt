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

import com.ritense.buildingblock.service.BuildingBlockFormDefinitionService
import com.ritense.buildingblock.web.rest.dto.BuildingBlockFormDefinitionDto
import com.ritense.buildingblock.web.rest.dto.CreateBuildingBlockFormDefinitionDto
import com.ritense.buildingblock.web.rest.dto.UpdateBuildingBlockFormDefinitionDto
import com.ritense.form.domain.FormDefinition
import com.ritense.form.web.rest.dto.FormOption
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api/management/v1/building-block", produces = [APPLICATION_JSON_UTF8_VALUE])
class BuildingBlockFormManagementResource(
    private val buildingBlockFormDefinitionService: BuildingBlockFormDefinitionService
) {

    @GetMapping("/{key}/version/{versionTag}/form-option")
    fun getFormOptions(
        @PathVariable key: String,
        @PathVariable versionTag: String,
    ): ResponseEntity<List<FormOption>> {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        return ResponseEntity.ok(
            buildingBlockFormDefinitionService.getFormOptions(buildingBlockId)
        )
    }

    @GetMapping("/{key}/version/{versionTag}/form")
    fun getFormDefinitions(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @RequestParam("searchTerm", required = false) searchTerm: String?,
        pageable: Pageable
    ): ResponseEntity<Page<out FormDefinition>> {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        return ResponseEntity.ok(
            buildingBlockFormDefinitionService.queryFormDefinitions(buildingBlockId, searchTerm, pageable)
        )
    }

    @GetMapping("/{key}/version/{versionTag}/form/{formDefinitionId}")
    fun getFormDefinition(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @PathVariable formDefinitionId: UUID
    ): ResponseEntity<BuildingBlockFormDefinitionDto> {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        val form = buildingBlockFormDefinitionService.getFormDefinitionById(buildingBlockId, formDefinitionId)
            .orElse(null) ?: return ResponseEntity.notFound().build()

        return ResponseEntity.ok(BuildingBlockFormDefinitionDto.from(form))
    }

    @GetMapping("/{key}/version/{versionTag}/form/name/{name}")
    fun getFormDefinitionByName(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @PathVariable name: String
    ): ResponseEntity<BuildingBlockFormDefinitionDto> {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        val form = buildingBlockFormDefinitionService.getFormDefinitionByName(buildingBlockId, name)
            .orElse(null) ?: return ResponseEntity.notFound().build()

        return ResponseEntity.ok(BuildingBlockFormDefinitionDto.from(form))
    }

    @GetMapping("/{key}/version/{versionTag}/form/{name}/exists")
    fun formDefinitionExists(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @PathVariable name: String
    ): ResponseEntity<Boolean> {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        return ResponseEntity.ok(
            buildingBlockFormDefinitionService.getFormDefinitionByName(buildingBlockId, name).isPresent
        )
    }

    @PostMapping("/{key}/version/{versionTag}/form")
    fun createFormDefinition(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @RequestBody request: CreateBuildingBlockFormDefinitionDto
    ): ResponseEntity<BuildingBlockFormDefinitionDto> {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        val form = buildingBlockFormDefinitionService.createFormDefinition(
            buildingBlockId,
            request.name,
            request.formDefinition,
            request.isReadOnly ?: false
        )
        return ResponseEntity.ok(BuildingBlockFormDefinitionDto.from(form))
    }

    @PutMapping("/{key}/version/{versionTag}/form/{formDefinitionId}")
    fun updateFormDefinition(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @PathVariable formDefinitionId: UUID,
        @RequestBody request: UpdateBuildingBlockFormDefinitionDto
    ): ResponseEntity<BuildingBlockFormDefinitionDto> {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        val form = buildingBlockFormDefinitionService.updateFormDefinition(
            buildingBlockId,
            formDefinitionId,
            request.name,
            request.formDefinition
        )
        return ResponseEntity.ok(BuildingBlockFormDefinitionDto.from(form))
    }

    @DeleteMapping("/{key}/version/{versionTag}/form/{formDefinitionId}")
    fun deleteFormDefinition(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @PathVariable formDefinitionId: UUID
    ): ResponseEntity<Void> {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        buildingBlockFormDefinitionService.deleteFormDefinition(buildingBlockId, formDefinitionId)
        return ResponseEntity.noContent().build()
    }
}
