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

package com.ritense.case.web.rest

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.case.exception.UnknownCaseDefinitionException
import com.ritense.case.repository.CaseDefinitionConfigurationIssueRepository
import com.ritense.case.service.CaseDefinitionImportPreviewService
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case.service.finalization.CaseDefinitionFinalizationCheckResult
import com.ritense.case.web.rest.dto.CaseDefinitionCheckResponse
import com.ritense.case.web.rest.dto.CaseDefinitionConfigurationIssueDto
import com.ritense.case.web.rest.dto.CaseDefinitionDraftCreateRequest
import com.ritense.case.web.rest.dto.CaseDefinitionImportPreviewResponse
import com.ritense.case.web.rest.dto.CaseDefinitionImportResponse
import com.ritense.case.web.rest.dto.CaseDefinitionResponseDto
import com.ritense.case.web.rest.dto.CaseDefinitionSettingsResponseDto
import com.ritense.case.web.rest.dto.CaseDefinitionUpdateRequest
import com.ritense.case.web.rest.dto.CaseListColumnDto
import com.ritense.case.web.rest.dto.CaseSettingsDto
import com.ritense.case.web.rest.dto.CaseVersionDto
import com.ritense.case.web.rest.dto.HiddenCaseListColumnDto
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.case_.service.ActiveCaseDefinitionService
import com.ritense.exporter.ExportService
import com.ritense.exporter.request.CaseDefinitionExportRequest
import com.ritense.importer.ImportService
import com.ritense.importer.exception.ImportServiceException
import com.ritense.logging.LoggableResource
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.authorization.UserManagementServiceHolder
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import com.ritense.valtimo.contract.plugin.DanglingPluginConfigurationDto
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.validation.Valid
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.web.PageableDefault
import org.springframework.data.web.SortDefault
import org.springframework.data.web.SortDefault.SortDefaults
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.multipart.MultipartFile
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.UUID

