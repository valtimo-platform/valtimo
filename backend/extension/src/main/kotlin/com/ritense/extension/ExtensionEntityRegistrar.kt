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
import org.pf4j.PluginRepository
import org.springframework.orm.jpa.persistenceunit.MutablePersistenceUnitInfo
import org.springframework.orm.jpa.persistenceunit.PersistenceUnitPostProcessor
import org.springframework.stereotype.Component

@SkipComponentScan
@Component
class ExtensionEntityRegistrar(
    private val extensionRepository: PluginRepository,
) : PersistenceUnitPostProcessor {

    override fun postProcessPersistenceUnitInfo(pui: MutablePersistenceUnitInfo) {
        extensionRepository.pluginPaths.forEach { extensionPath ->
            pui.addJarFileUrl(extensionPath.toUri().toURL())
        }
        pui.addManagedClassName("com.ritense.valtimoplugins.freemarker.domain.ValtimoTemplate")
    }
}