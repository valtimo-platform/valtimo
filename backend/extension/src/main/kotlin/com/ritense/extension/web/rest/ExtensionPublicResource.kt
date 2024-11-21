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

package com.ritense.extension.web.rest

import com.ritense.extension.ExtensionManager
import com.ritense.extension.ExtensionUpdateManager
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import jakarta.servlet.http.HttpServletRequest
import org.apache.tika.Tika
import org.pf4j.PluginState
import org.springframework.core.io.Resource
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping(value = ["/api"])
class ExtensionPublicResource(
    private val extensionManager: ExtensionManager,
    private val updateManager: ExtensionUpdateManager,
) {

    @GetMapping("/v1/public/extension/id")
    fun getPublicExtensionIds(
        @RequestParam state: String?,
        @RequestParam file: String?,
    ): ResponseEntity<List<String>> {
        val extensionIds = mutableListOf<String>()
        if (state == null) {
            extensionIds.addAll(updateManager.plugins.map { it.id })
            extensionIds.addAll(extensionManager.plugins.map { it.pluginId })
        } else {
            extensionIds.addAll(extensionManager.getPlugins(PluginState.parse(state.uppercase()))
                .map { it.pluginId })
        }
        if (file != null) {
            extensionIds.removeIf { extensionManager.getPublicResource(it, file) == null }
        }
        return ResponseEntity.ok(extensionIds)
    }

    @GetMapping("/v1/public/extension/{extensionId}/file/**")
    fun getPublicExtensionFile(
        request: HttpServletRequest,
        @PathVariable extensionId: String,
    ): ResponseEntity<ByteArray> {
        val requestURL = request.requestURL.toString()
        val file = requestURL.split("/file/")[1]
        val publicResource = extensionManager.getPublicResource(extensionId, file)
            ?: return ResponseEntity.notFound().build()
        return ResponseEntity
            .ok()
            .header("Content-Type", getContentType(publicResource))
            .body(publicResource.contentAsByteArray)
    }

    private fun getContentType(publicResource: Resource): String? {
        return when (publicResource.filename?.substringAfterLast('.', "")) {
            "js", "mjs" -> "text/javascript"
            "ts", "tsx" -> "text/javascript"
            "map" -> "application/json"
            "", null -> Tika().detect(publicResource.inputStream)
            else -> Tika().detect(publicResource.inputStream, publicResource.filename)
        }
    }

}