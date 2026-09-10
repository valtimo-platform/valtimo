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

package com.ritense.plugin.web.rest.dto

import java.util.UUID

/**
 * What owns the process definition that a [PluginUsageDto] sits on. `GLOBAL` doubles as the
 * fallback when the process definition can't be loaded — in that case `parentKey` and
 * `parentVersionTag` are both null and the UI degrades gracefully to the raw
 * `processDefinitionId`.
 */
enum class PluginUsageParentType {
    CASE,
    BUILDING_BLOCK,
    GLOBAL,
}

/**
 * One usage of a plugin configuration that blocks its deletion. Used by the "configuration in use"
 * and "host in use" guards on both the embedded and external plugin paths.
 *
 * Several shapes share this DTO:
 * - **Process-link usage** (embedded + external): the BPMN-activity fields are populated and
 *   [tabKey] is null.
 * - **External-plugin case-tab usage**: [tabKey]/[tabName] are populated, [parentType] is `CASE`,
 *   and the process-link fields are null. (A `case-tab` of an external plugin references the
 *   configuration but has no process link.)
 * - **External-plugin case-widget usage**: like the case-tab usage — [tabKey]/[tabName] identify the
 *   owning WIDGETS tab and [widgetKey] the widget within it. (An `external-plugin` widget references
 *   the configuration but has no process link.)
 * - **Building-block mapping usage**: a building block's `pluginConfigurationMappings` reference
 *   the configuration; [buildingBlockKey] names the building block. On a call-activity link the
 *   process-link fields are populated too; on a case-definition ↔ BB link only [parentKey]/
 *   [parentVersionTag] (the case) are.
 * - **Menu-page usage**: a `plugin-page` node in the application menu references the configuration;
 *   [menuItemTitle] names the menu item and [parentType] is `GLOBAL` (a menu page is
 *   application-wide, not case- or process-scoped), with every process-link and tab field null.
 * - **Definition-reference usage** (host deletion only): a `BUILDING_BLOCK`-reference process link
 *   pins a plugin *definition* rather than a configuration — [configurationId] then carries the
 *   definition id and [configurationTitle] the pinned `pluginId@version` pair.
 */
data class PluginUsageDto(
    val configurationId: UUID,
    val configurationTitle: String,
    val parentType: PluginUsageParentType,
    val parentKey: String?,
    val parentVersionTag: String?,
    val processDefinitionId: String? = null,
    val processDefinitionKey: String? = null,
    val processDefinitionName: String? = null,
    val activityId: String? = null,
    val activityName: String? = null,
    val processLinkId: UUID? = null,
    val tabKey: String? = null,
    val tabName: String? = null,
    val buildingBlockKey: String? = null,
    val widgetKey: String? = null,
    val menuItemTitle: String? = null,
)
