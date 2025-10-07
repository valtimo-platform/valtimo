package com.ritense.case_.rest.dto

data class CaseHeaderWidgetUpdateDto(
    val highContrast: Boolean = false,
    val properties: Map<String, Any?> = emptyMap()
)