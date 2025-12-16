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
import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.service.BuildingBlockManagementService
import com.ritense.buildingblock.web.rest.dto.BuildingBlockDefinitionDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionDto
import com.ritense.buildingblock.web.rest.dto.CreateBuildingBlockDefinitionDto
import com.ritense.buildingblock.web.rest.dto.UpdateBuildingBlockDefinitionDto
import com.ritense.case.web.rest.CaseDefinitionResource.Companion.logger
import com.ritense.exporter.ExportService
import com.ritense.exporter.request.BuildingBlockDefinitionExportRequest
import com.ritense.exporter.request.CaseDefinitionExportRequest
import com.ritense.importer.ImportService
import com.ritense.importer.exception.ImportServiceException
import com.ritense.logging.LoggableResource
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.web.PageableDefault
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@RestController
@SkipComponentScan
@RequestMapping("/api/management/v1/building-block", produces = [APPLICATION_JSON_UTF8_VALUE])
class BuildingBlockManagementResource(
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    private val buildingBlockManagementService: BuildingBlockManagementService,
    private val importService: ImportService,
    private val exportService: ExportService,
) {
    @GetMapping
    fun getBuildingBlockDefinitions(
        @RequestParam(value = "includeArtwork", required = false) includeArtwork: Boolean = false,
    ): ResponseEntity<List<BuildingBlockDefinitionDto>> {
        val dtoList = runWithoutAuthorization { buildingBlockManagementService.getLatestPerKey(includeArtwork) }
        return if (dtoList.isEmpty()) {
            ResponseEntity.notFound().build()
        } else {
            ResponseEntity.ok(dtoList)
        }
    }

    @PostMapping(consumes = [APPLICATION_JSON_UTF8_VALUE])
    fun createBuildingBlockDefinition(
        @RequestBody dto: CreateBuildingBlockDefinitionDto
    ): ResponseEntity<BuildingBlockDefinitionDto> {
        val savedDto = runWithoutAuthorization { buildingBlockManagementService.create(dto) }
        return ResponseEntity.ok(savedDto)
    }

    @GetMapping("/{key}/version/{versionTag}")
    fun getBuildingBlockDefinition(
        @PathVariable key: String,
        @PathVariable versionTag: String
    ): ResponseEntity<BuildingBlockDefinitionDto> {
        val id = BuildingBlockDefinitionId(key, versionTag)
        val entity = buildingBlockDefinitionRepository.findById(id).orElse(null)
        return entity?.let { ResponseEntity.ok(it.toDto()) }
            ?: ResponseEntity.notFound().build()
    }

    @PutMapping("/{key}/version/{versionTag}", consumes = [APPLICATION_JSON_UTF8_VALUE])
    fun updateBuildingBlockDefinition(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @RequestBody dto: UpdateBuildingBlockDefinitionDto
    ): ResponseEntity<BuildingBlockDefinitionDto> {
        val updated = runWithoutAuthorization { buildingBlockManagementService.update(key, versionTag, dto) }
        return ResponseEntity.ok(updated)
    }

    @PostMapping("/{key}/version/{versionTag}/finalize")
    fun finalizeBuildingBlockDefinition(
        @PathVariable key: String,
        @PathVariable versionTag: String
    ): ResponseEntity<BuildingBlockDefinitionDto> {
        val finalized = runWithoutAuthorization { buildingBlockManagementService.finalize(key, versionTag) }
        return ResponseEntity.ok(finalized)
    }

    @PostMapping("/import")
    @RunWithoutAuthorization
    fun import(
        @RequestParam("file") file: MultipartFile
    ): ResponseEntity<Unit> {
        return try {
            importService.importBuildingBlockDefinitions(file.inputStream, buildingBlockDefinitionRepository.findAll().map { it.id })
            ResponseEntity.ok().build()
        } catch (exception: ImportServiceException) {
            logger.info(exception) { "Import failed" }
            ResponseEntity.badRequest().build()
        }
    }

    @GetMapping(
        "/{key}/version/{versionTag}/export",
        produces = [MediaType.APPLICATION_OCTET_STREAM_VALUE]
    )
    @RunWithoutAuthorization
    fun getExport(
        @LoggableResource("buildingBlockDefinitionKey") @PathVariable key: String,
        @LoggableResource("buildingBlockDefinitionVersionTag") @PathVariable versionTag: String,
    ): ResponseEntity<ByteArray> {
        val baos = exportService
            .export(BuildingBlockDefinitionExportRequest(BuildingBlockDefinitionId.of(key, versionTag)))
        val timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm"))
        val fileName = "${key}_${versionTag}_$timestamp.building-block.zip"
        return ResponseEntity
            .ok()
            .header("Content-Disposition", "attachment;filename=$fileName")
            .body(baos.toByteArray())
    }

    @GetMapping("/{key}/version")
    fun getBuildingBlockDefinitionVersions(
        @PathVariable key: String,
        @PageableDefault(size = 5, sort = ["id.versionTag"], direction = Sort.Direction.DESC)
        pageable: Pageable,
        @RequestParam(value = "all", required = false, defaultValue = "false") all: Boolean
    ): ResponseEntity<Page<BuildingBlockVersionDto>> {
        val versions = runWithoutAuthorization {
            if (all) {
                buildingBlockManagementService.getAllVersionsWithFinalFlag(key)
            } else {
                buildingBlockManagementService.getPagedVersionsWithFinalFlag(key, pageable)
            }
        }
        return ResponseEntity.ok(versions)
    }
}
