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

import com.fasterxml.jackson.annotation.JsonTypeName
import com.ritense.case_.rest.dto.CaseWidgetTabWidgetDto
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.conditions.Condition
import com.ritense.widget.domain.WidgetAction
import com.ritense.widget.domain.WidgetColor
import jakarta.validation.Valid

@JsonTypeName("external-plugin")
data class ExternalPluginCaseWidgetDto(
    override val key: String,
    override val title: String,
    override val icon: String?,
    override val color: WidgetColor? = null,
    override val width: Int,
    override val highContrast: Boolean,
    override val isCompact: Boolean?,
    override val actions: List<WidgetAction>? = emptyList(),
    override val displayConditions: List<Condition<*>> = emptyList(),
    @field:Valid val properties: ExternalPluginWidgetProperties,
) : CaseWidgetTabWidgetDto {

    /**
     * A configured widget must reference a plugin configuration. The bundle key is intentionally
     * optional — it is `null` when the plugin ships a single, key-less `case-widget` bundle (the
     * resolver then picks the sole bundle). Choosing among several bundles is enforced client-side.
     * A widget always carries a (possibly now-dangling) configuration id: the importer keeps the
     * original id when a mapping is left unset, so this never rejects a repairable import.
     */
    override fun validate(caseDefinitionId: CaseDefinitionId) {
        require(properties.configurationId != null) {
            "External-plugin widget '$key' must reference a plugin configuration."
        }
    }
}
