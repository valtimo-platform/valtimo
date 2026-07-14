package com.ritense.pdca.plugin

import org.springframework.core.io.ClassPathResource
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController

@RestController
class BundleController {

    @GetMapping("/plugins/pdca/{version}/bundles/{filename:.+}")
    fun serveBundle(
        @PathVariable version: String,
        @PathVariable filename: String
    ): ResponseEntity<ByteArray> {
        return serveBundleFile(filename)
    }

    @GetMapping("/plugins/pdca/{version}/bundles/assets/{filename:.+}")
    fun serveBundleAsset(
        @PathVariable version: String,
        @PathVariable filename: String
    ): ResponseEntity<ByteArray> {
        return serveBundleFile("assets/$filename")
    }

    @GetMapping("/plugins/pdca/{version}/bundles/chunks/{filename:.+}")
    fun serveBundleChunk(
        @PathVariable version: String,
        @PathVariable filename: String
    ): ResponseEntity<ByteArray> {
        return serveBundleFile("chunks/$filename")
    }

    private fun serveBundleFile(path: String): ResponseEntity<ByteArray> {
        val resource = ClassPathResource("static/bundles/react/$path")
            .takeIf { it.exists() }
            ?: ClassPathResource("static/bundles/$path")
                .takeIf { it.exists() }
            ?: return ResponseEntity.notFound().build()

        val contentType = when {
            path.endsWith(".html") -> MediaType.TEXT_HTML
            path.endsWith(".js") -> MediaType("application", "javascript")
            path.endsWith(".css") -> MediaType("text", "css")
            else -> MediaType.APPLICATION_OCTET_STREAM
        }

        return ResponseEntity.ok()
            .contentType(contentType)
            .body(resource.inputStream.readBytes())
    }
}
