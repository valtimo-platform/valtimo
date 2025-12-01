package com.ritense.resource.service

import com.ritense.resource.domain.VirusScanResult
import java.io.InputStream

interface VirusScanService {
    fun scan(bytes: ByteArray): VirusScanResult
    fun scan(inputStream: InputStream): VirusScanResult
}
