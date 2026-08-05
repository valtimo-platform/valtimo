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

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import jakarta.annotation.PostConstruct
import jakarta.persistence.EntityManager
import io.github.oshai.kotlinlogging.KotlinLogging
import org.pf4j.ExtensionFactory
import org.pf4j.PluginState
import org.pf4j.PluginStateEvent
import org.pf4j.PluginWrapper
import org.pf4j.spring.SpringPluginManager
import org.springframework.core.io.Resource
import org.springframework.core.io.support.ResourcePatternResolver
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.io.FileNotFoundException
import java.nio.file.Path
import org.pf4j.PluginNotFoundException
import kotlin.io.path.Path

@Component
@SkipComponentScan
@Transactional
class PackageManager(
    pluginsRoots: List<Path>,
    private val resourceResolver: ResourcePatternResolver,
    private val marketplaceProperties: MarketplaceProperties,
    private val entityManager: EntityManager,
) : SpringPluginManager(pluginsRoots) {

    init {
        systemVersion = javaClass.getPackage().implementationVersion ?: "0.0.0"
    }

    @PostConstruct
    override fun init() {
        loadPlugins()
        startPlugins()
    }

    override fun deletePlugin(pluginId: String?): Boolean {
        try {
            checkPluginId(pluginId)
        } catch (e: PluginNotFoundException) {
            logger.error(e) { "Failed to delete plugin '$pluginId'" }
            return false
        }

        val pluginWrapper = try {
            getPlugin(pluginId)
        } catch (e: NoClassDefFoundError) {
            null
        }

        val pluginState = stopPlugin(pluginId)
        if (pluginState.isStarted) {
            logger.error("Failed to stop plugin '{}' on delete", pluginId)
            return false
        }

        val plugin = try {
            pluginWrapper?.plugin
        } catch (e: ClassNotFoundException) {
            null
        }

        if (!unloadPlugin(pluginId)) {
            logger.error("Failed to unload plugin '{}' on delete", pluginId)
            return false
        }

        plugin?.delete()

        return if (pluginWrapper == null) {
            false
        } else {
            pluginRepository.deletePluginPath(pluginWrapper.pluginPath)
        }
    }

    override fun getExtensionFactory(): ExtensionFactory {
        extensionFactory = WhitelistSpringExtensionFactory(this, marketplaceProperties, entityManager)
        return extensionFactory
    }

    fun fail(pkg: PluginWrapper, exception: Exception?) {
        logger.error(exception) { "Error in package ${pkg.pluginId}" }
        val oldState = pkg.pluginState
        pkg.pluginState = PluginState.FAILED
        pkg.failedException = exception
        if (oldState == PluginState.STARTED) {
            pkg.plugin.stop()
        }
        startedPlugins.remove(pkg)
        firePluginStateEvent(PluginStateEvent(this, pkg, oldState))
    }

    fun getPublicResource(packageId: String, file: String): Resource? {
        val pkg = getPlugin(packageId) ?: return null
        val filePath = Path(file)
        val publicPath = Path(getJarPath(pkg), "public").toString()
        val fileCandidates = mutableListOf<String>()
        fileCandidates += Path(publicPath, file).toString()

        // frontend dynamic import(..) logic:
        fileCandidates += Path(publicPath, "*", file).toString()
        if (filePath.parent != null) {
            val parent = filePath.parent.toString()
            fileCandidates += Path(publicPath, parent, "*", filePath.fileName.toString()).toString()
            fileCandidates += Path(publicPath, "*", parent, "*", filePath.fileName.toString()).toString()
        }
        fileCandidates.toList().forEach {
            fileCandidates += "$it.*"
            fileCandidates += Path(it, "index.*").toString()
        }
        //

        fileCandidates.forEach { filePathCandidate ->
            try {
                val resource = resourceResolver.getResources(filePathCandidate)
                    .filter { it.isReadable }
                    .minByOrNull { it.filename?.length ?: Int.MAX_VALUE }
                if (resource != null) {
                    return resource
                }
            } catch (e: FileNotFoundException) {
                // Ignore
            }
        }
        return null
    }

    fun getJarPath(pkg: PluginWrapper): String {
        return Path(pkg.pluginClassLoader.getResource("META-INF")!!.toURI().toString()).parent.toString()
    }

    override fun createPluginFactory() = PackageInstanceFactory()

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}