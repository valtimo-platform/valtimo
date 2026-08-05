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
import com.ritense.marketplace.web.rest.PackageDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import io.github.oshai.kotlinlogging.KotlinLogging
import org.pf4j.update.PluginInfo
import org.pf4j.update.UpdateManager
import org.pf4j.update.UpdateRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.nio.file.Files

@Component
@SkipComponentScan
@Transactional
class PackageUpdateManager(
    private val packageManager: PackageManager,
    defaultRepositories: List<UpdateRepository>,
    private val importService: ImportService,
    private val caseDefinitionChecker: CaseDefinitionChecker,
) : UpdateManager(packageManager) {

    init {
        defaultRepositories.forEach { addRepository(it) }
    }

    fun getPackages(): List<PackageDto> {
        refresh()
        return plugins.map { pkg ->
            pkg as PackageInfo
            val installedVersion = installedVersionOf(pkg)
            PackageDto(
                id = pkg.id,
                logo = pkg.logo,
                name = pkg.name,
                description = pkg.description,
                type = pkg.type,
                installedVersion = installedVersion,
                nextVersion = getNextVersion(pkg.id, installedVersion),
            )
        }
    }

    /**
     * A case package is not a pf4j plugin, so its installed state lives in the case
     * definitions (keyed by the package id), not in the plugin registry. Resolve it
     * through the case module so the catalogue reports a case package as installed.
     */
    private fun installedVersionOf(pkg: PackageInfo): String? =
        if (pkg.type == CASE_TYPE) {
            caseDefinitionChecker.getInstalledCaseDefinitionVersion(pkg.id)
        } else {
            packageManager.getPlugin(pkg.id)?.descriptor?.version
        }

    fun getNextVersion(packageId: String, installedVersion: String?): String? {
        val latestVersion = getLastPluginRelease(packageId)?.version ?: return null
        val versionManager = packageManager.versionManager
        return if (installedVersion == null || versionManager.compareVersions(latestVersion, installedVersion) > 0) {
            latestVersion
        } else {
            null
        }
    }

    fun installPackage(id: String, version: String) {
        // Case packages are not pf4j plugins: instead of loading a jar we import
        // the downloaded zip through the case ImportService. The plugin path
        // (loadPlugin/startPlugin + the pf4j "already installed" guard, which
        // consults the filesystem plugin registry a case never lands in) does
        // not apply.
        if (isCasePackage(id)) {
            installCasePackage(id, version)
            return
        }
        require(packageManager.getPlugin(id) == null) {
            "Package with id '$id' is already installed"
        }
        try {
            check(installPlugin(id, version)) { "Unable to install" }
        } catch (e: Exception) {
            logger.error(e) { "Failed to install package with id=$id and version=$version" }
            try {
                uninstallPackage(id)
            } catch (_: Exception) {
                // ignored
            }
            throw RuntimeException("Failed to install package with id=$id and version=$version: ${rootCauseMessage(e)}", e)
        }
    }

    fun updatePackage(id: String, version: String) {
        // Updating a case = importing the newer version's zip; there is no loaded
        // plugin to swap out (the importer upserts the case definition).
        if (isCasePackage(id)) {
            installCasePackage(id, version)
            return
        }
        try {
            check(updatePlugin(id, version)) { "Unable to update" }
        } catch (e: Exception) {
            throw RuntimeException("Failed to update package with id=$id and version=$version")
        }
    }

    fun uninstallPackage(id: String) {
        if (isCasePackage(id)) {
            // A case is persisted as case definitions by the importer, not as a
            // pf4j plugin on disk, so there is nothing here to uninstall.
            throw UnsupportedOperationException(
                "Uninstalling case package '$id' is not supported from the marketplace"
            )
        }
        check(uninstallPlugin(id)) { "Failed to uninstall package with id=$id" }
    }

    private fun isCasePackage(id: String): Boolean =
        (getPluginsMap()[id] as? PackageInfo)?.type == CASE_TYPE

    /**
     * Install a case package by importing its zip. The zip is downloaded (and its
     * sha512 verified) by pf4j's [downloadPlugin], then fed to the case
     * [ImportService]; nothing is handed to the pf4j plugin loader.
     */
    private fun installCasePackage(id: String, version: String) {
        try {
            val downloaded = downloadPlugin(id, version)
            // Skip re-importing a case definition that is already installed (final):
            // the case importer refuses to overwrite a final definition, so without
            // this an install/update of an already-present case would fail. Passing
            // it in the skip list makes a re-install an idempotent no-op — the same
            // guard the case import REST endpoint uses (findAllByFinalTrue).
            val alreadyInstalled = runCatching { CaseDefinitionId.of(id, version) }.getOrNull()
                ?.takeIf { caseDefinitionChecker.existsCaseDefinition(it) }
            val skipList = listOfNotNull(alreadyInstalled)
            Files.newInputStream(downloaded).use { input ->
                // Case imports are deployment-time operations, mirroring the case
                // import REST endpoint which is annotated @RunWithoutAuthorization.
                // Without this the importers' authorization checks deny the import
                // with "AccessDeniedException: Unauthorized".
                runWithoutAuthorization {
                    importService.import(input, skipList)
                }
            }
            logger.info { "Imported case package id=$id version=$version (skipped=${skipList.isNotEmpty()})" }
        } catch (e: Exception) {
            logger.error(e) { "Failed to install case package with id=$id and version=$version" }
            throw RuntimeException(
                "Failed to install case package with id=$id and version=$version: ${rootCauseMessage(e)}", e
            )
        }
    }

    private fun rootCauseMessage(throwable: Throwable): String {
        var cause: Throwable = throwable
        while (cause.cause != null && cause.cause !== cause) {
            cause = cause.cause!!
        }
        return "${cause::class.qualifiedName}: ${cause.message}"
    }

    override fun getPluginsMap(): Map<String, PluginInfo> {
        val packagesMap = mutableMapOf<String, PluginInfo>()
        getRepositories().forEach { repository ->
            repository.plugins.forEach { (packageId, pkg) ->
                val existingPackage = packagesMap[packageId]
                if (existingPackage == null) {
                    packagesMap[packageId] = pkg
                } else {
                    pkg.releases.forEach { newRelease ->
                        if (existingPackage.releases.none { it.version == newRelease.version && it.date > newRelease.date }) {
                            existingPackage.releases.removeIf { it.version == newRelease.version }
                            existingPackage.releases.add(newRelease)
                        }
                    }
                }
            }
        }
        return packagesMap
    }

    override fun addRepository(repository: UpdateRepository) {
        if (repositories == null) {
            repositories = mutableListOf()
        }
        if (repositories.none { it.id == repository.id }) {
            repository.refresh()
            repositories.add(repository)
            if (repository is PackageUpdateRepository) {
                repository.getRepositories().forEach { addRepository(it) }
            }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        private const val CASE_TYPE = "case"
    }
}