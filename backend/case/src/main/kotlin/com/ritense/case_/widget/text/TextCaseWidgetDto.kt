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

package com.ritense.case_.widget.text

import com.fasterxml.jackson.annotation.JsonTypeName
import com.ritense.case_.rest.dto.CaseWidgetTabWidgetDto
import com.ritense.valtimo.contract.conditions.Condition
import com.ritense.widget.domain.WidgetAction
import com.ritense.widget.domain.WidgetColor

@JsonTypeName("text")
data class TextCaseWidgetDto(
    override val key: String,
    override val title: String,
    override val icon: String?,
    override val color: WidgetColor? = null,
    override val width: Int,
    override val highContrast: Boolean,
    override val isCompact: Boolean?,
    // Declared as a constructor property rather than an overridden getter on purpose: Jackson has
    // USE_GETTERS_AS_SETTERS enabled by default and would otherwise deserialize into the read-only
    // list returned by the getter, failing with "Operation is not supported for read-only
    // collection" as soon as an action is configured.
    override val actions: List<WidgetAction>? = emptyList(),
    override val displayConditions: List<Condition<*>> = emptyList(),
    val properties: TextWidgetProperties,
) : CaseWidgetTabWidgetDto
