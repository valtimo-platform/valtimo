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

import com.ritense.marketplace.PackageTrust
import java.time.Instant

/**
 * A package as presented to the marketplace UI.
 *
 * Everything here comes from the package repository's `packages.json` manifest plus
 * the host's own installed state. The DTO deliberately mirrors the manifest closely so
 * the store can enrich a package without requiring a host change.
 */
data class PackageDto(
    val id: String,
    val name: String?,
    val logo: String?,
    val description: String?,
    val type: String?,
    /** Publisher of the package, e.g. the maven group id it was built from. */
    val provider: String?,
    /** Source repository of the package, so the UI can link out to it. */
    val projectUrl: String?,
    /** Issue tracker, derived from [projectUrl] when it points at a known forge. */
    val issuesUrl: String?,
    /** Owner of the source repository, e.g. the GitHub organisation. */
    val owner: String?,
    /** How much this package's origin is trusted; derived from [owner], not the manifest. */
    val trust: PackageTrust,
    /** Id of the configured repository this package was found in. */
    val repositoryId: String?,
    val installedVersion: String?,
    /**
     * Highest COMPATIBLE version newer than [installedVersion], or null when the
     * package is up to date. Drives the "update available" state.
     */
    val nextVersion: String?,
    /**
     * Highest version in the manifest, compatible or not. When this is newer than
     * [installedVersion] while [nextVersion] is null, an update exists that this
     * Valtimo version cannot run — see [incompatibleReason].
     */
    val latestVersion: String?,
    /** Whether any release of this package can run on this Valtimo version. */
    val compatible: Boolean,
    /** The version constraint that could not be satisfied, if any. */
    val incompatibleReason: String?,
    /** Full release history, newest version first. */
    val releases: List<PackageReleaseDto>,
    val capabilities: PackageCapabilitiesDto,
)

data class PackageReleaseDto(
    val version: String,
    val date: Instant?,
    /** Valtimo version range this release declares, e.g. ">=13.34.0" or "*". */
    val requires: String?,
    val compatible: Boolean,
)

/**
 * Which lifecycle operations are valid for this package, so the UI never offers a
 * button the backend will reject. Notably a config package (case / building block) is
 * imported rather than loaded as a plugin, and cannot be uninstalled.
 */
data class PackageCapabilitiesDto(
    val installable: Boolean,
    val updatable: Boolean,
    val uninstallable: Boolean,
)

/**
 * The catalogue as served to the UI. Wraps the package list so the response can carry
 * the cache stamp: the catalogue is no longer fetched per request, so the UI has to be
 * able to tell the user how old the data is and offer an explicit refresh.
 */
data class PackageCatalogueDto(
    val packages: List<PackageDto>,
    val lastRefreshed: Instant?,
    /** Number of installed packages with a compatible newer version available. */
    val updatesAvailable: Int,
    /** Valtimo version used to evaluate release compatibility. */
    val systemVersion: String,
)
