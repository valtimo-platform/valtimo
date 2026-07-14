package com.ritense.pdca.plugin

import org.springframework.core.io.ClassPathResource
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController

@RestController
class BundleController {

    @GetMapping("/plugins/pdca/{version}/bundles/{filename}")
    fun serveBundle(
        @PathVariable version: String,
        @PathVariable filename: String
    ): ResponseEntity<ByteArray> {
        val resource = ClassPathResource("static/bundles/$filename")
        if (!resource.exists()) {
            return ResponseEntity.notFound().build()
        }
        val contentType = if (filename.endsWith(".html")) MediaType.TEXT_HTML else MediaType.APPLICATION_OCTET_STREAM
        return ResponseEntity.ok()
            .contentType(contentType)
            .body(resource.inputStream.readBytes())
    }
}
