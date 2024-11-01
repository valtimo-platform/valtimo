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
import org.pf4j.PluginState
import org.pf4j.PluginStateEvent
import org.pf4j.PluginWrapper
import org.pf4j.spring.SpringPluginManager
import org.springframework.core.io.Resource
import org.springframework.core.io.support.ResourcePatternResolver
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.nio.file.Path
import kotlin.io.path.Path

@Component
@SkipComponentScan
@Transactional
class ExtensionManager(
    pluginsRoots: List<Path>,
    private val resourceResolver: ResourcePatternResolver,
) : SpringPluginManager(pluginsRoots) {

    init {
        systemVersion = javaClass.getPackage().implementationVersion ?: "0.0.0"
    }

    @PostConstruct
    override fun init() {
        loadPlugins()
        startPlugins()
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

    fun getPublicResource(extensionId: String, publicFile: String): Resource? {
        val extension = getPlugin(extensionId) ?: return null
        val publicFolder = extension.pluginClassLoader.getResource("public") ?: return null
        val filePath = Path(publicFolder.toURI().toString(), publicFile).toString()
        val fileResource = resourceResolver.getResource(filePath)
        return if (fileResource.isReadable) {
            fileResource
        } else {
            null
        }
    }

    fun getAllResources(extensionId: String): List<Resource> {
        val extension = getPlugin(extensionId)
        val metaInfPath = extension.pluginClassLoader.getResource("META-INF")!!.toURI().toString()
        return resourceResolver.getResources(metaInfPath.replace("/META-INF", "/**"))
            .filter { it.isReadable }
    }

    override fun createPluginFactory() = ExtensionFactory()

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}