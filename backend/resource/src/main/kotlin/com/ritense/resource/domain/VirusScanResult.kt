package com.ritense.resource.domain

class VirusScanResult(
    val status: VirusScanStatus,
    val foundViruses: Map<String, Collection<String>>,
)