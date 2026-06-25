/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

package com.ritense.externalplugin.service

import com.ritense.case_.service.ExternalPluginCaseTabResolver
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * external-plugin's implementation of the case-module [ExternalPluginCaseTabResolver] SPI. Resolves
 * a plugin configuration's `case-tab` bundle to its absolute URL
 * (`${definition.baseUrl}/${definition.version}${bundle.path}`, where `definition.baseUrl` is
 * `{hostOrigin}/plugins/{pluginId}`).
 */
@Service
@SkipComponentScan
@Transactional(readOnly = true)
class ExternalPluginCaseTabResolverImpl(
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
) : ExternalPluginCaseTabResolver {

    override fun resolveBundleUrl(configurationId: UUID, bundleKey: String?): String? {
        val configuration = configurationRepository.findById(configurationId).orElse(null) ?: return null
        val definition = definitionRepository.findById(configuration.definitionId).orElse(null) ?: return null

        val bundles = definition.manifestJson?.get("frontendBundles") ?: return null
        if (!bundles.isArray) return null

        val caseTabBundles = bundles.filter { it.get("type")?.asText() == CASE_TAB_TYPE }
        val bundle = when {
            bundleKey != null -> caseTabBundles.firstOrNull { it.get("key")?.asText() == bundleKey }
            else -> caseTabBundles.singleOrNull() ?: caseTabBundles.firstOrNull()
        } ?: return null

        val path = bundle.get("path")?.asText() ?: return null
        return "${definition.baseUrl}/${definition.version}$path"
    }

    companion object {
        private const val CASE_TAB_TYPE = "case-tab"
    }
}
