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

/**
 * A single write-back rule for a `@PluginAction` (or external-plugin action) return value.
 * [source] is an RFC 6901 JSON pointer into the action's result (an empty string selects the
 * whole result); [target] is a value-resolver-prefixed key (`doc:`, `pv:`, `case:`) describing
 * where to write it. Stored as a JSON list on the `process_link.action_result_mappings` column,
 * shared by both [PluginProcessLink] (embedded) and the external-plugin process link.
 */
data class PluginActionResultMapping(
    val source: String,
    val target: String,
)
