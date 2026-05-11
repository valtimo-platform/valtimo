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

package com.ritense.case_.widget.highlight

import com.fasterxml.jackson.annotation.JsonValue
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull

enum class HighlightDisplayType {
    ARRAY_COUNT,
    NUMBER,
    TEXT;

    val value: String
        @JsonValue get() = name.lowercase().replace('_', '-')
}

data class HighlightDisplayProperties(
    @field:NotNull val type: HighlightDisplayType = HighlightDisplayType.TEXT
)

data class HighlightWidgetProperties(
    @field:NotBlank val value: String,
    @field:Valid val displayProperties: HighlightDisplayProperties = HighlightDisplayProperties(),
)
