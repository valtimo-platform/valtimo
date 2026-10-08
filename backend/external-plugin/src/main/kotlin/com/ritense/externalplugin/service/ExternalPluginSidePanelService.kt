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

import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.web.rest.dto.ExternalPluginSidePanelDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Resolves a configuration's `side-panel` bundle for the app-wide side panel. Only `AVAILABLE`
 * definitions resolve, like menu pages; access to the panel's data is PBAC ∩ allowlist at render
 * time through the downscoped user token.
 */
@Service
@SkipComponentScan
@Transactional(readOnly = true)
class ExternalPluginSidePanelService(
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val bundleUrlResolver: ExternalPluginBundleUrlResolver,
) {

    fun getSidePanel(configurationId: UUID, bundleKey: String?): ExternalPluginSidePanelDto? {
        val configuration = configurationRepository.findById(configurationId).orElse(null) ?: return null
        val definition = definitionRepository.findById(configuration.definitionId).orElse(null) ?: return null
        if (definition.status != ExternalPluginDefinitionStatus.AVAILABLE) return null

        val bundleUrl = bundleUrlResolver.resolve(configurationId, SIDE_PANEL_TYPE, bundleKey) ?: return null
        return ExternalPluginSidePanelDto(
            configurationId = configurationId,
            bundleKey = bundleKey,
            bundleUrl = bundleUrl,
        )
    }

    companion object {
        private const val SIDE_PANEL_TYPE = "side-panel"
    }
}
