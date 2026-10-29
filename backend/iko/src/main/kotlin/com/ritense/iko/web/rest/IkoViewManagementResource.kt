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

package com.ritense.iko.web.rest

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.case.web.rest.CaseDefinitionResource.Companion.logger
import com.ritense.exporter.ExportService
import com.ritense.iko.exporter.IkoViewExportRequest
import com.ritense.iko.service.IkoViewService
import com.ritense.iko.web.rest.request.IkoViewCreateRequest
import com.ritense.iko.web.rest.request.IkoViewUpdateRequest
import com.ritense.iko.web.rest.response.IkoViewResponse
import com.ritense.importer.ImportService
import com.ritense.importer.exception.ImportServiceException
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import com.ritense.valtimo.contract.iko.PropertyField
import jakarta.validation.Valid
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort.Direction.ASC
import org.springframework.data.web.PageableDefault
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.multipart.MultipartFile

@Controller
@SkipComponentScan
@RequestMapping("/api/management", produces = [APPLICATION_JSON_UTF8_VALUE])
class IkoViewManagementResource(
    private val service: IkoViewService,
    private val exportService: ExportService,
    private val importService: ImportService,
) {

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Get IKO view property fields by type",
        nl = "Eigenschapsvelden van IKO-weergave ophalen per type",
    )
    @GetMapping("/v1/iko-property-fields/{type}/view")
    fun getIkoViewPropertyFields(
        @PathVariable type: String,
    ): ResponseEntity<List<PropertyField>> {
        return ResponseEntity.ok(service.getIkoViewPropertyFields(type))
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "List IKO views for management",
        nl = "IKO-weergaven ophalen voor beheer",
    )
    @GetMapping("/v1/iko-view")
    fun getIkoViewsForManagement(
        @RequestParam key: String?,
        @RequestParam title: String?,
        @RequestParam ikoRepositoryConfigKey: String?,
        @PageableDefault(sort = ["title"], direction = ASC) pageable: Pageable
    ): ResponseEntity<Page<IkoViewResponse>> {
        val ikoViews = service.findAll(
            key = key,
            title = title,
            ikoRepositoryConfigKey = ikoRepositoryConfigKey,
            pageable = pageable
        )
        return ResponseEntity.ok(ikoViews.map { IkoViewResponse.from(it) })
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Get IKO view by key",
        nl = "IKO-weergave ophalen op sleutel",
    )
    @GetMapping("/v1/iko-view/{key}")
    fun getIkoView(
        @PathVariable key: String,
    ): ResponseEntity<IkoViewResponse> {
        val ikoView = service.getByKey(key)
        return ResponseEntity.ok(IkoViewResponse.from(ikoView))
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Create IKO view",
        nl = "IKO-weergave aanmaken",
    )
    @PostMapping("/v1/iko-view/{key}")
    fun createIkoView(
        @PathVariable key: String,
        @Valid @RequestBody request: IkoViewCreateRequest
    ): ResponseEntity<IkoViewResponse> {
        val ikoView = service.createIkoView(
            key = key,
            ikoRepositoryConfigKey = request.ikoRepositoryConfigKey,
            title = request.title,
            properties = request.properties,
        )
        return ResponseEntity.ok(IkoViewResponse.from(ikoView))
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Update IKO view",
        nl = "IKO-weergave bijwerken",
    )
    @PutMapping("/v1/iko-view/{key}")
    fun updateIkoView(
        @PathVariable key: String,
        @Valid @RequestBody request: IkoViewUpdateRequest
    ): ResponseEntity<IkoViewResponse> {
        val ikoView = service.saveIkoView(
            key = key,
            title = request.title,
            ikoRepositoryConfigKey = request.ikoRepositoryConfigKey,
            properties = request.properties,
        )
        return ResponseEntity.ok(IkoViewResponse.from(ikoView))
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Delete IKO view",
        nl = "IKO-weergave verwijderen",
    )
    @DeleteMapping("/v1/iko-view/{key}")
    fun deleteIkoView(
        @PathVariable key: String,
    ): ResponseEntity<IkoViewResponse> {
        service.deleteIkoView(key)
        return ResponseEntity.noContent().build()
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Export IKO view",
        nl = "IKO-weergave exporteren",
    )
    @GetMapping(
        "/v1/iko-view/{key}/export",
        produces = [MediaType.APPLICATION_OCTET_STREAM_VALUE]
    )
    fun getExport(
        @PathVariable key: String,
    ): ResponseEntity<ByteArray> {
        val baos = exportService.export(IkoViewExportRequest(key))
        val timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm"))
        val fileName = "${key}_$timestamp.iko.zip"
        return ResponseEntity
            .ok()
            .header("Content-Disposition", "attachment;filename=$fileName")
            .body(baos.toByteArray())
    }

    @EndpointDescription(
        en = "Import IKO view",
        nl = "IKO-weergave importeren",
    )
    @PostMapping("/v1/iko-view/import")
    @RunWithoutAuthorization
    fun import(
        @RequestParam("file") file: MultipartFile
    ): ResponseEntity<Unit> {
        return try {
            importService.importGlobal(file.inputStream)
            ResponseEntity.ok().build()
        } catch (exception: ImportServiceException) {
            logger.error(exception) { "Import failed" }
            ResponseEntity.badRequest().build()
        }
    }
}
