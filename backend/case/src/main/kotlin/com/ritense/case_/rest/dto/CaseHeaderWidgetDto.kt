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

package com.ritense.case_.rest.dto

import com.ritense.case_.domain.header.CaseHeaderWidget
import com.ritense.case_.domain.header.CaseHeaderWidgetId


data class CaseHeaderWidgetDto(
    val caseDefinitionKey: String,
    val caseDefinitionVersionTag: String,
    val type: String,
    val highContrast: Boolean,
    val properties: Map<String, Any?>
) {
    companion object {
        fun of(entity: CaseHeaderWidget): CaseHeaderWidgetDto =
            CaseHeaderWidgetDto(
                caseDefinitionKey = entity.id.caseDefinitionKey,
                caseDefinitionVersionTag = entity.id.caseDefinitionVersionTag,
                type = entity.type,
                highContrast = entity.highContrast,
                properties = entity.properties ?: emptyMap()
            )

        fun toEntity(
            caseDefinitionKey: String,
            caseDefinitionVersionTag: String,
            dto: CaseHeaderWidgetCreateDto
        ): CaseHeaderWidget =
            CaseHeaderWidget(
                id = CaseHeaderWidgetId(caseDefinitionKey, caseDefinitionVersionTag),
                highContrast = dto.highContrast,
                properties = dto.properties
            )
    }
}