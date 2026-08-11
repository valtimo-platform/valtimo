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
import com.ritense.marketplace.web.rest.PackageCapabilitiesDto
import com.ritense.marketplace.web.rest.PackageCatalogueDto
import com.ritense.marketplace.web.rest.PackageDto
import com.ritense.marketplace.web.rest.PackageReleaseDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import io.github.oshai.kotlinlogging.KotlinLogging
import org.pf4j.update.PluginInfo
import org.pf4j.update.PluginInfo.PluginRelease
import org.pf4j.update.UpdateManager
import org.pf4j.update.UpdateRepository
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.nio.file.Files
import java.time.Instant

@Component
@SkipComponentScan
@Transactional
class PackageUpdateManager(
    private val packageManager: PackageManager,
    defaultRepositories: List<UpdateRepository>,
    private val importService: ImportService,
    private val caseDefinitionChecker: CaseDefinitionChecker,
    private val buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker,
    private val trustResolver: PackageTrustResolver,
) : UpdateManager(packageManager) {

    /**
     * When the merged catalogue was last read from the configured repositories. Also
     * doubles as the "has ever been loaded" flag for [ensureCatalogueLoaded].
     */
    @Volatile
    private var lastRefreshed: Instant? = null

    init {
        defaultRepositories.forEach { addRepository(it) }
    }

    /**
     * The catalogue, served from the in-memory cache.
     *
     * This deliberately does NOT refresh. Reading a package repository means an HTTP
     * fetch of its `packages.json` per repository, so refreshing per request made
     * simply opening the marketplace as slow as the slowest configured store. The
     * cache is renewed by [refreshCatalogue] on a schedule and on explicit user
     * request; [PackageCatalogueDto.lastRefreshed] tells the UI how old the data is.
     */
    fun getCatalogue(): PackageCatalogueDto {
        ensureCatalogueLoaded()
        val packages = plugins
            .map { toDto(it as PackageInfo) }
            .sortedBy { (it.name ?: it.id).lowercase() }
        return PackageCatalogueDto(
            packages = packages,
            lastRefreshed = lastRefreshed,
            updatesAvailable = packages.count { it.installedVersion != null && it.nextVersion != null },
            systemVersion = packageManager.systemVersion,
        )
    }

    /**
     * Re-read every configured repository's manifest. Scheduled, and callable from the
     * management API so a user who just published a package doesn't have to wait for
     * the next tick.
     */
    @Scheduled(cron = "\${valtimo.marketplace.catalogueRefreshCron:0 */30 * * * ?}")
    fun refreshCatalogue() {
        refresh()
        lastRefreshed = Instant.now()
        logger.debug { "Refreshed package catalogue" }
    }

    private fun ensureCatalogueLoaded() {
        if (lastRefreshed == null) {
            refreshCatalogue()
        }
    }

    /** A single package as the UI sees it, or null when the catalogue has no such id. */
    fun getPackage(packageId: String): PackageDto? {
        ensureCatalogueLoaded()
        return findPackage(packageId)?.let { toDto(it) }
    }

    /** The raw catalogue entry, for callers that need the manifest rather than the DTO. */
    fun findPackage(packageId: String): PackageInfo? {
        ensureCatalogueLoaded()
        return getPluginsMap()[packageId] as? PackageInfo
    }

    fun findRelease(packageId: String, version: String): PluginRelease? =
        findPackage(packageId)?.releases?.firstOrNull { it.version == version }

    /** Installed version of a package, resolved for its type. Null when not installed. */
    fun installedVersionOfPackage(packageId: String): String? =
        findPackage(packageId)?.let { installedVersionOf(it) }

    fun isReleaseCompatible(release: PluginRelease): Boolean = isCompatible(release)

    /**
     * Whether the package is imported as Valtimo config rather than loaded as a plugin.
     * Exposed because reversibility and the install path both depend on it.
     */
    fun isConfigPackageType(type: String?): Boolean = isConfigType(type)

    fun getRepositoryStores(): List<PackageStore> {
        ensureCatalogueLoaded()
        return getRepositories().map { repository ->
            val packages = runCatching { repository.plugins }.getOrDefault(emptyMap())
            PackageStore(
                id = repository.id,
                url = repository.url?.toString(),
                packageCount = packages.size,
                // A store with no packages is almost always a misconfigured or
                // unreachable URL rather than a genuinely empty one, and that distinction
                // is what an admin needs to see; the manifest read itself is silent about
                // failure by design (one bad store must not break the catalogue).
                reachable = packages.isNotEmpty(),
            )
        }
    }

    private fun toDto(pkg: PackageInfo): PackageDto {
        val installedVersion = installedVersionOf(pkg)
        val nextVersion = getNextVersion(pkg.id, installedVersion)
        val releases = pkg.releases
            .map {
                PackageReleaseDto(
                    version = it.version,
                    date = it.date?.toInstant(),
                    requires = it.requires,
                    compatible = isCompatible(it),
                )
            }
            .sortedWith { a, b -> compareVersions(b.version, a.version) }
        val latestRelease = releases.firstOrNull()
        return PackageDto(
            id = pkg.id,
            logo = pkg.logo,
            name = pkg.name,
            description = pkg.description,
            type = pkg.type,
            provider = pkg.provider,
            projectUrl = pkg.projectUrl,
            issuesUrl = issuesUrlOf(pkg.projectUrl),
            owner = trustResolver.ownerOf(pkg.projectUrl),
            trust = trustResolver.resolve(pkg.projectUrl),
            repositoryId = pkg.repositoryId,
            installedVersion = installedVersion,
            nextVersion = nextVersion,
            latestVersion = latestRelease?.version,
            compatible = releases.any { it.compatible },
            // Only worth reporting when the newest release is the unusable one: that is
            // the case the UI has to explain ("an update exists but needs a newer
            // Valtimo"). A compatible latest release means there is nothing to explain.
            incompatibleReason = latestRelease?.takeIf { !it.compatible }?.requires,
            releases = releases,
            capabilities = capabilitiesOf(pkg, installedVersion, nextVersion, releases),
        )
    }

    /**
     * Which operations the UI may offer. A config package is imported rather than
     * loaded as a plugin, and the importer has no inverse, so it can never be
     * uninstalled — offering the button only produced a failing request.
     */
    private fun capabilitiesOf(
        pkg: PackageInfo,
        installedVersion: String?,
        nextVersion: String?,
        releases: List<PackageReleaseDto>,
    ): PackageCapabilitiesDto {
        val hasCompatibleRelease = releases.any { it.compatible }
        return PackageCapabilitiesDto(
            installable = installedVersion == null && hasCompatibleRelease,
            updatable = installedVersion != null && nextVersion != null,
            uninstallable = installedVersion != null && !isConfigType(pkg.type),
        )
    }

    /**
     * Whether a release can run on this Valtimo version.
     *
     * Permissive on anything unknown: with no system version pf4j itself skips
     * constraint checking, and a constraint the version manager cannot parse is a
     * problem with the store's manifest — hiding the package would turn a metadata bug
     * into an invisible catalogue.
     */
    private fun isCompatible(release: PluginRelease): Boolean {
        if (packageManager.systemVersion == PackageManager.UNKNOWN_SYSTEM_VERSION) {
            return true
        }
        val requires = release.requires?.takeIf { it.isNotBlank() } ?: return true
        return try {
            packageManager.versionManager.checkVersionConstraint(packageManager.systemVersion, requires)
        } catch (e: Exception) {
            logger.warn { "Unparseable version constraint '$requires' on release ${release.version}; treating as compatible" }
            true
        }
    }

    /**
     * Semver comparison via pf4j's version manager, falling back to a lexicographic
     * compare so an unparseable version from a store cannot throw out of a list mapping.
     */
    fun compareVersions(a: String, b: String): Int =
        try {
            packageManager.versionManager.compareVersions(a, b)
        } catch (e: Exception) {
            a.compareTo(b)
        }

    /**
     * A config package (case / building block) is not a pf4j plugin, so its installed
     * state lives in the case or building block definitions (keyed by the package id),
     * not in the plugin registry. Resolve it through the owning module so the catalogue
     * reports such a package as installed.
     */
    private fun installedVersionOf(pkg: PackageInfo): String? =
        when (pkg.type) {
            CASE_TYPE -> caseDefinitionChecker.getInstalledCaseDefinitionVersion(pkg.id)
            BUILDING_BLOCK_TYPE ->
                buildingBlockDefinitionChecker.getInstalledBuildingBlockDefinitionVersion(pkg.id)
            else -> packageManager.getPlugin(pkg.id)?.descriptor?.version
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
        // Config packages are not pf4j plugins: instead of loading a jar we import
        // the downloaded zip through the ImportService. The plugin path
        // (loadPlugin/startPlugin + the pf4j "already installed" guard, which
        // consults the filesystem plugin registry a config package never lands in)
        // does not apply.
        if (isConfigPackage(id)) {
            installConfigPackage(id, version)
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
        // Updating a config package = importing the newer version's zip; there is no
        // loaded plugin to swap out (the importer upserts the definition).
        if (isConfigPackage(id)) {
            installConfigPackage(id, version)
            return
        }
        try {
            check(updatePlugin(id, version)) { "Unable to update" }
        } catch (e: Exception) {
            throw RuntimeException("Failed to update package with id=$id and version=$version")
        }
    }

    fun uninstallPackage(id: String) {
        if (isConfigPackage(id)) {
            // A config package is persisted as case / building block definitions by the
            // importer, not as a pf4j plugin on disk, so there is nothing here to
            // uninstall. Reported to the UI as capabilities.uninstallable = false, so
            // reaching this is either a stale client or a direct API call.
            throw UnsupportedOperationException(
                "Uninstalling config package '$id' is not supported from the marketplace"
            )
        }
        check(uninstallPlugin(id)) { "Failed to uninstall package with id=$id" }
    }

    /**
     * Whether the package is imported as Valtimo config rather than loaded as a plugin.
     * Both kinds of config package (case and building block) take the import path —
     * treating a building block as a plugin would hand a config zip to the pf4j loader.
     */
    private fun isConfigPackage(id: String): Boolean =
        isConfigType((getPluginsMap()[id] as? PackageInfo)?.type)

    /**
     * Install a config package by importing its zip. The zip is downloaded (and its
     * checksum verified) by pf4j's [downloadPlugin], then fed to the [ImportService];
     * nothing is handed to the pf4j plugin loader.
     */
    private fun installConfigPackage(id: String, version: String) {
        try {
            val downloaded = downloadPlugin(id, version)
            // Skip re-importing a definition that is already installed (final): the
            // importer refuses to overwrite a final definition, so without this an
            // install/update of an already-present package would fail. Passing it in the
            // skip list makes a re-install an idempotent no-op — the same guard the
            // import REST endpoint uses (findAllByFinalTrue).
            val alreadyInstalled = runCatching { CaseDefinitionId.of(id, version) }.getOrNull()
                ?.takeIf { caseDefinitionChecker.existsCaseDefinition(it) }
            val skipList = listOfNotNull(alreadyInstalled)
            Files.newInputStream(downloaded).use { input ->
                // Config imports are deployment-time operations, mirroring the import
                // REST endpoint which is annotated @RunWithoutAuthorization. Without
                // this the importers' authorization checks deny the import with
                // "AccessDeniedException: Unauthorized".
                runWithoutAuthorization {
                    importService.import(input, skipList)
                }
            }
            logger.info { "Imported config package id=$id version=$version (skipped=${skipList.isNotEmpty()})" }
        } catch (e: Exception) {
            logger.error(e) { "Failed to install config package with id=$id and version=$version" }
            throw RuntimeException(
                "Failed to install config package with id=$id and version=$version: ${rootCauseMessage(e)}", e
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
        private const val BUILDING_BLOCK_TYPE = "building-block"

        /**
         * Package types that are imported as Valtimo config instead of being loaded as a
         * pf4j plugin. An unknown/absent type is a plugin (the manifest default).
         */
        private fun isConfigType(type: String?): Boolean =
            type == CASE_TYPE || type == BUILDING_BLOCK_TYPE

        /**
         * Issue tracker for a source repository. Only derived for GitHub, which is what
         * the pipeline builds from; anything else gets no link rather than a guessed one.
         */
        private fun issuesUrlOf(projectUrl: String?): String? =
            projectUrl?.trimEnd('/')?.takeIf { it.contains("github.com", ignoreCase = true) }
                ?.let { "$it/issues" }
    }
}

/**
 * A configured package repository, as presented on the stores screen.
 */
data class PackageStore(
    val id: String,
    val url: String?,
    val packageCount: Int,
    val reachable: Boolean,
)