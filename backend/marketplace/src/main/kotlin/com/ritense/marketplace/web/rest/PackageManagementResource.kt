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
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping(value = ["/api/management"])
class PackageManagementResource(
    private val packageManager: PackageManager,
    private val updateManager: PackageUpdateManager,
) {

    @GetMapping("/v1/package")
    fun getPackages(): ResponseEntity<List<PackageDto>> {
        return ResponseEntity.ok(updateManager.getPackages())
    }

    @PostMapping("/v1/package/{id}/install/{version}")
    fun installPackage(
        @PathVariable id: String,
        @PathVariable version: String,
    ): ResponseEntity<Unit> {
        updateManager.installPackage(id, version)
        return ResponseEntity.noContent().build()
    }

    @PostMapping("/v1/package/{id}/update/{version}")
    fun updatePackage(
        @PathVariable id: String,
        @PathVariable version: String,
    ): ResponseEntity<Unit> {
        updateManager.updatePackage(id, version)
        return ResponseEntity.noContent().build()
    }

    @DeleteMapping("/v1/package/{id}")
    fun uninstallPackage(
        @PathVariable id: String,
    ): ResponseEntity<Unit> {
        val success = updateManager.uninstallPlugin(id)
        require(success) { "Failed to uninstall package with id $id" }
        return ResponseEntity.noContent().build()
    }

}