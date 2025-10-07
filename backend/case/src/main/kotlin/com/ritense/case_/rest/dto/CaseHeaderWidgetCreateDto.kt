package com.ritense.case_.rest.dto

import jakarta.validation.constraints.Size

data class CaseHeaderWidgetCreateDto(
    @field:Size(max = 256)
    val type: String = "fields",
    val highContrast: Boolean = false,
    val properties: Map<String, Any?> = emptyMap()
)
