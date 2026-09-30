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

package com.ritense.deployerapi.web.rest

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case.web.rest.dto.CaseDefinitionImportResponse
import com.ritense.case.web.rest.dto.CaseDefinitionResponseDto
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.deployerapi.web.rest.dto.ImportRequestDto
import com.ritense.exporter.ExportService
import com.ritense.exporter.request.CaseDefinitionExportRequest
import com.ritense.importer.ImportService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import io.swagger.v3.oas.annotations.media.ArraySchema
import io.swagger.v3.oas.annotations.media.Content
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@RestController
@SkipComponentScan
@RequestMapping("/api/deployer/v1", produces = [APPLICATION_JSON_UTF8_VALUE])
class DeployerCaseDefinitionResource(
    private val caseDefinitionService: CaseDefinitionService,
    private val exportService: ExportService,
    private val importService: ImportService,
    private val caseDefinitionRepository: CaseDefinitionRepository,
) {

    @GetMapping("/case-definition")
    @DeployerApiResponses
    @ApiResponse(
        responseCode = "200",
        description = "OK",
        content = [Content(
            mediaType = MediaType.APPLICATION_JSON_VALUE,
            array = ArraySchema(schema = Schema(implementation = CaseDefinitionResponseDto::class))
        )]
    )
    @RunWithoutAuthorization
    fun getCaseDefinitions(
        @RequestParam(required = false) caseDefinitionKey: String?,
        @RequestParam(required = false, defaultValue = "true") active: Boolean,
        @RequestParam(required = false) final: Boolean?,
    ): ResponseEntity<List<CaseDefinitionResponseDto>> {
        val caseDefinitions = caseDefinitionService.getCaseDefinitions(
            caseDefinitionKey = caseDefinitionKey,
            active = active,
            final = final,
        )
        return ResponseEntity.ok(caseDefinitions.map { CaseDefinitionResponseDto.of(it) })
    }

    @GetMapping(
        "/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/export",
        produces = [MediaType.APPLICATION_OCTET_STREAM_VALUE]
    )
    @DeployerApiResponses
    @ApiResponse(
        responseCode = "200",
        description = "OK",
        content = [Content(
            mediaType = MediaType.APPLICATION_OCTET_STREAM_VALUE,
            schema = Schema(type = "string", format = "binary")
        )]
    )
    @RunWithoutAuthorization
    fun getExport(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
    ): ResponseEntity<ByteArray> {
        val baos = exportService
            .export(CaseDefinitionExportRequest(CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)))
        val timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm"))
        val fileName = "${caseDefinitionKey}_${caseDefinitionVersionTag}_$timestamp.case.zip"
        return ResponseEntity
            .ok()
            .header("Content-Disposition", "attachment;filename=$fileName")
            .body(baos.toByteArray())
    }

    @PostMapping("/case-definition/import", consumes = [MediaType.APPLICATION_JSON_VALUE])
    @DeployerApiResponses
    @ApiResponse(
        responseCode = "200",
        description = "OK",
        content = [Content(
            mediaType = MediaType.APPLICATION_JSON_VALUE,
            schema = Schema(implementation = CaseDefinitionImportResponse::class)
        )]
    )
    @RunWithoutAuthorization
    fun import(
        @RequestBody body: ImportRequestDto,
        @RequestParam("key", required = false) key: String?,
        @RequestParam("name", required = false) name: String?,
    ): ResponseEntity<CaseDefinitionImportResponse> {
        val skipImportOfCaseDefinitions = caseDefinitionRepository.findAllByFinalTrue().map { it.id }
        val caseDefinitionId = importService.import(
            body.file.inputStream(),
            skipImportOfCaseDefinitions,
            key,
            name,
            body.pluginConfigurationMappings,
        )
        caseDefinitionService.setLatestToActiveIfNoneIsActive()
        return ResponseEntity.ok(CaseDefinitionImportResponse(caseDefinitionId))
    }
}
