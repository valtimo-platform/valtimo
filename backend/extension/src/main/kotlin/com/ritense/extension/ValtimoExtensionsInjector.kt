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
import com.ritense.valtimo.contract.extension.ExtensionClassRegistrationListener
import com.ritense.valtimo.contract.extension.ExtensionResourcesRegistrationListener
import jakarta.annotation.PostConstruct
import mu.KotlinLogging
import org.pf4j.PluginState.FAILED
import org.pf4j.PluginState.STARTED
import org.pf4j.PluginState.STOPPED
import org.pf4j.PluginStateEvent
import org.pf4j.PluginStateListener
import org.pf4j.PluginWrapper
import org.pf4j.spring.ExtensionsInjector
import org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory
import org.springframework.stereotype.Component

@SkipComponentScan
@Component
class ValtimoExtensionsInjector(
    private val extensionManager: ExtensionManager,
    private val extensionClassRegistrationListeners: List<ExtensionClassRegistrationListener>,
    private val extensionResourcesRegistrationListeners: List<ExtensionResourcesRegistrationListener>,
) : PluginStateListener, ExtensionsInjector(
    extensionManager,
    extensionManager.applicationContext.autowireCapableBeanFactory as AbstractAutowireCapableBeanFactory
) {

    @PostConstruct
    fun init() {
        extensionManager.addPluginStateListener(this)
        injectExtensions()
    }

    override fun injectExtensions() {
        springPluginManager.startedPlugins.toList().forEach { extension -> registerExtension(extension) }
    }

    override fun pluginStateChanged(event: PluginStateEvent) {
        try {
            when (event.pluginState) {
                STARTED -> registerExtension(event.plugin)
                STOPPED -> unregisterExtension(event.plugin)
                FAILED -> try {
                    unregisterExtension(event.plugin)
                } catch (t: Throwable) {
                    logger.debug(t) { "Error while unregistering extension ${event.plugin.pluginId}" }
                }

                else -> {}
            }
        } catch (e: Exception) {
            extensionManager.fail(event.plugin, e)
        }
    }

    fun registerExtension(extension: PluginWrapper) {
        extensionManager.getExtensionClasses(extension.pluginId).forEach { registerExtension(it) }
        registerResources(extension.pluginId)
    }

    public override fun registerExtension(extensionClass: Class<*>) {
        extensionClassRegistrationListeners.forEach { listener ->
            listener.classRegistered(extensionClass)
        }
    }

    fun registerResources(extensionId: String) {
        val resources = extensionManager.getAllResources(extensionId)
        extensionResourcesRegistrationListeners.forEach { listener -> listener.registerResources(resources) }
    }

    fun unregisterExtension(extension: PluginWrapper) {
        unregisterResources(extension.pluginId)
            .firstOrNull()?.let { throw it }
        extensionManager.getExtensionClassNames(extension.pluginId).forEach { extensionClassName ->
            unregisterExtension(extension.pluginClassLoader.loadClass(extensionClassName))
                .firstOrNull()?.let { throw it }
        }
    }

    fun unregisterResources(extensionId: String): List<Exception> {
        val exceptions = mutableListOf<Exception>()
        val resources = extensionManager.getAllResources(extensionId)
        extensionResourcesRegistrationListeners.forEach { listener ->
            try {
                listener.unregisterResources(resources)
            } catch (e: Exception) {
                exceptions.add(RuntimeException("Failed to unregister extension resources", e))
            }
        }
        return exceptions
    }

    fun unregisterExtension(extensionClass: Class<*>): List<Exception> {
        val exceptions = mutableListOf<Exception>()
        extensionClassRegistrationListeners.forEach { listener ->
            try {
                listener.classUnregistered(extensionClass)
            } catch (e: Exception) {
                exceptions.add(RuntimeException("Failed to unregister extension $extensionClass", e))
            }
        }
        return exceptions
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}