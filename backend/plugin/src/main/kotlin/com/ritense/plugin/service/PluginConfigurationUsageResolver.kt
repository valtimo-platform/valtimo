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

package com.ritense.plugin.service

import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.plugin.repository.PluginProcessLinkRepositoryImpl
import com.ritense.plugin.web.rest.dto.PluginUsageDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * In-use guard data source for embedded plugin configurations. Mirrors the external-plugin
 * resolver: returns one [PluginUsageDto] per `PluginProcessLink` that references the configuration
 * by its UUID. BUILDING_BLOCK references resolve dynamically per building-block context and
 * are stored with `plugin_configuration_id = NULL`, so they are correctly excluded by
 * `findByPluginConfigurationId` — only FIXED references block deletion of a specific
 * configuration.
 */
@Service
@SkipComponentScan
@Transactional(readOnly = true)
@Suppress("DEPRECATION")
class PluginConfigurationUsageResolver(
    private val pluginConfigurationRepository: PluginConfigurationRepository,
    private val pluginProcessLinkRepository: PluginProcessLinkRepositoryImpl,
    private val metaResolver: ProcessDefinitionUsageMetaResolver,
) {

    fun findUsagesForConfiguration(configurationId: PluginConfigurationId): List<PluginUsageDto> {
        val configuration = pluginConfigurationRepository.findById(configurationId).orElse(null)
            ?: return emptyList()
        val links = pluginProcessLinkRepository.findByPluginConfigurationId(configurationId)
        if (links.isEmpty()) return emptyList()

        val metaCache = mutableMapOf<String, ProcessDefinitionUsageMeta>()
        return links.map { link ->
            val meta = metaCache.getOrPut(link.processDefinitionId) {
                metaResolver.resolveMeta(link.processDefinitionId)
            }
            PluginUsageDto(
                configurationId = configurationId.id,
                configurationTitle = configuration.title,
                parentType = meta.parentType,
                parentKey = meta.parentKey,
                parentVersionTag = meta.parentVersionTag,
                processDefinitionId = link.processDefinitionId,
                processDefinitionKey = meta.processDefinitionKey,
                processDefinitionName = meta.processDefinitionName,
                activityId = link.activityId,
                activityName = metaResolver.resolveActivityName(meta, link.activityId),
                processLinkId = link.id,
            )
        }
    }
}
