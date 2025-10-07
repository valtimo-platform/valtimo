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