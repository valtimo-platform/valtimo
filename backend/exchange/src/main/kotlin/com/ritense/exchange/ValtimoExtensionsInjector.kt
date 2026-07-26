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
import org.springframework.context.ApplicationListener
import org.springframework.context.event.ContextRefreshedEvent
import org.springframework.stereotype.Component

@SkipComponentScan
@Component
class ValtimoExtensionsInjector(
    private val extensionManager: ExtensionManager,
    private val extensionClassRegistrationListeners: List<ExtensionClassRegistrationListener>,
) : PluginStateListener, ApplicationListener<ContextRefreshedEvent>, ExtensionsInjector(
    extensionManager,
    extensionManager.applicationContext.autowireCapableBeanFactory as AbstractAutowireCapableBeanFactory
) {

    private val springDeployer = ExtensionSpringDeployer(extensionManager)
    private var injected = false

    @PostConstruct
    fun init() {
        extensionManager.addPluginStateListener(this)
    }

    /**
     * Deploy started extensions only once the host context is fully refreshed, so
     * the datasource, EntityManagerFactory and RequestMappingHandlerMapping the
     * deployer needs all exist. Doing this in @PostConstruct would run too early.
     */
    override fun onApplicationEvent(event: ContextRefreshedEvent) {
        if (injected) return
        injected = true
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
        // Deploy the extension's whole backend (services, repositories, REST
        // controllers, its Liquibase tables) into the host context — not just the
        // pf4j @Extension classes — so an ordinary Valtimo plugin works end-to-end
        // when dropped in as a jar. Each phase is isolated inside the deployer, so
        // a plugin that only partially fits this host still loads what it can.
        springDeployer.deploy(extension)
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