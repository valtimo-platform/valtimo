/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.zakenapi.web.rest

import com.ritense.document.domain.RelatedFile
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.documentenapi.web.rest.dto.DocumentSearchRequest
import com.ritense.documentenapi.web.rest.dto.DocumentenApiDocumentDto
import com.ritense.documentenapi.web.rest.dto.ModifyDocumentRequest
import com.ritense.logging.LoggableResource
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.zakenapi.domain.ZaakResponse
import com.ritense.zakenapi.service.ZaakDocumentService
import org.springframework.core.io.InputStreamResource
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.net.URLConnection
import org.springframework.http.ContentDisposition
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping(value = ["/api"], produces = [APPLICATION_JSON_UTF8_VALUE])
class ZaakDocumentResource(
    private val zaakDocumentService: ZaakDocumentService
) {

    @DeleteMapping("/v1/zaken-api/{caseDocumentId}/{pluginConfigurationId}/files/{documentId}")
    fun deleteDocument(
        @LoggableResource(resourceType = PluginConfiguration::class) @PathVariable(name = "pluginConfigurationId") pluginConfigurationId: String,
        @PathVariable(name = "caseDocumentId") caseDocumentId: UUID,
        @PathVariable(name = "documentId") documentId: String,
    ): ResponseEntity<Unit> {
        zaakDocumentService.deleteInformatieObject(
            pluginConfigurationId,
            caseDocumentId,
            documentId)
        return ResponseEntity
            .noContent()
            .build()
    }

    @PutMapping("/v1/zaken-api/{caseDocumentId}/{pluginConfigurationId}/files/{documentId}")
    fun modifyDocument(
        @PathVariable(name = "caseDocumentId") caseDocumentId: UUID,
        @LoggableResource(resourceType = PluginConfiguration::class) @PathVariable(name = "pluginConfigurationId") pluginConfigurationId: String,
        @PathVariable(name = "documentId") documentId: String,
        @RequestBody modifyDocumentRequest: ModifyDocumentRequest,
    ): ResponseEntity<RelatedFile> {
        return ResponseEntity
            .ok()
            .body(zaakDocumentService.modifyInformatieObject(
                pluginConfigurationId,
                caseDocumentId,
                documentId,
                modifyDocumentRequest)
            )
    }

    @GetMapping("/v1/zaken-api/document/{caseDocumentId}/files")
    fun getFiles(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable(name = "caseDocumentId") caseDocumentId: UUID
    ): List<RelatedFile> {
        return zaakDocumentService.getInformatieObjectenAsRelatedFiles(caseDocumentId)
    }

    @GetMapping("/v1/zaken-api/{caseDocumentId}/{pluginConfigurationId}/files/{documentId}/download")
    fun downloadDocument(
        @PathVariable(name = "caseDocumentId") caseDocumentId: UUID,
        @LoggableResource(resourceType = PluginConfiguration::class) @PathVariable(name = "pluginConfigurationId") pluginConfigurationId: String,
        @PathVariable(name = "documentId") documentId: String,
    ): ResponseEntity<InputStreamResource> {

        val documentInputStream = zaakDocumentService.downloadInformatieObject(pluginConfigurationId, caseDocumentId, documentId)
        val documentMetadata = zaakDocumentService.getInformatieObject(pluginConfigurationId,caseDocumentId, documentId)

        val responseHeaders = HttpHeaders()
        val contentDisposition = ContentDisposition.attachment().filename(documentMetadata.bestandsnaam).build()
        responseHeaders.contentDisposition = contentDisposition

        val documentMediaType = try {
            MediaType.valueOf(URLConnection.guessContentTypeFromName(documentMetadata.bestandsnaam))
        } catch (exception: RuntimeException) {
            MediaType.APPLICATION_OCTET_STREAM
        }
        return ResponseEntity
            .ok()
            .headers(responseHeaders)
            .contentType(documentMediaType)
            .body(InputStreamResource(documentInputStream))
    }

    @GetMapping("/v2/zaken-api/document/{caseDocumentId}/files")
    fun getFiles(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable(name = "caseDocumentId") caseDocumentId: UUID,
        documentSearchRequest: DocumentSearchRequest,
        pageable: Pageable,
    ): Page<DocumentenApiDocumentDto> {
        return zaakDocumentService.getInformatieObjectenAsRelatedFilesPage(caseDocumentId, documentSearchRequest, pageable)
    }

    @GetMapping("/v1/zaken-api/document/{caseDocumentId}/zaak")
    fun getZaakMetadata(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable(name = "caseDocumentId") caseDocumentId: UUID
    ): ZaakResponse? {
        return zaakDocumentService.getZaakByCaseDocumentId(caseDocumentId)
    }
}
