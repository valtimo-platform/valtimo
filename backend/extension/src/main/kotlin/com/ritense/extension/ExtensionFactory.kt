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

import mu.KotlinLogging
import org.pf4j.Plugin
import org.pf4j.PluginFactory
import org.pf4j.PluginWrapper
import java.lang.reflect.Modifier

class ExtensionFactory : PluginFactory {

    override fun create(extensionWrapper: PluginWrapper): Plugin {
        val extensionClassName = extensionWrapper.descriptor.pluginClass
        logger.debug { "Create instance for extension '$extensionClassName'" }

        val extensionClass = extensionWrapper.pluginClassLoader.loadClass(extensionClassName)

        val modifiers = extensionClass.modifiers
        check(
            !Modifier.isAbstract(modifiers)
                && !Modifier.isInterface(modifiers)
                && Plugin::class.java.isAssignableFrom(extensionClass)
        ) {
            "The extension class '$extensionClassName' is not valid"
        }

        try {
            val constructor = extensionClass.getConstructor(PluginWrapper::class.java)
            return constructor.newInstance(extensionWrapper) as Plugin
        } catch (e: NoSuchMethodException) {
            throw IllegalStateException("Extension is missing constructor '$extensionClass(PluginWrapper wrapper)'")
        }
    }

    companion object {
        val logger = KotlinLogging.logger {}
    }
}