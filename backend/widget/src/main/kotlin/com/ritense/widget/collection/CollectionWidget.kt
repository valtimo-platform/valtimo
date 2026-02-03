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

package com.ritense.widget.collection

import com.ritense.valtimo.contract.annotation.AllOpen
import com.ritense.valtimo.contract.conditions.Condition
import com.ritense.widget.domain.Widget
import com.ritense.widget.domain.WidgetAction
import com.ritense.widget.domain.WidgetColor
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.Column
import jakarta.persistence.DiscriminatorValue
import jakarta.persistence.Entity
import java.util.UUID
import org.hibernate.annotations.Type

@AllOpen
@Entity
@DiscriminatorValue("collection")
class CollectionWidget(
    id: UUID = UUID.randomUUID(),
    key: String,
    title: String,
    icon: String? = null,
    color: WidgetColor = WidgetColor.WHITE,
    order: Int,
    width: Int,
    highContrast: Boolean,
    isCompact: Boolean?,
    actions: List<WidgetAction> = emptyList(),
    displayConditions: List<Condition<*>> = emptyList(),

    @Type(value = JsonType::class)
    @Column(name = "properties", nullable = false)
    val properties: CollectionWidgetProperties
) : Widget(
    id, key, title, icon, color, order, width, highContrast, isCompact, actions, displayConditions
) {
    override fun copy(
        id: UUID,
        key: String,
        title: String,
        icon: String?,
        color: WidgetColor,
        order: Int,
        width: Int,
        highContrast: Boolean,
        isCompact: Boolean?,
        actions: List<WidgetAction>,
        displayConditions: List<Condition<*>>,
    ) = CollectionWidget(
        id = id,
        key = key,
        title = title,
        icon = icon,
        color = color,
        order = order,
        width = width,
        highContrast = highContrast,
        isCompact = isCompact,
        actions = actions,
        displayConditions = displayConditions,
        properties = properties,
    )

    override fun toDto() = CollectionWidgetDto(
        key = this.key,
        title = this.title,
        icon = this.icon,
        color = this.color,
        width = this.width,
        highContrast = this.highContrast,
        isCompact = this.isCompact,
        actions = this.actions,
        displayConditions = this.displayConditions,
        properties = this.properties,
    )

    override fun getUnresolvedValues(): List<String> = super.getUnresolvedValues() + properties.collection
}
