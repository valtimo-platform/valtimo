/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.case_.widget.fields

import com.fasterxml.jackson.annotation.JsonIgnore
import com.ritense.case_.domain.tab.CaseWidgetTabWidget
import com.ritense.case_.domain.tab.CaseWidgetTabWidgetId
import com.ritense.valtimo.contract.annotation.AllOpen
import com.ritense.valtimo.contract.conditions.Condition
import com.ritense.widget.domain.WidgetAction
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.Column
import jakarta.persistence.DiscriminatorValue
import jakarta.persistence.Entity
import org.hibernate.annotations.Type

@AllOpen
@Entity
@DiscriminatorValue("fields")
class FieldsCaseWidget(
    id: CaseWidgetTabWidgetId,
    title: String,
    icon: String? = null,
    order: Int,
    width: Int,
    highContrast: Boolean,
    actions: List<WidgetAction>,
    displayConditions: List<Condition<*>>,

    @Type(value = JsonType::class)
    @Column(name = "properties", nullable = false)
    val properties: FieldsWidgetProperties
) : CaseWidgetTabWidget(
    id, title, icon,order, width, highContrast, actions, displayConditions
) {
    override fun copy(id: CaseWidgetTabWidgetId) = FieldsCaseWidget(
        id = id,
        title = title,
        icon = icon,
        order = order,
        width = width,
        highContrast = highContrast,
        actions = actions,
        displayConditions = displayConditions,
        properties = properties
    )

    @JsonIgnore
    override fun getUnresolvedValues(): List<String> {
        return (actions.flatMap { it.getUnresolvedValues() } +
            properties.columns.flatMap { column -> column.map { field -> field.value } }).distinct()
    }

    @JsonIgnore
    override fun getExposedValues(resolveValue: (String) -> Any?): Map<String, Any?> {
        return properties.columns.flatMap { column ->
            column.map { field ->
                field.key to resolveValue(field.value)
            }
        }.toMap() + actions
            .flatMap { action -> action.getExposedValues(resolveValue).map { it.key to it.value } }
    }
}
