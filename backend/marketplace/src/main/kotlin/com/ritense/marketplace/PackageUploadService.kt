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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.importer.ImportService
import com.ritense.marketplace.domain.PackageJob
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component
import org.springframework.web.multipart.MultipartFile
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.util.jar.JarFile

/**
 * Installs a package from a file the user supplies instead of from a store.
 *
 * This is the air-gapped path: a government environment that cannot reach GitHub still
 * has to be able to install a package, and the alternative today is copying jars onto the
 * server by hand.
 *
 * The upload is applied synchronously — the multipart stream does not outlive the request,
 * so it cannot be handed to the job queue — but it is still recorded as a job so it
 * appears in the audit trail alongside store installs.
 */
@Component
@SkipComponentScan
class PackageUploadService(
    private val packageManager: PackageManager,
    private val importService: ImportService,
    private val packageJobService: PackageJobService,
) {

    fun upload(file: MultipartFile): PackageJob {
        val originalName = Path.of(file.originalFilename ?: "").fileName?.toString()
        require(!originalName.isNullOrBlank()) { "Uploaded file has no name" }
        val extension = originalName.substringAfterLast('.', "").lowercase()
        require(extension in SUPPORTED_EXTENSIONS) {
            "Unsupported package file '$originalName'. Expected one of: ${SUPPORTED_EXTENSIONS.joinToString()}"
        }

        // Staged outside the plugins directory first: a half-written jar in there would be
        // picked up by the next plugin scan (or the multi-instance cron) as a broken package.
        val staged = Files.createTempFile("valtimo-package-upload-", ".$extension")
        return try {
            file.inputStream.use { input ->
                Files.copy(input, staged, StandardCopyOption.REPLACE_EXISTING)
            }
            if (extension == JAR_EXTENSION) uploadPlugin(originalName, staged) else uploadConfig(originalName, staged)
        } finally {
            Files.deleteIfExists(staged)
        }
    }

    private fun uploadPlugin(originalName: String, staged: Path): PackageJob {
        // Read the id/version from the pf4j manifest rather than the filename, so the
        // audit row matches what actually got loaded.
        val (manifestId, manifestVersion) = readPluginCoordinates(staged)
        val packageId = manifestId ?: originalName.substringBeforeLast('.')
        return try {
            require(packageManager.getPlugin(packageId) == null) {
                "Package '$packageId' is already installed"
            }
            val destination = pluginsRoot().resolve(originalName)
            Files.copy(staged, destination, StandardCopyOption.REPLACE_EXISTING)
            val loadedId = try {
                packageManager.loadPlugin(destination)
            } catch (e: Exception) {
                // Leaving the jar behind would make it load again on every restart, so a
                // failed load takes its file with it.
                Files.deleteIfExists(destination)
                throw e
            }
            checkNotNull(loadedId) { "Valtimo could not read '$originalName' as a package" }
            packageManager.startPlugin(loadedId)
            logger.info { "Installed uploaded package '$loadedId' from '$originalName'" }
            packageJobService.recordUpload(loadedId, loadedId, PLUGIN_TYPE, manifestVersion, null)
        } catch (e: Exception) {
            logger.error(e) { "Failed to install uploaded package '$originalName'" }
            packageJobService.recordUpload(
                packageId, packageId, PLUGIN_TYPE, manifestVersion, "${e::class.simpleName}: ${e.message}"
            )
        }
    }

    private fun uploadConfig(originalName: String, staged: Path): PackageJob {
        val packageId = originalName.substringBeforeLast('.')
        return try {
            Files.newInputStream(staged).use { input ->
                // Mirrors the store install path: config import is a deployment-time
                // operation, and the importers' own authorization checks would deny it.
                runWithoutAuthorization { importService.import(input, emptyList()) }
            }
            logger.info { "Imported uploaded config package '$originalName'" }
            packageJobService.recordUpload(packageId, packageId, CONFIG_TYPE, null, null)
        } catch (e: Exception) {
            logger.error(e) { "Failed to import uploaded config package '$originalName'" }
            packageJobService.recordUpload(
                packageId, packageId, CONFIG_TYPE, null, "${e::class.simpleName}: ${e.message}"
            )
        }
    }

    /**
     * pf4j is configured with a list of roots; uploads go to the first, which is the
     * writable directory the marketplace itself installs into.
     */
    private fun pluginsRoot(): Path {
        val root = packageManager.pluginsRoots.firstOrNull()
            ?: error("No packages directory is configured")
        Files.createDirectories(root)
        return root
    }

    private fun readPluginCoordinates(jar: Path): Pair<String?, String?> =
        try {
            JarFile(jar.toFile()).use { jarFile ->
                val attributes = jarFile.manifest?.mainAttributes
                attributes?.getValue("Plugin-Id") to attributes?.getValue("Plugin-Version")
            }
        } catch (e: Exception) {
            logger.debug(e) { "Could not read a pf4j manifest from '$jar'" }
            null to null
        }

    companion object {
        private val logger = KotlinLogging.logger {}
        private const val JAR_EXTENSION = "jar"
        private const val PLUGIN_TYPE = "plugin"

        /** A config zip's real kind is only known after import, so it is reported generically. */
        private const val CONFIG_TYPE = "case"
        private val SUPPORTED_EXTENSIONS = setOf(JAR_EXTENSION, "zip")
    }
}
