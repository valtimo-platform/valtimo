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

import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Resolves an external-plugin configuration's frontend bundle of a given `type` to its absolute URL
 * (`${definition.baseUrl}/${definition.version}${bundle.path}`, where `definition.baseUrl` is
 * `{hostOrigin}/plugins/{pluginId}`).
 *
 * Generalises the original case-tab-only logic so every iframe-backed feature (case tabs, menu
 * `page`s, user-task `task-form`s) shares one resolver. When [bundleKey] is null the sole bundle of
 * that type is used (falling back to the first when several exist with no key); otherwise the bundle
 * whose `key` matches is selected. Returns null when the configuration, definition, manifest or a
 * matching bundle cannot be resolved.
 */
@Service
@SkipComponentScan
@Transactional(readOnly = true)
class ExternalPluginBundleUrlResolver(
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
) {

    fun resolve(configurationId: UUID, bundleType: String, bundleKey: String?): String? {
        val configuration = configurationRepository.findById(configurationId).orElse(null) ?: return null
        val definition = definitionRepository.findById(configuration.definitionId).orElse(null) ?: return null

        val bundles = definition.manifestJson?.get("frontendBundles") ?: return null
        if (!bundles.isArray) return null

        val typedBundles = bundles.filter { it.get("type")?.asText() == bundleType }
        val bundle = when {
            bundleKey != null -> typedBundles.firstOrNull { it.get("key")?.asText() == bundleKey }
            else -> typedBundles.singleOrNull() ?: typedBundles.firstOrNull()
        } ?: return null

        val path = bundle.get("path")?.asText() ?: return null
        return "${definition.baseUrl}/${definition.version}$path"
    }
}
