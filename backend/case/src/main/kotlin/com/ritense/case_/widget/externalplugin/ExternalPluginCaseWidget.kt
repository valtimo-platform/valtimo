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

import com.ritense.case_.domain.tab.CaseWidgetTabWidget
import com.ritense.case_.domain.tab.CaseWidgetTabWidgetId
import com.ritense.valtimo.contract.annotation.AllOpen
import com.ritense.valtimo.contract.conditions.Condition
import com.ritense.widget.domain.WidgetAction
import com.ritense.widget.domain.WidgetColor
import jakarta.persistence.Column
import jakarta.persistence.DiscriminatorValue
import jakarta.persistence.Entity
import java.util.UUID

/**
 * `external-plugin` case-widget subtype: a card in a WIDGETS tab's grid rendered as a sandboxed
 * iframe of an external plugin's `case-widget` bundle. Unlike the `custom` widget (a JSON
 * `properties` column) the external-plugin config maps to dedicated, queryable columns so the delete
 * guard and dangling-repair panel can find widgets by configuration id portably across the
 * Postgres/MySQL dual database support.
 *
 * [externalPluginConfigurationId] is `null` for a widget that imported dangling (its configuration
 * missing in this environment); [pluginDefinitionKey]/[pluginDefinitionVersion] then keep it
 * identifiable in the repair panel.
 */
@AllOpen
@Entity
@DiscriminatorValue("external-plugin")
class ExternalPluginCaseWidget(
    id: CaseWidgetTabWidgetId,
    title: String,
    icon: String? = null,
    color: WidgetColor = WidgetColor.WHITE,
    order: Int,
    width: Int,
    highContrast: Boolean,
    isCompact: Boolean?,
    actions: List<WidgetAction>,
    displayConditions: List<Condition<*>>,

    @Column(name = "external_plugin_configuration_id")
    val externalPluginConfigurationId: UUID?,

    @Column(name = "bundle_key")
    val bundleKey: String?,

    @Column(name = "plugin_definition_key")
    val pluginDefinitionKey: String? = null,

    @Column(name = "plugin_definition_version")
    val pluginDefinitionVersion: String? = null,
) : CaseWidgetTabWidget(
    id, title, icon, color, order, width, highContrast, isCompact, actions, displayConditions
) {
    override fun copy(id: CaseWidgetTabWidgetId) = ExternalPluginCaseWidget(
        id = id,
        title = title,
        icon = icon,
        color = color,
        order = order,
        width = width,
        highContrast = highContrast,
        isCompact = isCompact,
        actions = actions,
        displayConditions = displayConditions,
        externalPluginConfigurationId = externalPluginConfigurationId,
        bundleKey = bundleKey,
        pluginDefinitionKey = pluginDefinitionKey,
        pluginDefinitionVersion = pluginDefinitionVersion,
    )

    /** Same widget, re-pointed at another external-plugin configuration (used by dangling repair). */
    fun withExternalPluginConfigurationId(configurationId: UUID?) = ExternalPluginCaseWidget(
        id = id,
        title = title,
        icon = icon,
        color = color,
        order = order,
        width = width,
        highContrast = highContrast,
        isCompact = isCompact,
        actions = actions,
        displayConditions = displayConditions,
        externalPluginConfigurationId = configurationId,
        bundleKey = bundleKey,
        pluginDefinitionKey = pluginDefinitionKey,
        pluginDefinitionVersion = pluginDefinitionVersion,
    )
}
