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

package com.ritense.plugin.extension

import com.ritense.plugin.PluginDeploymentListener
import com.ritense.plugin.annotation.Plugin
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.extension.ExtensionClassRegistrationListener
import org.springframework.stereotype.Component

@SkipComponentScan
@Component
class ExtensionClassPluginDeployer(
    private val pluginDeploymentListener: PluginDeploymentListener
) : ExtensionClassRegistrationListener {

    override fun classRegistered(extensionClass: Class<*>) {
        if (extensionClass.isAnnotationPresent(Plugin::class.java)) {
            pluginDeploymentListener.deployPluginDefinition(
                extensionClass,
                extensionClass.getAnnotation(Plugin::class.java)
            )
        }
    }

    override fun classUnregistered(extensionClass: Class<*>) {
        if (extensionClass.isAnnotationPresent(Plugin::class.java)) {
            pluginDeploymentListener.undeployPluginDefinition(
                extensionClass,
                extensionClass.getAnnotation(Plugin::class.java)
            )
        }
    }
}