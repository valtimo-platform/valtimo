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

import java.util.UUID

/**
 * SPI reporting where building-block surfaces reference a plugin configuration through their
 * `pluginConfigurationMappings` — the call-activity process link and the case-definition ↔
 * building-block link. Mapping values are configuration ids of either plugin system (embedded or
 * external), so the finder is system-agnostic. Implemented by the building-block module (this
 * interface lives here for the same reason as [BuildingBlockPluginConfigurationResolver]: both
 * plugin systems depend on `:backend:plugin`, neither may depend on `:backend:building-block`);
 * plugin systems consult it from their delete guards so a configuration referenced only by a
 * building block cannot be deleted out from under it.
 */
interface BuildingBlockPluginMappingUsageFinder {

    fun findUsages(configurationId: UUID): List<BuildingBlockPluginMappingUsage>
}

/**
 * One `pluginConfigurationMappings` entry referencing the configuration, in one of two shapes:
 * - a building-block **call-activity process link**: [processLinkId], [processDefinitionId] and
 *   [activityId] are set, the case fields are null;
 * - a **case-definition ↔ building-block link**: [caseDefinitionKey] and [caseDefinitionVersionTag]
 *   are set, the process-link fields are null.
 */
data class BuildingBlockPluginMappingUsage(
    val mappingKey: String,
    val buildingBlockDefinitionKey: String,
    val processLinkId: UUID? = null,
    val processDefinitionId: String? = null,
    val activityId: String? = null,
    val caseDefinitionKey: String? = null,
    val caseDefinitionVersionTag: String? = null,
)
