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

import com.ritense.case_.service.ExternalPluginCaseWidgetResolver
import com.ritense.case_.service.ExternalPluginTabDefinition
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
import java.util.UUID

/**
 * external-plugin's implementation of the case-module [ExternalPluginCaseWidgetResolver] SPI. The
 * widget sibling of [ExternalPluginCaseTabResolverImpl]: resolves a plugin configuration's
 * `case-widget` bundle to its absolute URL by delegating to the shared
 * [ExternalPluginBundleUrlResolver] with the `case-widget` bundle type, and the configuration's
 * plugin definition (`pluginId`/version) for the self-describing widget export.
 */
@Service
@SkipComponentScan
class ExternalPluginCaseWidgetResolverImpl(
    private val bundleUrlResolver: ExternalPluginBundleUrlResolver,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
) : ExternalPluginCaseWidgetResolver {

    override fun resolveBundleUrl(configurationId: UUID, bundleKey: String?): String? =
        bundleUrlResolver.resolve(configurationId, CASE_WIDGET_TYPE, bundleKey)

    override fun resolvePluginDefinition(configurationId: UUID): ExternalPluginTabDefinition? {
        val configuration = configurationRepository.findById(configurationId).orElse(null) ?: return null
        val definition = definitionRepository.findById(configuration.definitionId).orElse(null) ?: return null
        return ExternalPluginTabDefinition(definition.pluginId, definition.version)
    }

    companion object {
        private const val CASE_WIDGET_TYPE = "case-widget"
    }
}
