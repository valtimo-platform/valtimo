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

package com.ritense.plugin.domain

import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated

@Embeddable
data class PluginConfigurationReference(
    @Enumerated(EnumType.STRING)
    @Column(name = "reference_type")
    val type: PluginConfigurationReferenceType = PluginConfigurationReferenceType.FIXED,

    @Column(name = "plugin_definition_key")
    val pluginDefinitionKey: String? = null
) {
    init {
        when (type) {
            PluginConfigurationReferenceType.FIXED -> require(pluginDefinitionKey == null) {
                "pluginDefinitionKey must be null when reference type is FIXED"
            }

            PluginConfigurationReferenceType.BUILDING_BLOCK -> require(!pluginDefinitionKey.isNullOrBlank()) {
                "pluginDefinitionKey is required when reference type is BUILDING_BLOCK"
            }
        }
    }
}

enum class PluginConfigurationReferenceType {
    FIXED,
    BUILDING_BLOCK
}
