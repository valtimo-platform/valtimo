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

package com.ritense.marketplace.web.rest

import com.ritense.marketplace.PackageManager
import com.ritense.marketplace.PackageUpdateManager
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
class PackagePublicResource(
    private val packageManager: PackageManager,
    private val updateManager: PackageUpdateManager,
) {

    @GetMapping("/v1/public/package/id")
    fun getPublicPackageIds(
        @RequestParam state: String?,
        @RequestParam file: String?,
    ): ResponseEntity<List<String>> {
        val packageIds = linkedSetOf<String>()
        if (state == null) {
            packageIds.addAll(updateManager.plugins.map { it.id })
            packageIds.addAll(packageManager.plugins.map { it.pluginId })
        } else {
            packageIds.addAll(packageManager.getPlugins(PluginState.parse(state.uppercase()))
                .map { it.pluginId })
        }
        if (file != null) {
            packageIds.removeIf { packageManager.getPublicResource(it, file) == null }
        }
        return ResponseEntity.ok(packageIds.toList())
    }

    @GetMapping("/v1/public/package/{packageId}/file/**")
    fun getPublicPackageFile(
        request: HttpServletRequest,
        @PathVariable packageId: String,
    ): ResponseEntity<ByteArray> {
        val requestURL = request.requestURL.toString()
        val file = requestURL.split("/file/")[1]
        val publicResource = packageManager.getPublicResource(packageId, file)
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