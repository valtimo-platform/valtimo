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

package com.ritense.plugin.domain

import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.ProcessLink
import jakarta.persistence.DiscriminatorValue
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import java.util.UUID

/**
 * Test-only stand-in for `ExternalPluginProcessLink`: an STI sibling of [PluginProcessLink] that
 * also embeds [PluginConfigurationReference] on the same shared columns (`reference_type`,
 * `plugin_definition_key`, `plugin_definition_version`). Exists solely so
 * [PluginConfigurationReferenceSharedStiColumnsTest] can build Hibernate metadata for two siblings sharing
 * the embeddable without this module depending on the real
 * `com.ritense.externalplugin.domain.ExternalPluginProcessLink` in `:backend:external-plugin`.
 */
@Entity
@DiscriminatorValue("_test_external_plugin_stand_in")
class ExternalPluginProcessLinkStandIn(
    id: UUID,
    processDefinitionId: String,
    activityId: String,
    activityType: ActivityTypeWithEventName,

    @Embedded
    val pluginConfigurationReference: PluginConfigurationReference = PluginConfigurationReference(),
) : ProcessLink(
    id,
    processDefinitionId,
    activityId,
    activityType,
    "_test_external_plugin_stand_in",
) {
    override fun copy(id: UUID, processDefinitionId: String) = ExternalPluginProcessLinkStandIn(
        id = id,
        processDefinitionId = processDefinitionId,
        activityId = activityId,
        activityType = activityType,
        pluginConfigurationReference = pluginConfigurationReference,
    )
}