@Controller
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class CaseDefinitionResource(
    private val service: CaseDefinitionService,
    private val activeCaseDefinitionService: ActiveCaseDefinitionService,
    private val exportService: ExportService,
    private val importService: ImportService,
    private val caseDefinitionRepository: CaseDefinitionRepository,
    private val caseDefinitionChecker: CaseDefinitionChecker,
    private val configurationIssueRepository: CaseDefinitionConfigurationIssueRepository,
    private val caseDefinitionImportPreviewService: CaseDefinitionImportPreviewService,
    private val pluginConfigurationMappingResolver: PluginConfigurationMappingResolver?,
) {

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Get case definition",
        nl = "Dossierdefinitie ophalen",
    )
    @GetMapping("/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}")
    fun getCaseDefinition(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("versionTag") @PathVariable versionTag: String,
    ): ResponseEntity<CaseDefinitionResponseDto> {
        val caseDefinition = service.getCaseDefinition(CaseDefinitionId.of(caseDefinitionKey, versionTag))
        val similarCaseDefinitions = caseDefinition.basedOnVersionTag?.let {
            service.getCaseDefinitionsBasedOnVersion(caseDefinitionKey, caseDefinition.basedOnVersionTag)
                .filter { it.id != caseDefinition.id }
        } ?: emptyList()
        val conflictingVersions = if (similarCaseDefinitions.isNotEmpty()) {
            similarCaseDefinitions.joinToString { it.id.versionTag.toString() }
        } else {
            null
        }
        return ResponseEntity.ok(CaseDefinitionResponseDto.of(caseDefinition, conflictingVersions))
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Create case definition draft",
        nl = "Concept dossierdefinitie aanmaken",
    )
    @PostMapping("/management/v1/case-definition/draft")
    fun createCaseDefinitionDraft(
        @Valid @RequestBody request: CaseDefinitionDraftCreateRequest
    ): ResponseEntity<CaseDefinitionResponseDto> {
        return ResponseEntity.ok(
            CaseDefinitionResponseDto.of(
                service.createCaseDefinitionDraft(request)
            )
        )
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Delete case definition",
        nl = "Dossierdefinitie verwijderen",
    )
    @DeleteMapping("/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}")
    fun deleteCaseDefinition(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("versionTag") @PathVariable versionTag: String,
    ): ResponseEntity<Unit> {
        service.deleteCaseDefinition(CaseDefinitionId.of(caseDefinitionKey, versionTag))
        return ResponseEntity.ok().build()
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Update case definition",
        nl = "Dossierdefinitie bijwerken",
    )
    @PatchMapping("/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}")
    fun updateCaseDefinition(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("versionTag") @PathVariable versionTag: String,
        @Valid @RequestBody request: CaseDefinitionUpdateRequest
    ): ResponseEntity<CaseDefinitionResponseDto> {
        val caseDefinition = service.updateCaseDefinition(
            CaseDefinitionId.of(caseDefinitionKey, versionTag),
            request.name,
            request.description
        )
        return ResponseEntity.ok(CaseDefinitionResponseDto.of(caseDefinition))
    }

    @EndpointDescription(
        en = "List case definitions",
        nl = "Dossierdefinities ophalen",
    )
    @GetMapping("/v1/case-definition")
    fun getCaseDefinitions(
        @RequestParam caseDefinitionKey: String?,
        @RequestParam active: Boolean?,
        @RequestParam final: Boolean?,
    ): ResponseEntity<List<CaseDefinitionResponseDto>> {
        val caseDefinitions = service.getCaseDefinitions(
            caseDefinitionKey = caseDefinitionKey,
            active = active,
            final = final,
        )
        return ResponseEntity.ok(caseDefinitions.map { CaseDefinitionResponseDto.of(it) })
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "List case definitions",
        nl = "Dossierdefinities ophalen",
    )
    @GetMapping("/management/v1/case-definition")
    fun getCaseDefinitionsForManagement(
        @RequestParam caseDefinitionKey: String?,
        @RequestParam active: Boolean?,
        @RequestParam final: Boolean?,
        @SortDefaults(
            SortDefault(sort = ["name"]),
            SortDefault(sort = ["active", "id.versionTag"], direction = Sort.Direction.DESC)
        ) pageable: Pageable
    ): ResponseEntity<Page<CaseDefinitionResponseDto>> {
        val caseDefinitions = service.getCaseDefinitionsForManagement(
            caseDefinitionKey = caseDefinitionKey,
            active = active,
            final = final,
            pageable = pageable
        )
        val caseDefinitionIds = caseDefinitions.content.map { it.id }
        val idsWithIssues = if (caseDefinitionIds.isNotEmpty()) {
            configurationIssueRepository.findCaseDefinitionIdsWithUnresolvedIssues(caseDefinitionIds)
        } else {
            emptySet()
        }
        return ResponseEntity.ok(caseDefinitions.map {
            CaseDefinitionResponseDto.of(it, hasConfigurationIssues = it.id in idsWithIssues)
        })
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "List case definition versions",
        nl = "Versies van dossierdefinitie ophalen",
    )
    @GetMapping("/management/v1/case-definition/{caseDefinitionKey}/version")
    fun getCaseDefinitionVersions(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @PageableDefault(size = 5, sort = ["active", "id.versionTag"], direction = Sort.Direction.DESC)
        pageable: Pageable
    ): ResponseEntity<List<CaseVersionDto>> {
        val caseDefinitions = service.getCaseDefinitions(caseDefinitionKey = caseDefinitionKey, pageable = pageable)
        return ResponseEntity.ok(caseDefinitions.map { CaseVersionDto.of(it) }.content)
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Finalize case definition",
        nl = "Dossierdefinitie definitief maken",
    )
    @PostMapping("/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/finalize")
    fun finalizeCaseDefinition(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("versionTag") @PathVariable versionTag: String,
    ): ResponseEntity<CaseDefinitionResponseDto> {
        return ResponseEntity.ok(
            CaseDefinitionResponseDto.of(
                service.finalizeCaseDefinition(CaseDefinitionId.of(caseDefinitionKey, versionTag))
            )
        )
    }

    @EndpointDescription(
        en = "Get case settings",
        nl = "Dossierinstellingen ophalen",
    )
    @GetMapping("/v1/case-definition/{caseDefinitionKey}/settings")
    fun getCaseSettings(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
    ): ResponseEntity<CaseDefinitionSettingsResponseDto> {
        return try {
            ResponseEntity.ok(
                CaseDefinitionSettingsResponseDto.of(
                    activeCaseDefinitionService.getActiveCaseDefinition(caseDefinitionKey)
                )
            )
        } catch (exception: UnknownCaseDefinitionException) {
            ResponseEntity.notFound().build()
        }
    }

    @EndpointDescription(
        en = "Get case settings",
        nl = "Dossierinstellingen ophalen",
    )
    @GetMapping("/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/settings")
    @RunWithoutAuthorization
    fun getCaseSettingsForManagement(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("caseDefinitionVersionTag") @PathVariable caseDefinitionVersionTag: String,
    ): ResponseEntity<CaseDefinitionSettingsResponseDto> {
        return try {
            ResponseEntity.ok(
                CaseDefinitionSettingsResponseDto.of(
                    service.getCaseDefinition(CaseDefinitionId.of(caseDefinitionKey, caseDefinitionVersionTag))
                )
            )
        } catch (exception: UnknownCaseDefinitionException) {
            ResponseEntity.notFound().build()
        }
    }

    @EndpointDescription(
        en = "Update case settings",
        nl = "Dossierinstellingen bijwerken",
    )
    @PatchMapping("/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/settings")
    @RunWithoutAuthorization
    fun updateCaseSettingsForManagement(
        @Valid @RequestBody caseSettingsDto: CaseSettingsDto,
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("caseDefinitionVersionTag") @PathVariable caseDefinitionVersionTag: String,
    ): ResponseEntity<CaseDefinitionSettingsResponseDto> {
        return try {
            ResponseEntity.ok(
                CaseDefinitionSettingsResponseDto.of(
                    service.updateCaseSettings(
                        CaseDefinitionId.of(caseDefinitionKey, caseDefinitionVersionTag),
                        caseSettingsDto
                    )
                )
            )
        } catch (exception: UnknownCaseDefinitionException) {
            ResponseEntity.notFound().build()
        }
    }

    @EndpointDescription(
        en = "Get active case definition",
        nl = "Actieve dossierdefinitie ophalen",
    )
    @GetMapping("/management/v1/case-definition/{caseDefinitionKey}")
    @RunWithoutAuthorization
    fun getActive(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
    ): ResponseEntity<CaseDefinitionResponseDto> {
        return try {
            val caseDefinition = activeCaseDefinitionService.getActiveCaseDefinition(caseDefinitionKey)
            ResponseEntity.ok(CaseDefinitionResponseDto.of(caseDefinition))
        } catch (exception: UnknownCaseDefinitionException) {
            ResponseEntity.notFound().build()
        }
    }

    @EndpointDescription(
        en = "Set active case definition",
        nl = "Actieve dossierdefinitie instellen",
    )
    @PostMapping("/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/active")
    @RunWithoutAuthorization
    fun setActive(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("caseDefinitionVersionTag") @PathVariable caseDefinitionVersionTag: String,
    ): ResponseEntity<CaseDefinitionResponseDto> {
        return try {
            ResponseEntity.ok(
                CaseDefinitionResponseDto.of(
                    activeCaseDefinitionService.setGlobalActiveCaseDefinition(
                        CaseDefinitionId.of(caseDefinitionKey, caseDefinitionVersionTag)
                    )
                )
            )
        } catch (exception: UnknownCaseDefinitionException) {
            ResponseEntity.notFound().build()
        }
    }

    @EndpointDescription(
        en = "List hidden case list columns",
        nl = "Verborgen dossierlijstkolommen ophalen",
    )
    @GetMapping("/v1/case/{caseDefinitionName}/hidden-list-column")
    fun getHiddenCaseListColumnForUser(
        @LoggableResource("documentDefinitionName") @PathVariable caseDefinitionName: String
    ): ResponseEntity<List<CaseListColumnDto>> {
        val currentUserId = UserManagementServiceHolder.currentInstance.currentUserId
        return ResponseEntity
            .ok()
            .body(
                service.getHiddenCaseListColumns(
                    caseDefinitionName, currentUserId
                )
            )
    }

    @EndpointDescription(
        en = "Save hidden case list columns",
        nl = "Verborgen dossierlijstkolommen opslaan",
    )
    @PostMapping("/v1/case/{caseDefinitionName}/hidden-list-column")
    fun setHiddenListColumnsForUser(
        @LoggableResource("documentDefinitionName") @PathVariable caseDefinitionName: String,
        @Valid @RequestBody hiddenCaseListColumnDtoList: List<HiddenCaseListColumnDto>
    ): ResponseEntity<Any> {
        val currentUserId = UserManagementServiceHolder.currentInstance.currentUserId
        service.saveHiddenCaseListColumns(caseDefinitionName, hiddenCaseListColumnDtoList, currentUserId)
        return ResponseEntity.ok().build()
    }

    @EndpointDescription(
        en = "List case list columns",
        nl = "Dossierlijstkolommen ophalen",
    )
    @GetMapping("/v1/case/{caseDefinitionName}/list-column")
    fun getCaseListColumn(
        @LoggableResource("documentDefinitionName") @PathVariable caseDefinitionName: String
    ): ResponseEntity<List<CaseListColumnDto>> {
        return ResponseEntity.ok().body(service.getListColumns(caseDefinitionName))
    }

    @EndpointDescription(
        en = "List case list columns",
        nl = "Dossierlijstkolommen ophalen",
    )
    @GetMapping("/management/v1/case/{caseDefinitionName}/list-column")
    @RunWithoutAuthorization
    fun getCaseListColumnForManagement(
        @LoggableResource("documentDefinitionName") @PathVariable caseDefinitionName: String
    ): ResponseEntity<List<CaseListColumnDto>> = getCaseListColumn(caseDefinitionName)

    @EndpointDescription(
        en = "Create case list column",
        nl = "Dossierlijstkolom aanmaken",
    )
    @PostMapping("/management/v1/case/{caseDefinitionName}/list-column")
    @RunWithoutAuthorization
    fun createCaseListColumnForManagement(
        @LoggableResource("documentDefinitionName") @PathVariable caseDefinitionName: String,
        @Valid @RequestBody caseListColumnDto: CaseListColumnDto
    ): ResponseEntity<Any> {
        service.createListColumn(caseDefinitionName, caseListColumnDto)
        return ResponseEntity.ok().build()
    }

    @EndpointDescription(
        en = "Update case list columns",
        nl = "Dossierlijstkolommen bijwerken",
    )
    @PutMapping("/management/v1/case/{caseDefinitionName}/list-column")
    @RunWithoutAuthorization
    fun updateListColumnForManagement(
        @LoggableResource("documentDefinitionName") @PathVariable caseDefinitionName: String,
        @Valid @RequestBody caseListColumnDtoList: List<CaseListColumnDto>
    ): ResponseEntity<Any> {
        service.updateListColumns(caseDefinitionName, caseListColumnDtoList)
        return ResponseEntity.ok().build()
    }

    @EndpointDescription(
        en = "Delete case list column",
        nl = "Dossierlijstkolom verwijderen",
    )
    @DeleteMapping("/management/v1/case/{caseDefinitionName}/list-column/{columnKey}")
    @RunWithoutAuthorization
    fun deleteListColumnForManagement(
        @LoggableResource("documentDefinitionName") @PathVariable caseDefinitionName: String,
        @PathVariable columnKey: String
    ): ResponseEntity<Any> {
        service.deleteCaseListColumn(caseDefinitionName, columnKey)
        return ResponseEntity.noContent().build()
    }

    @EndpointDescription(
        en = "Export case definition",
        nl = "Dossierdefinitie exporteren",
    )
    @GetMapping(
        "/management/v1/case/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/export",
        produces = [MediaType.APPLICATION_OCTET_STREAM_VALUE]
    )
    @RunWithoutAuthorization
    fun getExport(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("caseDefinitionVersionTag") @PathVariable caseDefinitionVersionTag: String,
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

    @EndpointDescription(
        en = "Preview case definition import",
        nl = "Voorbeeld van dossierdefinitie-import ophalen",
    )
    @PostMapping("/management/v1/case/import/preview")
    @RunWithoutAuthorization
    fun importPreview(
        @RequestParam("file") file: MultipartFile
    ): ResponseEntity<CaseDefinitionImportPreviewResponse> {
        return try {
            val preview = caseDefinitionImportPreviewService.preview(file.inputStream)
            ResponseEntity.ok(preview)
        } catch (exception: ImportServiceException) {
            logger.info(exception) { "Import preview failed" }
            ResponseEntity.badRequest().build()
        }
    }

    @EndpointDescription(
        en = "Import case definition",
        nl = "Dossierdefinitie importeren",
    )
    @PostMapping("/management/v1/case/import")
    @RunWithoutAuthorization
    fun import(
        @RequestParam("file") file: MultipartFile,
        @RequestParam("key", required = false) key: String?,
        @RequestParam("name", required = false) name: String?,
        @RequestPart("pluginConfigurationMappings", required = false) pluginConfigurationMappingsJson: String?,
    ): ResponseEntity<CaseDefinitionImportResponse> {
        return try {
            val pluginConfigurationMappings: Map<UUID, UUID?>? = pluginConfigurationMappingsJson?.let {
                jacksonObjectMapper().readValue<Map<UUID, UUID?>>(it)
            }
            val skipImportOfCaseDefinitions = caseDefinitionRepository.findAllByFinalTrue().map { it.id }
            val caseDefinitionId = importService.import(
                file.inputStream,
                skipImportOfCaseDefinitions,
                key,
                name,
                pluginConfigurationMappings,
            )
            service.setLatestToActiveIfNoneIsActive()
            ResponseEntity.ok(CaseDefinitionImportResponse(caseDefinitionId))
        } catch (exception: ImportServiceException) {
            logger.info(exception) { "Import failed" }
            ResponseEntity.badRequest().build()
        }
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "List configuration issues for case definition",
        nl = "Configuratieproblemen voor dossierdefinitie ophalen",
    )
    @GetMapping("/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/configuration-issues")
    fun getConfigurationIssues(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("caseDefinitionVersionTag") @PathVariable caseDefinitionVersionTag: String,
    ): ResponseEntity<List<CaseDefinitionConfigurationIssueDto>> {
        val caseDefinitionId = CaseDefinitionId.of(caseDefinitionKey, caseDefinitionVersionTag)
        val issues = configurationIssueRepository.findAllByCaseDefinitionId(caseDefinitionId)
        return ResponseEntity.ok(issues.map { CaseDefinitionConfigurationIssueDto.of(it) })
    }

    @EndpointDescription(
        en = "List dangling plugin configurations for case definition",
        nl = "Losse pluginconfiguraties voor dossierdefinitie ophalen",
    )
    @GetMapping("/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/dangling-plugin-configurations")
    @RunWithoutAuthorization
    fun getDanglingPluginConfigurations(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("caseDefinitionVersionTag") @PathVariable caseDefinitionVersionTag: String,
    ): ResponseEntity<List<DanglingPluginConfigurationDto>> {
        val resolver = pluginConfigurationMappingResolver
            ?: return ResponseEntity.ok(emptyList())
        val caseDefinitionId = CaseDefinitionId.of(caseDefinitionKey, caseDefinitionVersionTag)
        return ResponseEntity.ok(resolver.getDanglingPluginConfigurations(caseDefinitionId))
    }

    @EndpointDescription(
        en = "Resolve plugin configuration mappings for case definition",
        nl = "Pluginconfiguratiekoppelingen voor dossierdefinitie toewijzen",
    )
    @PutMapping("/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/plugin-configuration-mappings")
    @RunWithoutAuthorization
    fun resolvePluginConfigurationMappings(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("caseDefinitionVersionTag") @PathVariable caseDefinitionVersionTag: String,
        @RequestBody mappings: Map<UUID, UUID>,
    ): ResponseEntity<Void> {
        val resolver = pluginConfigurationMappingResolver
            ?: return ResponseEntity.status(501).build()
        val caseDefinitionId = CaseDefinitionId.of(caseDefinitionKey, caseDefinitionVersionTag)
        resolver.resolve(caseDefinitionId, mappings)
        return ResponseEntity.noContent().build()
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Check case definition capabilities",
        nl = "Mogelijkheden van dossierdefinitie controleren",
    )
    @GetMapping("/management/v1/case-definition/check")
    fun checkCaseDefinition(): ResponseEntity<CaseDefinitionCheckResponse> {
        return ResponseEntity.ok(
            CaseDefinitionCheckResponse(
                canUpdateGlobalConfiguration = caseDefinitionChecker.canUpdateGlobalConfiguration(),
            )
        )
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Check if case definition is finalizable",
        nl = "Controleren of dossierdefinitie afrondbaar is",
    )
    @GetMapping("/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/finalizable")
    fun checkIfCaseDefinitionIsFinalizable(
        @LoggableResource("caseDefinitionKey") @PathVariable caseDefinitionKey: String,
        @LoggableResource("caseDefinitionVersionTag") @PathVariable caseDefinitionVersionTag: String,
    ): ResponseEntity<CaseDefinitionFinalizationCheckResult> {
        val caseDefinitionId = CaseDefinitionId.of(caseDefinitionKey, caseDefinitionVersionTag)
        val result = service.isCaseDefinitionFinalizable(caseDefinitionId)
        return ResponseEntity.ok(result)
    }

    companion object {
        val logger = KotlinLogging.logger {}
    }
}
