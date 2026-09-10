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

package com.ritense.documentenapipreview.web.rest

import com.ritense.documentenapipreview.service.DocumentenApiPreviewService
import com.ritense.logging.LoggableResource
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import org.springframework.core.io.InputStreamResource
import org.springframework.http.ContentDisposition
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.nio.charset.StandardCharsets
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class DocumentenApiPreviewResource(
    private val documentenApiPreviewService: DocumentenApiPreviewService
) {
    @EndpointDescription(
        en = "Get a document preview",
        nl = "Voorbeeld van een document ophalen",
    )
    @GetMapping("/v1/documenten-api-preview/{pluginConfigurationId}/preview/{caseDocumentId}/{documentId}")
    fun preview(
        @LoggableResource(resourceType = PluginConfiguration::class) @PathVariable(name = "pluginConfigurationId") pluginConfigurationId: String,
        @PathVariable(name = "caseDocumentId") caseDocumentId: UUID,
        @PathVariable(name = "documentId") documentId: String,
    ): ResponseEntity<InputStreamResource> {
        val pdfFile = documentenApiPreviewService.generatePreview(pluginConfigurationId, caseDocumentId, documentId)

        return ResponseEntity
            .ok()
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF.toString())
            .header(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment()
                    .filename(pdfFile.fileName, StandardCharsets.UTF_8)
                    .build()
                    .toString()
                )
            .body(InputStreamResource(pdfFile.content))
    }

    @EndpointDescription(
        en = "Check if document preview is configured",
        nl = "Controleren of het documentvoorbeeld is geconfigureerd",
    )
    @GetMapping("/v1/documenten-api-preview/configuration-exists/{documentenApiConfigurationId}")
    fun isPreviewConfigured(
        @PathVariable(name = "documentenApiConfigurationId") documentenApiConfigurationId: String,
    ): ResponseEntity<Boolean> {
        return ResponseEntity.ok(
            documentenApiPreviewService.isPreviewConfigured(documentenApiConfigurationId)
        )
    }
}