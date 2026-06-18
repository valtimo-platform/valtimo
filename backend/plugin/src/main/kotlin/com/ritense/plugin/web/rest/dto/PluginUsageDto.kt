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
 * One BPMN activity that references a plugin configuration. Used by the "configuration in use"
 * and "host in use" guards on both the embedded and external plugin paths — the shape is the
 * same in all four 409 payloads (`hostId | configurationId` × `embedded | external`).
 */
data class PluginUsageDto(
    val configurationId: UUID,
    val configurationTitle: String,
    val parentType: PluginUsageParentType,
    val parentKey: String?,
    val parentVersionTag: String?,
    val processDefinitionId: String,
    val processDefinitionKey: String?,
    val processDefinitionName: String?,
    val activityId: String,
    val activityName: String?,
    val processLinkId: UUID,
)
