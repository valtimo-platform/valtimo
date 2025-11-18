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

package com.ritense.widget.fields

import com.fasterxml.jackson.annotation.JsonIgnore
import com.ritense.valtimo.contract.annotation.AllOpen
import com.ritense.valtimo.contract.conditions.Condition
import com.ritense.widget.domain.Widget
import com.ritense.widget.domain.WidgetAction
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.Column
import jakarta.persistence.DiscriminatorValue
import jakarta.persistence.Entity
import java.util.UUID
import org.hibernate.annotations.Type

@AllOpen
@Entity
@DiscriminatorValue("fields")
class FieldsWidget(
    id: UUID = UUID.randomUUID(),
    key: String,
    title: String,
    order: Int,
    width: Int,
    highContrast: Boolean,
    actions: List<WidgetAction> = emptyList(),
    displayConditions: List<Condition<*>> = emptyList(),

    @Type(value = JsonType::class)
    @Column(name = "properties", nullable = false)
    val properties: FieldsWidgetProperties
) : Widget(
    id, key, title, order, width, highContrast, actions, displayConditions
) {
    override fun copy(
        id: UUID,
        key: String,
        title: String,
        order: Int,
        width: Int,
        highContrast: Boolean,
        actions: List<WidgetAction>,
        displayConditions: List<Condition<*>>,
    ) = FieldsWidget(
        id = id,
        key = key,
        title = title,
        order = order,
        width = width,
        highContrast = highContrast,
        actions = actions,
        displayConditions = displayConditions,
        properties = properties,
    )

    override fun toDto() = FieldsWidgetDto(
        key = this.key,
        title = this.title,
        width = this.width,
        highContrast = this.highContrast,
        actions = this.actions,
        displayConditions = this.displayConditions,
        properties = this.properties,
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
