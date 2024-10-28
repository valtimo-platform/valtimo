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

import com.ritense.extension.ExtensionUpdateManager
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.core.io.InputStreamResource
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import kotlin.io.path.inputStream

@RestController
@SkipComponentScan
@RequestMapping(value = ["/api/management"])
class ExtensionManagementResource(
    private val updateManager: ExtensionUpdateManager,
) {

    @GetMapping("/v1/extension")
    fun getExtensions(): ResponseEntity<List<Extension>> {
        return ResponseEntity.ok(updateManager.getExtensions())
    }

    @PostMapping("/v1/extension/{id}/install/{version}")
    fun installExtension(
        @PathVariable id: String,
        @PathVariable version: String,
    ): ResponseEntity<InputStreamResource> {
        val frontendZip = updateManager.installExtension(id, version)
        val zipName = "$id-$version.zip"
        return ResponseEntity
            .ok()
            .header("Content-Disposition", "attachment; filename=\"$zipName\"")
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .body(InputStreamResource(frontendZip.inputStream()))
    }

    @PostMapping("/v1/extension/{id}/update/{version}")
    fun updateExtension(
        @PathVariable id: String,
        @PathVariable version: String,
    ): ResponseEntity<Unit> {
        updateManager.updateExtension(id, version)
        return ResponseEntity.noContent().build()
    }

    @DeleteMapping("/v1/extension/{id}")
    fun uninstallExtension(
        @PathVariable id: String,
    ): ResponseEntity<Unit> {
        val success = updateManager.uninstallPlugin(id)
        require(success) { "Failed to uninstall extension with id $id" }
        return ResponseEntity.noContent().build()
    }

}