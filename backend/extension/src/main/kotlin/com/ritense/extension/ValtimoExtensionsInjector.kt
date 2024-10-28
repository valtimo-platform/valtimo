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
import com.ritense.valtimo.contract.extension.ExtensionRegistrationListener
import jakarta.annotation.PostConstruct
import org.pf4j.PluginState.STARTED
import org.pf4j.PluginState.STOPPED
import org.pf4j.PluginStateEvent
import org.pf4j.PluginStateListener
import org.pf4j.spring.ExtensionsInjector
import org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory
import org.springframework.stereotype.Component

@SkipComponentScan
@Component
class ValtimoExtensionsInjector(
    private val extensionManager: ExtensionManager,
    private val extensionRegistrationListeners: List<ExtensionRegistrationListener>,
) : PluginStateListener, ExtensionsInjector(
    extensionManager,
    extensionManager.applicationContext.autowireCapableBeanFactory as AbstractAutowireCapableBeanFactory
) {

    @PostConstruct
    fun init() {
        injectExtensions()
        extensionManager.addPluginStateListener(this)
    }

    override fun pluginStateChanged(event: PluginStateEvent) {
        when (event.pluginState) {
            STARTED -> extensionManager.getExtensionClassNames(event.plugin.pluginId).forEach { extensionClassName ->
                registerExtension(event.plugin.pluginClassLoader.loadClass(extensionClassName))
            }

            STOPPED -> extensionManager.getExtensionClassNames(event.plugin.pluginId).forEach { extensionClassName ->
                unregisterExtension(event.plugin.pluginClassLoader.loadClass(extensionClassName))
            }

            else -> {}
        }
    }

    public override fun registerExtension(extensionClass: Class<*>) {
        try {
            extensionRegistrationListeners.forEach { listener ->
                listener.extensionRegistered(extensionClass)
            }
        } catch (e: Exception) {
            try {
                unregisterExtension(extensionClass)
            } catch (_: Exception) {
                // ignored
            }
            throw RuntimeException("Failed to register extension $extensionClass", e)
        }
    }

    fun unregisterExtension(extensionClass: Class<*>) {
        val exceptions = mutableListOf<Exception>()
        extensionRegistrationListeners.forEach { listener ->
            try {
                listener.extensionUnregistered(extensionClass)
            } catch (e: Exception) {
                exceptions.add(RuntimeException("Failed to unregister extension $extensionClass", e))
            }
        }
        exceptions.forEach { e -> throw e}
    }
}