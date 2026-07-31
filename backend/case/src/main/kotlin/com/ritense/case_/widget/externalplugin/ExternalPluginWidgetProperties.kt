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

package com.ritense.case_.widget.externalplugin

import com.fasterxml.jackson.annotation.JsonInclude
import java.util.UUID

/**
 * DTO-side configuration of an `external-plugin` case widget. Nested under `properties` (like the
 * `custom` widget) for frontend consistency; the mapper unpacks it into the dedicated,
 * queryable columns on `case_widget_tab_widget`.
 *
 * [configurationId] is the external-plugin configuration backing the widget (`null` for a widget
 * that imported dangling — its configuration missing in this environment). [bundleKey] selects the
 * `case-widget` bundle when the plugin ships more than one; `null` selects the sole bundle.
 * [pluginDefinitionKey]/[pluginDefinitionVersion] are design-time plugin identity stamped on export
 * so the import preview can identify the plugin without resolving the configuration.
 */
data class ExternalPluginWidgetProperties(
    val configurationId: UUID?,
    val bundleKey: String?,

    /**
     * Only populated by the exporter (self-describing export). Omitted from JSON when absent so a
     * widget that was never exported — and every other environment's data — round-trips cleanly.
     */
    @get:JsonInclude(JsonInclude.Include.NON_NULL)
    val pluginDefinitionKey: String? = null,

    @get:JsonInclude(JsonInclude.Include.NON_NULL)
    val pluginDefinitionVersion: String? = null,
)
