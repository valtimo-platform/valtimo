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

package com.ritense.extension

import com.ritense.extension.web.rest.ExtensionDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import mu.KotlinLogging
import org.pf4j.update.PluginInfo
import org.pf4j.update.UpdateManager
import org.pf4j.update.UpdateRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
@SkipComponentScan
@Transactional
class ExtensionUpdateManager(
    private val extensionManager: ExtensionManager,
    defaultRepositories: List<UpdateRepository>,
) : UpdateManager(extensionManager) {

    init {
        defaultRepositories.forEach { addRepository(it) }
    }

    fun getExtensions(): List<ExtensionDto> {
        refresh()
        return plugins.map { extension ->
            extension as ExtensionInfo
            ExtensionDto(
                id = extension.id,
                logo = extension.logo,
                name = extension.name,
                description = extension.description,
                installedVersion = extensionManager.getPlugin(extension.id)?.descriptor?.version,
                nextVersion = getNextVersion(extension.id),
            )
        }
    }

    fun getNextVersion(extensionId: String): String? {
        val latestVersion = getLastPluginRelease(extensionId)?.version ?: return null
        val installedVersion = extensionManager.getPlugin(extensionId)?.descriptor?.version
        val versionManager = extensionManager.versionManager
        return if (installedVersion == null || versionManager.compareVersions(latestVersion, installedVersion) > 0) {
            latestVersion
        } else {
            null
        }
    }

    fun installExtension(id: String, version: String) {
        require(extensionManager.getPlugin(id) == null) {
            "Extension with id '$id' is already installed"
        }
        try {
            check(installPlugin(id, version)) { "Unable to install" }
        } catch (e: Exception) {
            try {
                uninstallExtension(id)
            } catch (_: Exception) {
                // ignored
            }
            throw RuntimeException("Failed to install extension with id=$id and version=$version", e)
        }
    }

    fun updateExtension(id: String, version: String) {
        try {
            check(updatePlugin(id, version)) { "Unable to update" }
        } catch (e: Exception) {
            throw RuntimeException("Failed to update extension with id=$id and version=$version")
        }
    }

    fun uninstallExtension(id: String) {
        check(uninstallPlugin(id)) { "Failed to uninstall extension with id=$id" }
    }

    override fun getPluginsMap(): Map<String, PluginInfo> {
        val extensionsMap = mutableMapOf<String, PluginInfo>()
        getRepositories().forEach { repository ->
            repository.plugins.forEach { (extensionId, extension) ->
                val existingExtension = extensionsMap[extensionId]
                if (existingExtension == null) {
                    extensionsMap[extensionId] = extension
                } else {
                    extension.releases.forEach { newRelease ->
                        if (existingExtension.releases.none { it.version == newRelease.version && it.date > newRelease.date }) {
                            existingExtension.releases.removeIf { it.version == newRelease.version }
                            existingExtension.releases.add(newRelease)
                        }
                    }
                }
            }
        }
        return extensionsMap
    }

    override fun addRepository(repository: UpdateRepository) {
        if (repositories == null) {
            repositories = mutableListOf()
        }
        if (repositories.none { it.id == repository.id }) {
            repository.refresh()
            repositories.add(repository)
            if (repository is ExtensionUpdateRepository) {
                repository.getRepositories().forEach { addRepository(it) }
            }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}