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

package com.ritense.case_.domain.header

import com.fasterxml.jackson.annotation.JsonProperty
import com.google.common.base.Objects
import com.ritense.valtimo.contract.annotation.AllOpen
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.Column
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.Table
import org.hibernate.annotations.Type

@AllOpen
@Entity
@Table(name = "case_header_widget")
class CaseHeaderWidget(

    @EmbeddedId
    @JsonProperty("id")
    val id: CaseHeaderWidgetId,

    @Column(name = "type", nullable = false, length = 256)
    val type: String = "fields",

    @Column(name = "high_contrast", nullable = false)
    val highContrast: Boolean = false,

    @Type(JsonType::class)
    @Column(name = "properties", nullable = false)
    val properties: Map<String, Any?> = emptyMap()
) {
    fun copy(
        id: CaseHeaderWidgetId = this.id,
        type: String = this.type,
        highContrast: Boolean = this.highContrast,
        properties: Map<String, Any?> = this.properties
    ): CaseHeaderWidget =
        CaseHeaderWidget(
            id = id,
            type = type,
            highContrast = highContrast,
            properties = properties
        )

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is CaseHeaderWidget) return false

        return id == other.id &&
            type == other.type &&
            highContrast == other.highContrast &&
            properties == other.properties
    }

    override fun hashCode(): Int =
        Objects.hashCode(id, type, highContrast, properties)

    override fun toString(): String =
        "CaseHeaderWidget(id='$id', type='$type', highContrast=$highContrast)"
}