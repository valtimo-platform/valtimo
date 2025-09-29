package com.ritense.case_.rest.dto

import jakarta.validation.constraints.Size

data class CaseHeaderWidgetCreateDto(
    @field:Size(max = 256)
    val title: String,
    val highContrast: Boolean = false,
    val properties: Map<String, Any?> = emptyMap()
)
