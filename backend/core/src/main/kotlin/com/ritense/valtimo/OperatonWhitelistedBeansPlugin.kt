/*
 *  Copyright 2015-2024 Ritense BV, the Netherlands.
 *
 *  Licensed under EUPL, Version 1.2 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" basis,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package com.ritense.valtimo

import com.ritense.valtimo.contract.annotation.ProcessBean
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.impl.cfg.AbstractProcessEnginePlugin
import org.operaton.bpm.engine.impl.cfg.ProcessEngineConfigurationImpl
import org.operaton.bpm.engine.spring.SpringExpressionManager
import org.springframework.context.ApplicationContext

class OperatonWhitelistedBeansPlugin(
    private val applicationContext: ApplicationContext
) : AbstractProcessEnginePlugin() {

    override fun preInit(processEngineConfiguration: ProcessEngineConfigurationImpl?) {
        logger.info("Registering process beans...")
        requireNotNull(processEngineConfiguration) { "No process engine configuration found. Failed to register process beans." }

        // Use a lazy map that only resolves beans when accessed at runtime
        val lazyBeansMap = LazyProcessBeansMap(applicationContext)
        processEngineConfiguration.beans = lazyBeansMap
        processEngineConfiguration.setExpressionManager(SpringExpressionManager(applicationContext, lazyBeansMap))

        logger.info("Successfully registered process beans.")
    }

    companion object {
        val logger = KotlinLogging.logger {}
    }
}

/**
 * A map implementation that lazily resolves @ProcessBean annotated beans.
 * This avoids circular dependency issues during application startup.
 *
 * The delegate is only resolved when get() is called, not during size/isEmpty checks.
 */
private class LazyProcessBeansMap(
    private val applicationContext: ApplicationContext
) : AbstractMap<Any, Any>() {

    @Volatile
    private var resolved = false
    private var delegate: Map<String, Any> = emptyMap()

    private fun ensureResolved(): Map<String, Any> {
        if (!resolved) {
            synchronized(this) {
                if (!resolved) {
                    delegate = applicationContext.getBeansWithAnnotation(ProcessBean::class.java)
                    resolved = true
                }
            }
        }
        return delegate
    }

    override val entries: Set<Map.Entry<Any, Any>>
        get() = ensureResolved().entries.map { Entry(it.key, it.value) }.toSet()

    override val keys: Set<Any>
        get() = ensureResolved().keys

    override val values: Collection<Any>
        get() = ensureResolved().values

    override val size: Int
        get() = if (resolved) delegate.size else 0  // Don't trigger resolution for size check

    override fun isEmpty(): Boolean = if (resolved) delegate.isEmpty() else false  // Assume not empty

    override fun containsKey(key: Any): Boolean = ensureResolved().containsKey(key)

    override fun containsValue(value: Any): Boolean = ensureResolved().containsValue(value)

    override fun get(key: Any): Any? = ensureResolved()[key]

    private class Entry(override val key: Any, override val value: Any) : Map.Entry<Any, Any>
}