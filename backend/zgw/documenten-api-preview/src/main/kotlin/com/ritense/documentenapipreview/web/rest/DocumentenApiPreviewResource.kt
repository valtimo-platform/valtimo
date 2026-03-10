package com.ritense.documentenapipreview.web.rest

import com.ritense.documentenapipreview.service.DocumentenApiPreviewService
import com.ritense.logging.LoggableResource
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.core.io.InputStreamResource
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class DocumentenApiPreviewResource(
    private val documentenApiPreviewService: DocumentenApiPreviewService
) {
    @GetMapping("/v1/documenten-api-preview/{pluginConfigurationId}/preview/{documentId}")
    fun preview(
        @LoggableResource(resourceType = PluginConfiguration::class) @PathVariable(name = "pluginConfigurationId") pluginConfigurationId: String,
        @PathVariable(name = "documentId") documentId: String,
    ): ResponseEntity<InputStreamResource> {
        val pdfFile = documentenApiPreviewService.generatePreview(pluginConfigurationId, documentId)

        val responseHeaders = HttpHeaders()
        responseHeaders.set("Content-Disposition", "attachment; filename=\"${pdfFile.fileName}\"")

        return ResponseEntity
            .ok()
            .headers(responseHeaders)
            .contentType(MediaType.APPLICATION_PDF)
            .body(InputStreamResource(pdfFile.content))
    }
}