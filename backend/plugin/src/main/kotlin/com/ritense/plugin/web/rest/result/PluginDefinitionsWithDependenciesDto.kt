/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.plugin.web.rest.result

import com.ritense.plugin.domain.PluginDependency

data class PluginDefinitionsWithDependenciesDto(
    val plugins: List<PluginWithDependenciesDto>
)

/**
 * [source] discriminates embedded plugin definitions (identified by [pluginDefinitionKey] alone,
 * unversioned) from external plugin definitions referenced via a `BUILDING_BLOCK`
 * `PluginConfigurationReference` (identified by [pluginDefinitionKey] == `pluginId` +
 * [pluginDefinitionVersion]). Defaults to [PluginRequirementSource.EMBEDDED] and leaves
 * [pluginDefinitionVersion] `null` so existing frontend consumers built against the embedded-only
 * shape keep working unchanged.
 */
data class PluginWithDependenciesDto(
    val pluginDefinitionKey: String,
    val dependencies: List<PluginDependency>,
    val source: PluginRequirementSource = PluginRequirementSource.EMBEDDED,
    val pluginDefinitionVersion: String? = null,
)

enum class PluginRequirementSource {
    EMBEDDED,
    EXTERNAL,
}