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
import org.pf4j.PluginStateListener
import org.pf4j.PluginWrapper
import org.pf4j.spring.SpringPluginManager
import org.springframework.core.io.support.ResourcePatternResolver
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.nio.file.Files
import java.nio.file.Path
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.io.path.Path
import kotlin.io.path.absolutePathString
import kotlin.io.path.outputStream

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

    fun getExtensionsFrontendZip(extensions: List<PluginWrapper>): Path {
        val extensionsFrontendZip = Files.createTempFile("frontend", ".zip")
        ZipOutputStream(extensionsFrontendZip.outputStream()).use { zipOut ->
            extensions.forEach { extension ->
                val frontendFolder = extension.pluginClassLoader.getResource("frontend")
                if (frontendFolder != null) {
                    resourceResolver.getResources("${frontendFolder.toURI()}/**")
                        .filter { it.isReadable }
                        .forEach { resource ->
                            zipOut.putNextEntry(
                                ZipEntry(
                                    Path(
                                        "/frontend",
                                        extension.pluginId,
                                        resource.url.path.substringAfter("!/frontend/")
                                    ).absolutePathString()
                                )
                            )
                            zipOut.write(resource.inputStream.readAllBytes())
                        }
                }
            }
        }
        return extensionsFrontendZip
    }

    override fun createPluginFactory() = ExtensionFactory()
}