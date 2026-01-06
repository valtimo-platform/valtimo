package com.ritense.resource.service

import com.ritense.resource.domain.VirusScanResult

interface VirusScanService {
    fun scan(bytes: ByteArray): VirusScanResult
}
