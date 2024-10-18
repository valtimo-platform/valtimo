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

import com.ritense.extension.model.ExtensionRegistrationListener
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import jakarta.annotation.PostConstruct
import org.pf4j.PluginState.STARTED
import org.pf4j.PluginState.STOPPED
import org.pf4j.PluginStateEvent
import org.pf4j.PluginStateListener
import org.pf4j.spring.SpringPluginManager
import org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.nio.file.Path

@Component
@SkipComponentScan
@Transactional
class ExtensionManager(
    pluginsRoots: Path,
    val extensionRegistrationListeners: List<ExtensionRegistrationListener>,
) : SpringPluginManager(pluginsRoots), PluginStateListener {

    @PostConstruct
    override fun init() {
        loadPlugins()
        startPlugins()

        newExtensionInjector().injectExtensions()
        addPluginStateListener(this)
    }

    override fun pluginStateChanged(event: PluginStateEvent) {
        when (event.pluginState) {
            STARTED -> getExtensionClassNames(event.plugin.pluginId).forEach { extensionClassName ->
                newExtensionInjector().registerExtension(event.plugin.pluginClassLoader.loadClass(extensionClassName))
            }

            STOPPED -> getExtensionClassNames(event.plugin.pluginId).forEach { extensionClassName ->
                newExtensionInjector().unregisterExtension(extensionClassName)
            }

            else -> {}
        }
    }

    private fun newExtensionInjector() = ValtimoExtensionsInjector(this, getBeanFactory())

    private fun getBeanFactory() = applicationContext.autowireCapableBeanFactory as AbstractAutowireCapableBeanFactory
}