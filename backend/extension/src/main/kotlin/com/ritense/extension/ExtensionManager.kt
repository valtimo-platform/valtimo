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

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import jakarta.annotation.PostConstruct
import mu.KotlinLogging
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
import kotlin.io.path.Path

@Component
@SkipComponentScan
@Transactional
class ExtensionManager(
    pluginsRoots: List<Path>,
    private val resourceResolver: ResourcePatternResolver,
    private val extensionProperties: ExtensionProperties,
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
        checkPluginId(pluginId)

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
        extensionFactory = WhitelistSpringExtensionFactory(this, extensionProperties)
        return extensionFactory
    }

    fun fail(extension: PluginWrapper, exception: Exception?) {
        logger.error(exception) { "Error in extension ${extension.pluginId}" }
        val oldState = extension.pluginState
        extension.pluginState = PluginState.FAILED
        extension.failedException = exception
        if (oldState == PluginState.STARTED) {
            extension.plugin.stop()
        }
        startedPlugins.remove(extension)
        firePluginStateEvent(PluginStateEvent(this, extension, oldState))
    }

    fun getPublicResource(extensionId: String, file: String): Resource? {
        val extension = getPlugin(extensionId) ?: return null
        val jarPath = getJarPath(extension)
        val fileCandidate1 = Path(jarPath, "public", file)
        val fileCandidate2 = Path(fileCandidate1.parent.toString(), "*", fileCandidate1.fileName.toString())
        listOf(
            fileCandidate1.toString(),
            // frontend dynamic import(..) logic:
            "$fileCandidate1.*",
            Path(fileCandidate1.toString(), "index.*").toString(),
            fileCandidate2.toString(),
            "$fileCandidate2.*",
            Path(fileCandidate2.toString(), "index.*").toString(),
        ).forEach { filePathCandidate ->
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

    fun getAllResources(extensionId: String): List<Resource> {
        val extension = getPlugin(extensionId)
        val jarPath = getJarPath(extension)
        return resourceResolver.getResources(Path(jarPath, "**").toString())
            .filter { it.isReadable }
    }

    fun getJarPath(extension: PluginWrapper): String {
        return Path(extension.pluginClassLoader.getResource("META-INF")!!.toURI().toString()).parent.toString()
    }

    override fun createPluginFactory() = ExtensionInstanceFactory()

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}