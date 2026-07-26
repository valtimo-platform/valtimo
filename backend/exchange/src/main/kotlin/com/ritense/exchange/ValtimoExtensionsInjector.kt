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

package com.ritense.exchange

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import jakarta.annotation.PostConstruct
import io.github.oshai.kotlinlogging.KotlinLogging
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
        // Register each started extension independently and in isolation: a
        // single extension that fails to wire (e.g. a plugin whose internal
        // beans can't be autowired in this host) is marked FAILED and skipped,
        // rather than aborting application startup and taking down every other
        // extension along with it.
        springPluginManager.startedPlugins.toList().forEach { extension ->
            try {
                registerExtension(extension)
            } catch (e: Exception) {
                logger.error(e) { "Failed to register extension '${extension.pluginId}'; marking it FAILED" }
                extensionManager.fail(extension, e)
            }
        }
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
        // Register each extension class in isolation. A class that can't be
        // wired into this host (e.g. a plugin PluginFactory whose collaborators
        // aren't available as beans here) is logged and skipped, so the rest of
        // the extension — and crucially its served frontend bundle — still load.
        extensionManager.getExtensionClasses(extension.pluginId).forEach { extensionClass ->
            try {
                registerExtension(extensionClass)
            } catch (e: Exception) {
                logger.warn(e) {
                    "Skipping extension class '${extensionClass.name}' of '${extension.pluginId}': could not register it in this host"
                }
            }
        }
    }

    public override fun registerExtension(extensionClass: Class<*>) {
        extensionClassRegistrationListeners.forEach { listener ->
            listener.classRegistered(extensionClass)
        }
    }

    fun unregisterExtension(extension: PluginWrapper) {
        extensionManager.getExtensionClassNames(extension.pluginId).forEach { extensionClassName ->
            unregisterExtension(extension.pluginClassLoader.loadClass(extensionClassName))
                .firstOrNull()?.let { throw it }
        }
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