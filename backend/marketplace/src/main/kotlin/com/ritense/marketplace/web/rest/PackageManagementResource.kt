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

import com.ritense.marketplace.PackageJobService
import com.ritense.marketplace.PackageManager
import com.ritense.marketplace.PackagePreflightService
import com.ritense.marketplace.PackageUpdateManager
import com.ritense.marketplace.PackageUploadService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.web.PageableDefault
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping(value = ["/api/management"])
class PackageManagementResource(
    private val packageManager: PackageManager,
    private val updateManager: PackageUpdateManager,
    private val preflightService: PackagePreflightService,
    private val jobService: PackageJobService,
    private val uploadService: PackageUploadService,
) {

    @GetMapping("/v1/package")
    fun getPackages(): ResponseEntity<PackageCatalogueDto> {
        return ResponseEntity.ok(updateManager.getCatalogue())
    }

    /**
     * Force a re-read of every configured package repository. The catalogue is otherwise
     * served from cache and renewed on a schedule, so this is what a user presses after
     * publishing a package rather than waiting for the next tick.
     */
    @PostMapping("/v1/package/refresh")
    fun refreshCatalogue(): ResponseEntity<PackageCatalogueDto> {
        updateManager.refreshCatalogue()
        return ResponseEntity.ok(updateManager.getCatalogue())
    }

    @GetMapping("/v1/package/store")
    fun getStores(): ResponseEntity<List<PackageStoreDto>> {
        val stores = updateManager.getRepositoryStores().map {
            PackageStoreDto(id = it.id, url = it.url, packageCount = it.packageCount, reachable = it.reachable)
        }
        return ResponseEntity.ok(stores)
    }

    /** The activity trail across all packages, newest first. */
    @GetMapping("/v1/package/job")
    fun getJobs(
        @PageableDefault(size = 20) pageable: Pageable,
    ): ResponseEntity<Page<PackageJobDto>> {
        return ResponseEntity.ok(jobService.getJobs(pageable).map { PackageJobDto.of(it) })
    }

    /** Polled by the install flow while an operation is in progress. */
    @GetMapping("/v1/package/job/{jobId}")
    fun getJob(@PathVariable jobId: UUID): ResponseEntity<PackageJobDto> {
        val job = jobService.getJob(jobId) ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(PackageJobDto.of(job))
    }

    /**
     * Install a package file supplied by the user rather than fetched from a store, for
     * environments that cannot reach the public stores.
     */
    @PostMapping("/v1/package/upload")
    fun uploadPackage(
        @RequestPart(name = "file") file: MultipartFile,
    ): ResponseEntity<PackageJobDto> {
        return ResponseEntity.ok(PackageJobDto.of(uploadService.upload(file)))
    }

    @GetMapping("/v1/package/{id}")
    fun getPackage(@PathVariable id: String): ResponseEntity<PackageDto> {
        val pkg = updateManager.getPackage(id) ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(pkg)
    }

    /** History for one package, shown on its detail page. */
    @GetMapping("/v1/package/{id}/job")
    fun getPackageJobs(
        @PathVariable id: String,
        @PageableDefault(size = 20) pageable: Pageable,
    ): ResponseEntity<Page<PackageJobDto>> {
        return ResponseEntity.ok(jobService.getJobs(id, pageable).map { PackageJobDto.of(it) })
    }

    /**
     * What installing would do, without doing it. The UI shows this as a review step and
     * refuses to continue while the response reports blockers.
     */
    @PostMapping("/v1/package/{id}/preflight")
    fun preflight(
        @PathVariable id: String,
        @RequestBody(required = false) request: PackageVersionRequest?,
    ): ResponseEntity<PackagePreflightDto> {
        return ResponseEntity.ok(preflightService.preflight(id, request?.version))
    }

    // Install / update / uninstall return 202 with the job: the operation runs in the
    // background, so the response says "accepted, here is what to poll" rather than
    // holding the request open for the whole download and deploy.

    @PostMapping("/v1/package/{id}/install/{version}")
    fun installPackage(
        @PathVariable id: String,
        @PathVariable version: String,
    ): ResponseEntity<PackageJobDto> {
        val job = jobService.submitInstall(id, version)
        return ResponseEntity.accepted().body(PackageJobDto.of(job))
    }

    @PostMapping("/v1/package/{id}/update/{version}")
    fun updatePackage(
        @PathVariable id: String,
        @PathVariable version: String,
    ): ResponseEntity<PackageJobDto> {
        val job = jobService.submitUpdate(id, version)
        return ResponseEntity.accepted().body(PackageJobDto.of(job))
    }

    @DeleteMapping("/v1/package/{id}")
    fun uninstallPackage(
        @PathVariable id: String,
    ): ResponseEntity<PackageJobDto> {
        // Goes through the job service (which calls uninstallPackage, not pf4j's
        // uninstallPlugin): the latter bypasses the config-package guard and would
        // silently report success for a case or building block that was never a plugin
        // on disk.
        val job = jobService.submitUninstall(id)
        return ResponseEntity.accepted().body(PackageJobDto.of(job))
    }

}
