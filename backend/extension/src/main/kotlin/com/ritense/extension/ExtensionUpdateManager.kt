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

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.extension.web.rest.Extension
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import mu.KotlinLogging
import org.pf4j.update.PluginInfo
import org.pf4j.update.UpdateManager
import org.pf4j.update.UpdateRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.io.IOException
import java.nio.file.Path
import kotlin.io.path.inputStream

@Component
@SkipComponentScan
@Transactional
class ExtensionUpdateManager(
    private val extensionManager: ExtensionManager,
    private val repositoriesJson: Path,
    private val defaultRepositories: List<UpdateRepository>,
) : UpdateManager(extensionManager, repositoriesJson) {

    fun getExtensions(): List<Extension> {
        refresh()
        val versionManager = extensionManager.versionManager
        return plugins.map { extension ->
            Extension(
                id = extension.id,
                name = extension.name,
                description = extension.description,
                installedVersion = extensionManager.getPlugin(extension.id)?.descriptor?.version,
                availableVersions = extension.releases
                    .map { it.version }
                    .sortedWith { a, b -> versionManager.compareVersions(b, a) },
            )
        }
    }

    fun installExtension(id: String, version: String): Path {
        try {
            check(installPlugin(id, version)) { "Unable to install" }
            val extension = extensionManager.getPlugin(id)
            return extensionManager.getExtensionsFrontendZip(listOf(extension))
        } catch (e: Exception) {
            try {
                uninstallExtension(id)
            } catch (_: Exception) {
                // ignored
            }
            throw RuntimeException("Failed to install extension with id=$id and version=$version", e)
        }
    }

    fun updateExtension(id: String, version: String): Path {
        try {
            check(updatePlugin(id, version)) { "Unable to update" }
            val extension = extensionManager.getPlugin(id)
            return extensionManager.getExtensionsFrontendZip(listOf(extension))
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

    override fun initRepositoriesFromJson() {
        try {
            val repos = jacksonObjectMapper().readValue<List<ExtensionRepository>>(repositoriesJson.inputStream())
            repositories = defaultRepositories.toMutableList()
            repositories.addAll(repos)
            repos.iterator().forEach { repository -> repositories.addAll(repository.getRepositories()) }
        } catch (e: IOException) {
            logger.warn(e) { "Failed to retrieve extension repositories" }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}