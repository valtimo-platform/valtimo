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

package com.ritense.marketplace

import com.ritense.marketplace.domain.PackageOperation
import com.ritense.marketplace.web.rest.PackagePreflightDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.pf4j.update.PluginInfo.PluginRelease
import org.springframework.stereotype.Component
import java.net.HttpURLConnection
import java.net.URI

/**
 * Works out what would happen if a package were installed, without installing it.
 *
 * Everything here is derived from the catalogue plus the host's own state — no side
 * effects — so the UI can show a review step before the user commits to something that,
 * for a config package, cannot be undone.
 */
@Component
@SkipComponentScan
class PackagePreflightService(
    private val packageUpdateManager: PackageUpdateManager,
    private val trustResolver: PackageTrustResolver,
) {

    fun preflight(packageId: String, requestedVersion: String?): PackagePreflightDto {
        val pkg = packageUpdateManager.findPackage(packageId)
            ?: throw NoSuchElementException("No package found with id '$packageId'")

        val installedVersion = packageUpdateManager.installedVersionOfPackage(packageId)
        val targetVersion = requestedVersion
            ?: packageUpdateManager.getNextVersion(packageId, installedVersion)
            ?: pkg.releases.firstOrNull { packageUpdateManager.isReleaseCompatible(it) }?.version
            ?: throw NoSuchElementException("Package '$packageId' has no release that can run on this Valtimo version")

        val release = packageUpdateManager.findRelease(packageId, targetVersion)
        val isConfigPackage = packageUpdateManager.isConfigPackageType(pkg.type)
        val compatible = release?.let { packageUpdateManager.isReleaseCompatible(it) } ?: false
        val trust = trustResolver.resolve(pkg.projectUrl)
        val operation = if (installedVersion == null) PackageOperation.INSTALL else PackageOperation.UPDATE

        val blockers = mutableListOf<String>()
        val warnings = mutableListOf<String>()

        if (release == null) {
            blockers += "Version $targetVersion is not published for this package"
        } else if (!compatible) {
            blockers += "Version $targetVersion requires Valtimo ${release.requires}"
        }
        // A plugin already loaded under this id cannot be installed again — pf4j rejects
        // it. A config package has no such registry, so re-importing is a valid no-op.
        if (operation == PackageOperation.INSTALL && !isConfigPackage && installedVersion != null) {
            blockers += "Package is already installed at version $installedVersion"
        }

        if (isConfigPackage) {
            warnings += "This is a configuration package: it is imported into Valtimo and cannot be uninstalled afterwards."
        }
        when (trust) {
            PackageTrust.COMMUNITY -> warnings +=
                "Published outside the trusted Valtimo organisations. Review the source before installing."
            PackageTrust.UNKNOWN -> warnings +=
                "The origin of this package cannot be established: it declares no source repository."
            PackageTrust.VERIFIED -> Unit
        }
        if (installedVersion != null && release != null && isDowngrade(targetVersion, installedVersion)) {
            warnings += "Version $targetVersion is older than the installed version $installedVersion."
        }
        // Re-applying the identical version is allowed (it is how a broken install is
        // repaired) but it is not an update, and saying so avoids a confusing no-op.
        if (installedVersion != null && targetVersion == installedVersion) {
            warnings += "Version $targetVersion is already installed and will be reinstalled."
        }

        return PackagePreflightDto(
            packageId = pkg.id,
            packageName = pkg.name,
            type = pkg.type,
            trust = trust,
            targetVersion = targetVersion,
            installedVersion = installedVersion,
            operation = operation,
            requires = release?.requires,
            compatible = compatible,
            // A config package's definitions are owned by the importer, which has no
            // inverse; a plugin can be unloaded and deleted.
            reversible = !isConfigPackage,
            hotLoadable = true,
            downloadSizeBytes = release?.let { downloadSizeOf(it) },
            blockers = blockers,
            warnings = warnings,
        )
    }

    private fun isDowngrade(targetVersion: String, installedVersion: String): Boolean =
        packageUpdateManager.compareVersions(targetVersion, installedVersion) < 0

    /**
     * Artifact size, so the review step can warn about an 80 MB download.
     *
     * Best effort by design: this is a HEAD against a third-party store, and a store that
     * does not answer must not stop the user from installing. Failures are swallowed to a
     * null size.
     */
    private fun downloadSizeOf(release: PluginRelease): Long? =
        try {
            val connection = URI(release.url).toURL().openConnection()
            connection.connectTimeout = SIZE_PROBE_TIMEOUT_MILLIS
            connection.readTimeout = SIZE_PROBE_TIMEOUT_MILLIS
            if (connection is HttpURLConnection) {
                connection.requestMethod = "HEAD"
                try {
                    connection.contentLengthLong.takeIf { it > 0 }
                } finally {
                    connection.disconnect()
                }
            } else {
                // file: and other protocols have no HEAD; the content length is available
                // without reading the body.
                connection.contentLengthLong.takeIf { it > 0 }
            }
        } catch (e: Exception) {
            logger.debug(e) { "Could not determine download size for ${release.url}" }
            null
        }

    companion object {
        private val logger = KotlinLogging.logger {}
        private const val SIZE_PROBE_TIMEOUT_MILLIS = 3000
    }
}
