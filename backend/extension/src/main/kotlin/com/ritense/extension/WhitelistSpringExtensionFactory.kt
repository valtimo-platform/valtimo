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

import org.pf4j.spring.SpringExtensionFactory
import org.springframework.beans.factory.config.AutowireCapableBeanFactory.AUTOWIRE_CONSTRUCTOR
import org.springframework.context.ApplicationContext

class WhitelistSpringExtensionFactory(
    private val extensionManager: ExtensionManager,
    private val extensionProperties: ExtensionProperties,
) : SpringExtensionFactory(extensionManager, true) {

    override fun <T : Any?> createWithSpring(extensionClass: Class<T>, applicationContext: ApplicationContext): T {
        val extension = extensionManager.whichPlugin(extensionClass)
        val extensionClassNames = extensionManager.getExtensionClassNames(extension.pluginId)

        val illegalConstructorParameters = extensionClass.constructors
            .flatMap { it.parameterTypes.toList() }
            .filter { !extensionProperties.autowireWhitelist.contains(it.name) && !extensionClassNames.contains(it.name) }
        check(illegalConstructorParameters.isEmpty()) {
            "$extensionClass uses illegal constructor parameters: $illegalConstructorParameters"
        }

        return applicationContext.autowireCapableBeanFactory.autowire(
            extensionClass,
            AUTOWIRE_CONSTRUCTOR,
            false
        ) as T
    }
}